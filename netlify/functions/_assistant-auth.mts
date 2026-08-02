import { createHmac, timingSafeEqual } from "node:crypto";

export function signAssistantJob(responseId: string, apiKey: string) {
  return createHmac("sha256", apiKey)
    .update(`detourops-assistant:${responseId}`)
    .digest("base64url");
}

export function verifyAssistantJob(responseId: string, token: string, apiKey: string) {
  const expected = Buffer.from(signAssistantJob(responseId, apiKey));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
