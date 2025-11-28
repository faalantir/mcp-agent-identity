"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// --- CONFIGURATION ---
const IDENTITY_FILE = path.resolve(process.cwd(), "identity.json");
// --- HELPER: Load/Save Keys ---
function loadIdentity() {
    if (fs.existsSync(IDENTITY_FILE)) {
        return JSON.parse(fs.readFileSync(IDENTITY_FILE, "utf-8"));
    }
    return null;
}
function saveIdentity(identity) {
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
}
// --- SERVER SETUP ---
const server = new mcp_js_1.McpServer({
    name: "Agent Identity Wallet",
    version: "1.0.0",
});
// --- TOOL 1: Create Identity ---
server.tool("create_identity", { name: zod_1.z.string().describe("The name of the agent (e.g. 'FinanceBot')") }, (_a) => __awaiter(void 0, [_a], void 0, function* ({ name }) {
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
    const { publicKey, privateKey } = (0, crypto_1.generateKeyPairSync)("rsa", {
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
}));
// --- TOOL 2: Sign Message ---
server.tool("sign_message", { message: zod_1.z.string().describe("The text you want to cryptographically sign") }, (_a) => __awaiter(void 0, [_a], void 0, function* ({ message }) {
    const identity = loadIdentity();
    if (!identity) {
        return {
            isError: true,
            content: [{ type: "text", text: "❌ No identity found. Please ask me to 'create an identity' first." }]
        };
    }
    // Sign the data using the stored private key
    const signature = (0, crypto_1.sign)("sha256", Buffer.from(message), identity.privateKey);
    const signatureHex = signature.toString("hex");
    return {
        content: [{
                type: "text",
                text: `📝 Message Signed by ${identity.name}.\n\n--- CONTENT ---\n${message}\n\n--- SIGNATURE ---\n${signatureHex}`
            }],
    };
}));
// --- TOOL 3: Verify Signature (For testing) ---
// This lets the user verify if a signature is valid, acting as the "Bank"
server.tool("verify_signature", {
    message: zod_1.z.string().describe("The original message content"),
    signature: zod_1.z.string().describe("The hex signature string"),
    publicKey: zod_1.z.string().describe("The public key of the signer")
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ message, signature, publicKey }) {
    const verify = require("crypto").createVerify("sha256");
    verify.update(message);
    verify.end();
    try {
        const isValid = verify.verify(publicKey, Buffer.from(signature, "hex"));
        return {
            content: [{
                    type: "text",
                    text: isValid ? "✅ VALID: This signature is authentic." : "❌ INVALID: This message was tampered with or fake."
                }]
        };
    }
    catch (e) {
        return { isError: true, content: [{ type: "text", text: "Error verifying signature. Check key format." }] };
    }
}));
// --- START SERVER ---
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const transport = new stdio_js_1.StdioServerTransport();
        yield server.connect(transport);
        // Note: STDIO transport logs to stderr, not stdout
        console.error("Agent Identity Server running...");
    });
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
