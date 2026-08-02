import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const apiKey = process.env.OPENAI_API_KEY?.trim();
const filePath = resolve(process.argv[2] || "../305 AR.pdf");

if (!apiKey) {
  throw new Error("Set OPENAI_API_KEY in your terminal environment before running this script.");
}

async function openAI(path, init = {}) {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI request failed (${response.status})`);
  return data;
}

const bytes = await readFile(filePath);
const upload = new FormData();
upload.append("purpose", "assistants");
upload.append("file", new Blob([bytes], { type: "application/pdf" }), basename(filePath));

console.log(`Uploading ${basename(filePath)} privately to OpenAI Files…`);
const file = await openAI("/files", { method: "POST", body: upload });

console.log("Creating the DetourOps approved-source vector store…");
const vectorStore = await openAI("/vector_stores", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "DetourOps — Saudi Highway Code 305" }),
});

await openAI(`/vector_stores/${vectorStore.id}/files`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    file_id: file.id,
    attributes: {
      category: "authority-code",
      document_code: "SHC-305",
      approval_state: "candidate-verify-edition",
    },
  }),
});

let status = "in_progress";
for (let attempt = 0; attempt < 90; attempt += 1) {
  const indexed = await openAI(`/vector_stores/${vectorStore.id}/files/${file.id}`);
  status = indexed.status;
  process.stdout.write(`\rIndexing status: ${status}   `);
  if (status === "completed") break;
  if (status === "failed" || status === "cancelled") {
    throw new Error(`Vector-store indexing ended with status: ${status}`);
  }
  await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
}

if (status !== "completed") throw new Error("Indexing did not complete within three minutes.");

console.log("\n\nRAG corpus is ready.");
console.log(`OPENAI_VECTOR_STORE_ID=${vectorStore.id}`);
console.log(`OPENAI_FILE_ID=${file.id}`);
console.log("Store the vector-store ID as a Netlify environment variable; never commit the API key.");
