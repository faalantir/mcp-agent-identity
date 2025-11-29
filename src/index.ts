// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generateKeyPairSync, sign } from "crypto";
import * as fs from "fs";
import * as path from "path";

// --- CONFIGURATION ---
const IDENTITY_FILE = path.join(path.dirname(process.argv[1]), "..", "identity.json");

// --- HELPER: Load/Save Keys ---
function loadIdentity() {
  if (fs.existsSync(IDENTITY_FILE)) {
    try {
      const fileContent = fs.readFileSync(IDENTITY_FILE, "utf-8");
      // Check if file is empty
      if (!fileContent.trim()) {
        return null; 
      }
      return JSON.parse(fileContent);
    } catch (error) {
      console.error("⚠️ Warning: identity.json was corrupt or empty. Starting fresh.");
      return null; // Return null so we can create a fresh identity
    }
  }
  return null;
}

function saveIdentity(identity: any) {
  fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
}

// --- SERVER SETUP ---
const server = new McpServer({
  name: "Agent Identity Wallet",
  version: "1.0.0",
});

// --- TOOL 1: Create Identity ---
server.tool(
  "create_identity",
  { name: z.string().describe("The name of the agent (e.g. 'FinanceBot')") },
  async ({ name }) => {
    // Check if identity already exists to prevent accidental overwrite
    const existing = loadIdentity();
    if (existing) {
      return {
        content: [{ 
          type: "text", 
          text: `Error: An identity already exists for '${existing.name}'. Delete 'identity.json' to reset.` 
        }]
      };
    }

    // Generate RSA Key Pair
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
        text: `✅ Identity created for ${name}.\n\nYour PUBLIC KEY (ID) is:\n${publicKey}\n\n(I have securely saved the private key to identity.json)`
      }],
    };
  }
);

// --- TOOL 2: Sign Message ---
server.tool(
  "sign_message",
  { message: z.string().describe("The text you want to cryptographically sign") },
  async ({ message }) => {
    const identity = loadIdentity();
    
    if (!identity) {
      return { 
        isError: true, 
        content: [{ type: "text", text: "❌ No identity found. Please ask me to 'create an identity' first." }] 
      };
    }

    // Sign the data using the stored private key
    const signature = sign("sha256", Buffer.from(message), identity.privateKey);
    const signatureHex = signature.toString("hex");

    return {
      content: [{
        type: "text",
        text: `Message Signed by ${identity.name}.\n\n--- CONTENT ---\n${message}\n\n--- SIGNATURE ---\n${signatureHex}`
      }],
    };
  }
);

// --- TOOL 3: Verify Signature ---
server.tool(
  "verify_signature",
  { 
    message: z.string().describe("The original message content"),
    signature: z.string().describe("The hex signature string"),
    publicKey: z.string().describe("The public key (PEM format)")
  },
  async ({ message, signature, publicKey }) => {
    // 1. CLEAN THE SIGNATURE
    // Remove all spaces, newlines, and non-hex characters from the signature
    const cleanSignature = signature.replace(/[^0-9a-fA-F]/g, '');

    // 2. CLEAN THE KEY
    // Ensure it has no leading/trailing whitespace
    let cleanKey = publicKey.trim();
    if (!cleanKey.startsWith("-----BEGIN PUBLIC KEY-----")) {
      cleanKey = `-----BEGIN PUBLIC KEY-----\n${cleanKey}\n-----END PUBLIC KEY-----`;
    }

    // 3. DEBUG LOGGING (Check your terminal to see this!)
    console.error(`--- VERIFYING ---`);
    console.error(`Message: "${message}"`);
    console.error(`Signature Length: ${cleanSignature.length}`);
    
    const verify = require("crypto").createVerify("sha256");
    verify.update(message);
    verify.end();
    
    try {
      const isValid = verify.verify(cleanKey, Buffer.from(cleanSignature, "hex"));
      
      if (isValid) {
        return { content: [{ type: "text", text: "✅ VALID: The signature matches the message and key." }] };
      } else {
        return { 
          content: [{ 
            type: "text", 
            text: `❌ INVALID: The math does not match.\n\nCheck: Did you type the message EXACTLY?\nExpected: "${message}"` 
          }] 
        };
      }
    } catch (e: any) {
      return { 
        isError: true, 
        content: [{ type: "text", text: `System Error: ${e.message}` }] 
      };
    }
  }
);

// --- START SERVER ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Note: STDIO transport logs to stderr, not stdout
  console.error("Agent Identity Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});