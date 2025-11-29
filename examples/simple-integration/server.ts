import { verifyAgentIdentity } from "@agent-identity/verify";

// --- MOCK PAYLOAD  ---
const mockPayload = {
  message: "I want to transfer $500 to Account #12345.",
  signature: "255fb6aeda273734f5cf9e240af73cc4ea1b3c40e785190ea1546f5fa2b33af2aa29d6f7b67bab0aefb9c3fd32e80a1c000852892ac3a7ee4001c6f66f88d6996d603173c9eb3b28eb474a85d1a971248d03015ef828a247db2c027f3a41d5381b74dae89d98d6f529f3207e269759c36e2e681164a3691ab4014627b1183d618e3ba5ea40c4b9d67344590ca69ef0e43d6cd8aa1ef21d7942c79f27d5b2087caa48ba91c8d7dc7374a681033736b9286df541197d3daef140c15768709b12008f9dfce5454d0e43227049c9376aa9111f77ef2050f1e098359bb8762ce5b4cf61d68e6b984bbec5b1e995af7bee313d850c4ad692deaa0a7aefd69f3868a9c0",  // We will paste this from Claude
  publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp7vkSxUKLhPc6fRaT8Gf
4+4pmunpzo4hDBI2NTcnlKh4dptyiJntrAPVVlxMUSZBZGdVGfan9kIeUnb0zwn7
ADa1QoEZgYOB9KmoUEAugeZz2CGgnjGcaSpK0cPmLfJCM4yrv/IvTadZoeNdbsSk
o3J/090aFnZ/NQNvaI0bihTf8JfeTgZ29ZsCYDqbv4XnIPuZJf6m2Na+aYUGxs/Z
1uUxFd+PqlJV5w/O/4IkzsyFfzX81JT54yiQ5vqRCdJaGizQ7zQypzuRdHSGT+zY
eWthjq4zOP/HUIh2KU0Wwtbelu+OxDtLwSZOaz+Ao6hg6waI8bzkLzjz4NjpNm5a
XQIDAQAB
-----END PUBLIC KEY-----`   // Paste this from Claude which generated token for your agent
};

// --- THE BANK SERVER LOGIC ---
function runBankServer() {
  console.log(`\n🏦 BANK: Processing transaction...`);

  // ONE LINE VERIFICATION!
  const result = verifyAgentIdentity(mockPayload);

  if (result.isValid) {
    console.log("✅ SUCCESS: Signature Verified. Money Transferred.");
  } else {
    console.log(`❌ FRAUD ALERT: ${result.error}`);
  }
}

runBankServer();