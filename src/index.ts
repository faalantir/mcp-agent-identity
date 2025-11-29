import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generateKeyPairSync, sign } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// --- GLOBAL BACKUP ---
// If file storage fails (Cloud/Smithery), we store the identity here in RAM.
let memoryIdentity: any = null;

// --- CONFIGURATION ---
// We try to find a writable path, but we won't crash if we can't.
let IDENTITY_FILE: string;
try {
  IDENTITY_FILE = path.join(path.dirname(process.argv[1] || process.cwd()), "..", "identity.json");
} catch (e) {
  IDENTITY_FILE = path.join(os.tmpdir(), "agent-identity.json");
}

// --- HELPER: Load Identity (Disk -> RAM -> Null) ---
function loadIdentity() {
  // 1. Try Disk
  try {
    if (fs.existsSync(IDENTITY_FILE)) {
      const content = fs.readFileSync(IDENTITY_FILE, "utf-8");
      if (content.trim()) return JSON.parse(content);
    }
  } catch (e) {
    // Ignore disk errors
  }

  // 2. Try RAM (Fallback)
  return memoryIdentity;
}

// --- HELPER: Save Identity (Disk -> RAM) ---
function saveIdentity(identity: any) {
  // 1. Always save to RAM first (so it works immediately in this session)
  memoryIdentity = identity;

  // 2. Try to save to Disk (Bonus)
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

// --- TOOL 1: Create Identity ---
server.tool(
  "create_identity",
  { name: z.string().describe("The name of the agent") },
  async ({ name }) => {
    const existing = loadIdentity();
    if (existing) {
      return {
        content: [{ 
          type: "text", 
          text: `Error: An identity already exists for '${existing.name}'.` 
        }]
      };
    }

    // Generate Keys
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const newIdentity = { name, publicKey, privateKey, created: new Date().toISOString() };
    
    // Save (Will fallback to RAM if disk fails)
    saveIdentity(newIdentity);

    return {
      content: [{
        type: "text",
        text: `✅ Identity created for ${name}.\n\nPUBLIC KEY:\n${publicKey}`
      }],
    };
  }
);

// --- TOOL 2: Sign Message ---
server.tool(
  "sign_message",
  { message: z.string().describe("The text to sign") },
  async ({ message }) => {
    const identity = loadIdentity();
    
    if (!identity) {
      return { 
        isError: true, 
        content: [{ type: "text", text: "❌ No identity found. Create one first." }] 
      };
    }

    const signature = sign("sha256", Buffer.from(message), identity.privateKey);
    return {
      content: [{
        type: "text",
        text: `📝 Signed by ${identity.name}.\n\n--- CONTENT ---\n${message}\n\n--- SIGNATURE ---\n${signature.toString("hex")}`
      }],
    };
  }
);

// --- TOOL 3: Verify Signature ---
server.tool(
  "verify_signature",
  { 
    message: z.string().describe("The original message"),
    signature: z.string().describe("The hex signature"),
    publicKey: z.string().describe("The public key")
  },
  async ({ message, signature, publicKey }) => {
    // Clean inputs
    const cleanSignature = signature.replace(/[^0-9a-fA-F]/g, '');
    let cleanKey = publicKey.trim();
    if (!cleanKey.startsWith("-----BEGIN PUBLIC KEY-----")) {
      cleanKey = `-----BEGIN PUBLIC KEY-----\n${cleanKey}\n-----END PUBLIC KEY-----`;
    }

    const verify = require("crypto").createVerify("sha256");
    verify.update(message);
    verify.end();
    
    try {
      const isValid = verify.verify(cleanKey, Buffer.from(cleanSignature, "hex"));
      return {
        content: [{ 
          type: "text", 
          text: isValid ? "✅ VALID" : "❌ INVALID" 
        }]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
    }
  }
);

// --- START SERVER ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agent Identity Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});