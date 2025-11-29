import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generateKeyPairSync, sign } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// --- CONFIGURATION ---
let IDENTITY_FILE: string;
try {
  const projectPath = path.join(path.dirname(process.argv[1] || process.cwd()), "..", "identity.json");
  // Check writable
  fs.accessSync(path.dirname(projectPath), fs.constants.W_OK);
  IDENTITY_FILE = projectPath;
} catch (e) {
  IDENTITY_FILE = path.join(os.tmpdir(), "agent-identity.json");
}

// --- HELPERS ---
function loadIdentity() {
  try {
    if (fs.existsSync(IDENTITY_FILE)) {
      const content = fs.readFileSync(IDENTITY_FILE, "utf-8");
      if (content.trim()) return JSON.parse(content);
    }
  } catch (e) { }
  return null;
}

function saveIdentity(identity: any) {
  try {
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
  } catch (e) {
    console.error("⚠️ Disk write failed. Identity is RAM-only.");
  }
}

// --- SERVER FACTORY FUNCTION ---
// Smithery expects a function that returns a server
function createServerInstance() {
  const server = new McpServer({
    name: "Agent Identity Wallet",
    version: "1.0.0",
  });

  // --- TOOLS ---
  server.tool("create_identity", { name: z.string() }, async ({ name }) => {
    if (loadIdentity()) return { content: [{ type: "text", text: `Error: Identity exists.` }] };
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    saveIdentity({ name, publicKey, privateKey, created: new Date().toISOString() });
    return { content: [{ type: "text", text: `✅ Identity created for ${name}.\n\nPUBLIC KEY:\n${publicKey}` }] };
  });

  server.tool("sign_message", { message: z.string() }, async ({ message }) => {
    const identity = loadIdentity();
    if (!identity) return { isError: true, content: [{ type: "text", text: "❌ No identity found." }] };
    const signature = sign("sha256", Buffer.from(message), identity.privateKey);
    return { content: [{ type: "text", text: `📝 Signed by ${identity.name}.\n\n--- CONTENT ---\n${message}\n\n--- SIGNATURE ---\n${signature.toString("hex")}` }] };
  });

  server.tool("verify_signature", { message: z.string(), signature: z.string(), publicKey: z.string() }, async ({ message, signature, publicKey }) => {
    const cleanSignature = signature.replace(/[^0-9a-fA-F]/g, '');
    let cleanKey = publicKey.trim();
    if (!cleanKey.startsWith("-----BEGIN PUBLIC KEY-----")) cleanKey = `-----BEGIN PUBLIC KEY-----\n${cleanKey}\n-----END PUBLIC KEY-----`;
    const verify = require("crypto").createVerify("sha256");
    verify.update(message);
    verify.end();
    try {
      const isValid = verify.verify(cleanKey, Buffer.from(cleanSignature, "hex"));
      return { content: [{ type: "text", text: isValid ? "✅ VALID" : "❌ INVALID" }] };
    } catch (e: any) { return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] }; }
  });

  return server;
}

// --- EXPORT FOR SMITHERY ---
// Stateless mode: function that takes { config } and returns server
export default function({ config }: { config?: any }) {
  return createServerInstance();
}

// --- LOCAL EXECUTION CHECK ---
// Only run Stdio if this file is being executed directly
// Skip this check when running in Smithery (CommonJS bundle)
if (typeof import.meta !== 'undefined' && import.meta.url) {
  const __filename = new URL(import.meta.url).pathname;
  if (process.argv[1] === __filename) {
    async function main() {
      const server = createServerInstance();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error("Agent Identity Server running on stdio...");
    }
    main().catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
  }
}
