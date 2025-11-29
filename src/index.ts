import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { generateKeyPairSync, sign } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as http from "http"; // Built-in Node module (No npm install needed)

// --- GLOBAL BACKUP ---
let memoryIdentity: any = null;

// --- CONFIGURATION ---
let IDENTITY_FILE: string;
try {
  IDENTITY_FILE = path.join(path.dirname(process.argv[1] || process.cwd()), "..", "identity.json");
} catch (e) {
  IDENTITY_FILE = path.join(os.tmpdir(), "agent-identity.json");
}

// --- HELPER: Load Identity ---
function loadIdentity() {
  try {
    if (fs.existsSync(IDENTITY_FILE)) {
      const content = fs.readFileSync(IDENTITY_FILE, "utf-8");
      if (content.trim()) return JSON.parse(content);
    }
  } catch (e) { }
  return memoryIdentity;
}

// --- HELPER: Save Identity ---
function saveIdentity(identity: any) {
  memoryIdentity = identity;
  try {
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
  } catch (e) {
    console.error("⚠️ Disk write failed. Using in-memory storage only.");
  }
}

// --- SERVER SETUP ---
const server = new McpServer({
  name: "Agent Identity Wallet",
  version: "1.0.0",
});

// --- TOOLS (Create/Sign/Verify) ---
server.tool("create_identity", { name: z.string() }, async ({ name }) => {
  const existing = loadIdentity();
  if (existing) return { content: [{ type: "text", text: `Error: Identity exists for '${existing.name}'.` }] };
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

// --- MAIN ---
async function main() {
  const port = process.env.PORT; // Smithery injects this

  if (port) {
    // --- HTTP MODE (Smithery) ---
    let transport = new SSEServerTransport("/messages", new http.ServerResponse(new http.IncomingMessage(null as any)));
    
    const httpServer = http.createServer(async (req, res) => {
      // 1. SSE Connection
      if (req.url === "/sse") {
        transport = new SSEServerTransport("/messages", res);
        await server.connect(transport);
        return;
      }
      // 2. Message Handling
      if (req.url === "/messages" && req.method === "POST") {
        await transport.handlePostMessage(req, res);
        return;
      }
      // 404
      res.writeHead(404);
      res.end("Not Found");
    });

    httpServer.listen(port, () => {
      console.error(`Agent Identity Server running on HTTP port ${port}`);
    });

  } else {
    // --- STDIO MODE (Local) ---
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Agent Identity Server running on stdio...");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});