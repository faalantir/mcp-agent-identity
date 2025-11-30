from langchain.tools import tool
from pydantic import BaseModel, Field
import json

# --- 1. The Mock Infrastructure ---
class MockBankAPI:
    def execute(self, amount: int, user: str, signature: str = None):
        if signature:
            print(f"🏦 BANK: Verifying signature '{signature[:10]}...' -> VALID.")
            print(f"💰 BANK: Transferred ${amount} to {user} (SECURE).")
        else:
            print(f"⚠️ BANK WARNING: Executing UNVERIFIED transaction of ${amount} to {user}!")
            print(f"💸 BANK: Money moved without proof.")

bank = MockBankAPI()

# --- 2. The Identity Layer (Your Tool) ---
class AgentIdentityClient:
    """Wraps your local Agent Identity Protocol."""
    def sign_action(self, action_description: str) -> str:
        # In a real app, this calls your MCP server
        print(f"🔐 AIP: Agent is signing action: '{action_description}'...")
        return "7f8a9d001...[cryptographic_signature]...e4f"

identity_layer = AgentIdentityClient()

# ==========================================
# 🚫 THE UNSAFE WAY (How most agents are built)
# ==========================================
@tool
def unsafe_transfer(amount: int, to_user: str):
    """Transfers money immediately without security checks."""
    # DANGER: If the LLM hallucinates, this runs instantly.
    bank.execute(amount, to_user, signature=None)
    return "Transfer complete."

# ==========================================
# ✅ THE SECURE WAY (With Agent Identity)
# ==========================================
class TransferInput(BaseModel):
    amount: int = Field(description="Amount to transfer in USD")
    to_user: str = Field(description="The recipient's username")

@tool("secure_transfer", args_schema=TransferInput)
def secure_transfer(amount: int, to_user: str) -> str:
    """
    Transfers money securely. 
    REQUIRES a cryptographic signature from Agent Identity Protocol.
    """
    
    # 1. Construct the payload
    payload = f"TRANSFER_USD:{amount}:TO:{to_user}"
    
    # 2. Force the Agent to Sign (The Handshake)
    try:
        signature = identity_layer.sign_action(payload)
    except Exception as e:
        return f"❌ Authorization Failed: Could not sign request."

    # 3. Execute with Proof
    bank.execute(amount, to_user, signature)
    
    return f"✅ Transfer Complete. Audit ID: {signature[:10]}..."

# ==========================================
# 🧪 TEST RUNNER
# ==========================================
if __name__ == "__main__":
    print("\n--- 🚫 TEST 1: The Unsafe Way ---")
    print("Agent decides to move money...")
    unsafe_transfer.run({"amount": 500, "to_user": "Hacker"})
    print("(Notice: No security check happened. Money is gone.)")

    print("\n" + "="*30 + "\n")

    print("--- ✅ TEST 2: The Secure Way (AIP) ---")
    print("Agent decides to move money...")
    result = secure_transfer.run({"amount": 100, "to_user": "Alice"})
    print(f"Result: {result}")
    print("(Notice: The agent was forced to sign before the bank accepted it.)")