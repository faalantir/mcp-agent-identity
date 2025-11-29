// src/index.ts
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
  // Try to use the project folder first (Best for Local Users)
  IDENTITY_FILE = path.join(path.dirname(process.argv[1]), "..", "identity.json");
  // Test if we can write here
  fs.accessSync(path.dirname(IDENTITY_FILE), fs.constants.W_OK);
} catch (error) {
  // Fallback: Use the system temp folder (Best for Cloud/Read-Only)
  console.error("⚠️ Local folder is read-only. Falling back to temporary directory.");
  IDENTITY_FILE = path.join(os.tmpdir(), "agent-identity.json");
}

// --- HELPER: Load/Save Keys ---
function loadIdentity() {
  try {
    if (fs.existsSync(IDENTITY_FILE)) {
      const fileContent = fs.readFileSync(IDENTITY_FILE, "utf-8");
      if (!fileContent.trim()) return null;
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("⚠️ Could not load identity.");
    return null;
  }
  return null;
}

function saveIdentity(identity: any) {
  try {
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
  } catch (error) {
    console.error(`⚠️ Failed to save identity to ${IDENTITY_FILE}. Running in-memory only.`);
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

    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const newIdentity = { name, publicKey, privateKey, created: new Date().toISOString() };
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