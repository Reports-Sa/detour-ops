import { getStore } from "@netlify/blobs";

type RagConfig = {
  vectorStoreId: string;
  createdAt: string;
};

const CONFIG_KEY = "rag-config";

export async function getVectorStoreId(apiKey?: string, createIfMissing = false) {
  const configured = process.env.OPENAI_VECTOR_STORE_ID?.trim();
  if (configured) return configured;

  const store = getStore("detourops-corpus");
  const saved = await store.get(CONFIG_KEY, { type: "json" }) as RagConfig | null;
  if (saved?.vectorStoreId) return saved.vectorStoreId;
  if (!createIfMissing || !apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/vector_stores", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "DetourOps approved engineering sources" }),
  });
  const data = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "Could not create the approved-source knowledge base.");
  }

  await store.setJSON(CONFIG_KEY, {
    vectorStoreId: data.id,
    createdAt: new Date().toISOString(),
  } satisfies RagConfig);
  return data.id;
}
