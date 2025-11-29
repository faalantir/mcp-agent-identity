import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// FIX 1: Import createVerify here instead of using require() later
import { generateKeyPairSync, sign, createVerify } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

// --- CONFIGURATION ---
let IDENTITY_FILE: string;

if (process.env.AGENT_IDENTITY_PATH) {
  IDENTITY_FILE = process.env.AGENT_IDENTITY_PATH;
  console.error(`Using custom identity path: ${IDENTITY_FILE}`);
} else {
  try {
    const projectPath = path.join(path.dirname(process.argv[1] || process.cwd()), "..", "identity.json");
    fs.accessSync(path.dirname(projectPath), fs.constants.W_OK);
    IDENTITY_FILE = projectPath;
  } catch (e) {
    IDENTITY_FILE = path.join(os.tmpdir(), "agent-identity.json");
  }
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
    const dir = path.dirname(IDENTITY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
    console.error(`✅ Identity saved to ${IDENTITY_FILE}`);
  } catch (e: any) {
    console.error(`⚠️ Disk write failed to ${IDENTITY_FILE}. Error: ${e.message}`);
  }
}

// --- SERVER FACTORY ---
function createServerInstance() {
  const server = new McpServer({
    name: "Agent Identity Wallet",
    version: "1.1.0",
  });

  // Tool 1: Create
  server.tool("create_identity", { name: z.string() }, async ({ name }) => {
    if (loadIdentity()) return { content: [{ type: "text", text: `Error: Identity exists.` }] };
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    saveIdentity({ name, publicKey, privateKey, created: new Date().toISOString() });
    return { content: [{ type: "text", text: `✅ Identity created for ${name}.\n\nPUBLIC KEY:\n${publicKey}` }] };
  });

  // Tool 2: Get Info
  server.tool("get_identity", {}, async () => {
    const identity = loadIdentity();
    if (!identity) return { content: [{ type: "text", text: "ℹ️ No identity found." }] };
    return { content: [{ type: "text", text: `👤 Agent Name: ${identity.name}\n📂 Location: ${IDENTITY_FILE}\n\nPUBLIC KEY:\n${identity.publicKey}` }] };
  });

  // Tool 3: Sign
  server.tool("sign_message", { message: z.string() }, async ({ message }) => {
    const identity = loadIdentity();
    if (!identity) return { isError: true, content: [{ type: "text", text: "❌ No identity found." }] };
    const signature = sign("sha256", Buffer.from(message), identity.privateKey);
    return { content: [{ type: "text", text: `📝 Signed by ${identity.name}.\n\n--- CONTENT ---\n${message}\n\n--- SIGNATURE ---\n${signature.toString("hex")}` }] };
  });

  // Tool 4: Verify
  server.tool(
    "verify_signature", 
    { 
      message: z.string(), 
      signature: z.string(), 
      publicKey: z.string().optional().describe("Public key (PEM format). If omitted, uses current identity's key.")
    }, 
    async ({ message, signature, publicKey }) => {
      // If no publicKey provided, try to get it from current identity
      let keyToUse: string;
      if (!publicKey) {
        const identity = loadIdentity();
        if (!identity) {
          return { isError: true, content: [{ type: "text", text: "❌ No public key provided and no identity found. Please create an identity first or provide a public key." }] };
        }
        keyToUse = identity.publicKey;
        console.error(`Using public key from current identity: ${identity.name}`);
      } else {
        keyToUse = publicKey;
      }

      const cleanSignature = signature.replace(/[^0-9a-fA-F]/g, '');
      let cleanKey = keyToUse.trim();
      if (!cleanKey.startsWith("-----BEGIN PUBLIC KEY-----")) {
        cleanKey = `-----BEGIN PUBLIC KEY-----\n${cleanKey}\n-----END PUBLIC KEY-----`;
      }
      
      const verify = createVerify("sha256");
      verify.update(message);
      verify.end();
      
      try {
        const isValid = verify.verify(cleanKey, Buffer.from(cleanSignature, "hex"));
        return { content: [{ type: "text", text: isValid ? "✅ VALID" : "❌ INVALID" }] };
      } catch (e: any) { 
        return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] }; 
      }
    }
  );

  // Tool 5: Revoke
  server.tool("revoke_identity", {}, async () => {
    try {
      if (fs.existsSync(IDENTITY_FILE)) {
        fs.unlinkSync(IDENTITY_FILE);
        return { content: [{ type: "text", text: "✅ Identity revoked. File deleted." }] };
      }
      return { content: [{ type: "text", text: "ℹ️ No file found to delete." }] };
    } catch(e: any) { return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] }; }
  });

  return server;
}

export default function({ config }: { config?: any }) { return createServerInstance(); }

if (typeof import.meta !== 'undefined' && import.meta.url) {
  const __filename = fileURLToPath(import.meta.url);
  if (process.argv[1] === __filename) {
    async function main() {
      const server = createServerInstance();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error("Agent Identity Server running on stdio...");
    }
    main().catch((error) => { console.error("Fatal error:", error); process.exit(1); });
  }
}