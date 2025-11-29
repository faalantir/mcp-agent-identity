import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { generateKeyPairSync, sign, randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import express from "express";

// --- CONFIGURATION ---
// We determine the file path safely.
// If we can't write to the project folder, we use the system temp folder.
let IDENTITY_FILE: string;
try {
  // Try project folder first
  const projectPath = path.join(path.dirname(process.argv[1] || process.cwd()), "..", "identity.json");
  // Check if we can write here (this throws if read-only)
  fs.accessSync(path.dirname(projectPath), fs.constants.W_OK);
  IDENTITY_FILE = projectPath;
} catch (e) {
  // Fallback to /tmp which is always writable
  IDENTITY_FILE = path.join(os.tmpdir(), "agent-identity.json");
  console.error(`⚠️ Read-only environment. Using temp path: ${IDENTITY_FILE}`);
}

// --- GLOBAL MEMORY BACKUP ---
let memoryIdentity: any = null;

// --- HELPER: Load Identity ---
function loadIdentity() {
  try {
    // 1. Try Memory First
    if (memoryIdentity) return memoryIdentity;

    // 2. Try Disk
    if (fs.existsSync(IDENTITY_FILE)) {
      const content = fs.readFileSync(IDENTITY_FILE, "utf-8");
      if (content.trim()) {
        const data = JSON.parse(content);
        memoryIdentity = data; // Cache it
        return data;
      }
    }
  } catch (e) {
    console.error("⚠️ Error loading identity:", e);
  }
  return null;
}

// --- HELPER: Save Identity ---
function saveIdentity(identity: any) {
  // 1. Save to Memory (Always works)
  memoryIdentity = identity;

  // 2. Try Save to Disk
  try {
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
  } catch (e) {
    console.error("⚠️ Failed to write to disk. Identity is in-memory only.");
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
      return { content: [{ type: "text", text: `Error: An identity already exists for '${existing.name}'.` }] };
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
      return { isError: true, content: [{ type: "text", text: "❌ No identity found. Create one first." }] };
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
      return { content: [{ type: "text", text: isValid ? "✅ VALID" : "❌ INVALID" }] };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
    }
  }
);

// --- MAIN ---
async function main() {
  const port = process.env.PORT;

  if (port) {
    // HTTP MODE - Streamable HTTP for Smithery
    const app = express();
    app.use(express.json());

    // Create transport once and connect server
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });
    await server.connect(transport);

    // Handle all MCP requests
    app.all("/mcp", async (req, res) => {
      try {
        await transport.handleRequest(req, res, req.body);
      } catch (error: any) {
        console.error("Error handling request:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    });

    app.listen(parseInt(port), "0.0.0.0", () => {
      console.error(`Agent Identity Server running on HTTP port ${port}`);
    });
  } else {
    // STDIO MODE - Local CLI
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Agent Identity Server running on stdio transport...");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});