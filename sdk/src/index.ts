import { createVerify } from "crypto";

/**
 * The structure of the data expected from an Agent.
 */
export interface AgentPayload {
  message: string;
  signature: string;
  publicKey: string;
}

/**
 * Result of a verification attempt.
 */
export interface VerificationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Verifies that a message was signed by the specific Agent Identity.
 * Automatically handles common formatting issues (PEM headers, whitespace).
 * * @param payload The object containing message, signature, and publicKey
 * @returns VerificationResult { isValid: boolean, error?: string }
 */
export function verifyAgentIdentity(payload: AgentPayload): VerificationResult {
  try {
    const { message, signature, publicKey } = payload;

    if (!message || !signature || !publicKey) {
      return { isValid: false, error: "Missing required fields (message, signature, or publicKey)" };
    }

    // 1. Sanitize Signature (Remove non-hex characters like spaces/newlines)
    const cleanSignature = signature.replace(/[^0-9a-fA-F]/g, '');

    // 2. Sanitize Public Key (Ensure PEM headers exist)
    let cleanKey = publicKey.trim();
    // If user provided a raw key without headers, add them
    if (!cleanKey.startsWith("-----BEGIN PUBLIC KEY-----")) {
      cleanKey = `-----BEGIN PUBLIC KEY-----\n${cleanKey}\n-----END PUBLIC KEY-----`;
    }

    // 3. Perform Cryptographic Verification
    const verify = createVerify("sha256");
    verify.update(message);
    verify.end();

    const isValid = verify.verify(cleanKey, Buffer.from(cleanSignature, "hex"));

    if (isValid) {
      return { isValid: true };
    } else {
      return { isValid: false, error: "Signature mismatch. The message may have been tampered with." };
    }

  } catch (error: any) {
    // Catch-all for malformed keys or other crypto errors
    return { isValid: false, error: `Cryptographic error: ${error.message}` };
  }
}