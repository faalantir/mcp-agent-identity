
# LangChain + Agent Identity Protocol Integration

This example demonstrates the difference between a standard "Unsafe" tool and a "Secure" tool using Agent Identity.

## The Problem
Standard LangChain tools execute immediately. If an LLM is hijacked or hallucinates, it can delete files or spend money instantly.

## The Solution
We wrap the tool in an **Identity Layer**. The tool forces the agent to cryptographically sign the intent *before* execution.

## How to Run the Demo

1. **Install Dependencies:**
   ```bash
   pip install langchain pydantic
   ```

2.    **Run the Comparison:**
		```bash
		python secure_tool.py
		```

## Expected Output

You will see two scenarios:

1.  **The Unsafe Way:** Money moves immediately with a warning.
    
2.  **The Secure Way:** You will see the `🔐 AIP: Agent is signing action...` step before the bank accepts the transfer.