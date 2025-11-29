
  

# Agent Identity Protocol (AIP)

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6)
![Status](https://img.shields.io/badge/status-beta-orange)
![Security](https://img.shields.io/badge/security-standard-red)
[![NPM](https://img.shields.io/badge/NPM-%40agent--identity%2Fverify-CB3837.svg)](https://www.npmjs.com/package/@agent-identity/verify)
[![Smithery](https://img.shields.io/badge/Smithery-Installable-blue)](https://smithery.ai/server/@faalantir/mcp-agent-identity)

**The open standard for cryptographic provenance and attribution for AI Agents.**

> "Agents are currently anonymous ghosts. AIP gives them a persistent, verifiable identity."

## 🚀 The Problem
When an AI Agent (Claude, ChatGPT, or custom) attempts to interact with the real world—updating a database, calling an API, or executing a trade—the receiving system sees an anonymous request.

* **Who did this?** (Was it the Support Bot or the Finance Bot?)
* **Was it tampered with?** (Did a router or middleman change the prompt?)
* **Can I audit it?** (How do I prove *which* agent authorized this action?)

## 🛠 The Solution
**Agent Identity Protocol (AIP)** is a Model Context Protocol (MCP) Server that provides a local, secure "Wallet" for AI Agents. It enables **Attribution** and **Non-Repudiation** for agentic workflows.

### Core Capabilities
1. **Identity Generation:** Creates a persistent cryptographic keypair (RSA-2048) for the agent.
2. **Cryptographic Signing:** Allows the agent to sign payloads (actions) using its private key.
3. **Verification:** Provides a standard method for APIs to verify agent actions against a public key.

---

## 📦 Installation

### Method 1: Quick Install (Smithery)
Best for testing and quick usage.
> ⚠️ **Note:** Identities created via Smithery are **temporary** (sandboxed) and will be lost when you restart Claude unless you configure a custom path (see Configuration).

```bash
npx -y @smithery/cli@latest install @faalantir/mcp-agent-identity --client claude  

```

### Method 2: Developer Install (Source)

Best for production use and persistent identity storage.

```bash
# Clone the repository 

git clone https://github.com/faalantir/mcp-agent-identity.git

# Install dependencies 

cd mcp-agent-identity 
npm install && npm run build
```

Then add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-identity": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-agent-identity/dist/index.js"]
    }
  }
}
```
  

## 💾 Configuration & Storage

By default, the server tries to save `identity.json` in your project folder. If it cannot write there (e.g., inside a Smithery container), it falls back to the system temporary directory (RAM/Temp).

**To force a permanent location for your keys:** Update your `claude_desktop_config.json` with the `AGENT_IDENTITY_PATH` environment variable:

```json
"agent-identity": {
  "command": "...",
  "args": ["..."],
  "env": {
    "AGENT_IDENTITY_PATH": "/Users/YOURNAME/Desktop/my-identity.json"
  }
}
```


## 📖 Usage Flow



Once installed, your Agent automatically gains these tools. You can prompt it naturally:

### 1. Setup (One Time)

**User:** "Create a permanent identity for yourself named 'FinanceBot'." **Agent:** _Calls `create_identity`..._

> "Identity created. My Public ID is `MIIBIjAN...` (I have securely stored the Private Key)."

### 2. Check Identity

**User:** "Show me my identity details." **Agent:** _Calls `get_identity`..._

> "Agent Name: FinanceBot Location: /Users/aarti/Desktop/my-identity.json Public Key: ..."

### 3. The Transaction

**User:** "Please authorize a transfer of $50 to Alice." **Agent:** _Calls `sign_message`..._

> "I have signed the transaction payload. **Signature:** `7f8a9d...` (Verifiable)"

  

### 4. Verification (The "Bank" Side)

Use our [NPM SDK](https://www.npmjs.com/package/@agent-identity/verify) to verify signatures in your backend:

```bash
npm install @agent-identity/verify
```

```javascript
import { verifyAgentIdentity } from "@agent-identity/verify"; 
const result = verifyAgentIdentity({ message: "pay 500", signature: "...", publicKey: "..." }); 
if (result.isValid) { // Proceed with transaction }
```  



  

## 🗺 Roadmap & Architecture

  
We are designed to be algorithm-agnostic. While v0.1 uses local files for simplicity, the protocol is built to swap the "Signer Engine" for enterprise backends.

-   **v0.1 (Current):** Local RSA-2048 keys. Self-sovereign identity. Best for internal tools, debugging, and audit logs.
    
-   **v0.2 (Next):** Ed25519 support (smaller, faster keys) and DID (Decentralized Identifier) export.
    
-   **v0.3:** **Cloud Key Management (AWS KMS / Google Cloud HSM)** integration for enterprise deployments.
    
-   **v0.4:** **Hardware Enclave / TPM support** (keys generated inside the chip, never exposed to OS).
    
-   **v1.0:** The "Agent Registry" – A centralized directory to map Public Keys to verified Human Owners (Chain of Trust).

  

## ⚠️ Security & Limitations

  

-   **Self-Signed Trust:** Currently, agents generate their own keys. This creates a "Self-Signed Certificate" model. This is excellent for **Attribution** (knowing _which_ agent did X) but requires an external trust mechanism for high-stakes **Authorization**.
    
-   **Key Storage:** Keys are currently stored in `identity.json` on the host machine. Do not use this in shared environments without proper file permissions.
  

## 🤝 Contributing

We are looking for contributors to help build Verification SDKs for Python and Go.

  

----------

  

_Maintained by the Agent Identity Working Group._