  

# Agent Identity Protocol (AIP)

  

  

![License](https://img.shields.io/badge/license-MIT-blue)

  

![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6)

  

![Status](https://img.shields.io/badge/status-beta-orange)

  

![Security](https://img.shields.io/badge/security-standard-red)

  

  

**The open standard for cryptographic provenance and attribution for AI Agents.**

  

  

> "Agents are currently anonymous ghosts. AIP gives them a persistent, verifiable identity."

  

  

## 🚀 The Problem

  

When an AI Agent (Claude, ChatGPT, or custom) attempts to interact with the real world—updating a database, calling an API, or executing a trade—the receiving system sees an anonymous request.

  

  

*  **Who did this?** (Was it the Support Bot or the Finance Bot?)

  

*  **Was it tampered with?** (Did a router or middleman change the prompt?)

  

*  **Can I audit it?** (How do I prove *which* agent authorized this action?)

  

  

## 🛠 The Solution

  

**Agent Identity Protocol (AIP)** is a Model Context Protocol (MCP) Server that provides a local, secure "Wallet" for AI Agents. It enables **Attribution** and **Non-Repudiation** for agentic workflows.

  

  

### Core Capabilities

  

1.  **Identity Generation:** Creates a persistent cryptographic keypair (RSA-2048) for the agent.

  

2.  **Cryptographic Signing:** Allows the agent to sign payloads (actions) using its private key.

  

3.  **Verification:** Provides a standard method for APIs to verify agent actions against a public key.

  

  

## 📦 Installation

```bash


# Clone the repository
 
git  clone  https://github.com/faalantir/mcp-agent-identity.git


# Install dependencies

cd  mcp-agent-identity

npm  install
  

# Build the server

npm  run  build  

```

  

## 🔌 Configuration (Claude Desktop)

  

Add this to your `claude_desktop_config.json` to give your local Claude a "Wallet":

  

JSON

  

```

{

"mcpServers": {

"agent-identity": {

"command": "node",

"args": ["/ABSOLUTE/PATH/TO/mcp-agent-identity/dist/index.js"]

}

}

}  

```

## 📖 Usage Flow

  

Once installed, your Agent automatically gains these tools. You can prompt it naturally:

  

### 1. Setup (One Time)

  

**User:** "Create a permanent identity for yourself named 'FinanceBot'." **Agent:**  _Calls `create_identity`..._

  

> "Identity created. My Public ID is `MIIBIjAN...` (I have securely stored the Private Key)."

  

### 2. The Transaction

  

**User:** "Please authorize a transfer of $50 to Alice." **Agent:**  _Calls `sign_message`..._

  

> "I have signed the transaction payload. **Signature:**  `7f8a9d...` (Verifiable)"

  

### 3. The Verification (The "Bank" Side)

  

Any external system can use the `verify_signature` tool (or standard crypto libraries) to confirm:

  

1. The message came from this specific Agent.

2. The message was not altered by a single byte.

  

## 🗺 Roadmap & Architecture

  

We are designed to be algorithm-agnostic. While v0.1 uses local files for simplicity, the protocol is built to swap the "Signer Engine" for enterprise backends.

  

-  **v0.1 (Current):** Local RSA-2048 keys. Self-sovereign identity. Best for internal tools, debugging, and audit logs.

-  **v0.2 (Next):** Ed25519 support (smaller, faster keys) and DID (Decentralized Identifier) export.

-  **v0.3:**  **Cloud Key Management (AWS KMS / Google Cloud HSM)** integration for enterprise deployments.

-  **v0.4:**  **Hardware Enclave / TPM support** (keys generated inside the chip, never exposed to OS).

-  **v1.0:** The "Agent Registry" – A centralized directory to map Public Keys to verified Human Owners (Chain of Trust).

  

## ⚠️ Security & Limitations

  

-  **Self-Signed Trust:** Currently, agents generate their own keys. This creates a "Self-Signed Certificate" model. This is excellent for 
- **Attribution** (knowing _which_ agent did X) but requires an external trust mechanism for high-stakes 

- **Authorization** (allowing the agent to spend money).

-  **Key Storage:** Keys are currently stored in `identity.json` on the host machine. Do not use this in shared environments without proper file permissions.

  

## 🤝 Contributing

We are looking for contributors to help build the **Verification SDKs** (Node, Python, Go) to make adopting AIP easier for backend engineers.

  

----------

  

_Maintained by the Agent Identity Working Group._