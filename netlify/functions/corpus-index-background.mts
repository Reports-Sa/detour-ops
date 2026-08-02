import { getStore } from "@netlify/blobs";
import { getVectorStoreId } from "./_rag-config.mts";

type UploadSession = {
  id: string;
  filename: string;
  mimeType: string;
  expectedChunks: number;
  title: string;
  authority: string;
  edition: string;
};

type CorpusSource = {
  id: string;
  filename: string;
  title: string;
  authority: string;
  edition: string;
  status: "uploading" | "indexing" | "ready" | "failed";
  uploadedAt: string;
  indexedAt?: string;
  error?: string;
  openaiFileId?: string;
};

function isAdmin(request: Request) {
  const expected = process.env.CORPUS_ADMIN_KEY?.trim();
  const provided = request.headers.get("x-corpus-admin-key")?.trim();
  return Boolean(expected && provided && expected.length >= 12 && provided === expected);
}

async function openAI(path: string, apiKey: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: { authorization: `Bearer ${apiKey}`, ...(init.headers ?? {}) },
  });
  const data = await response.json() as { error?: { message?: string }; id?: string; status?: string };
  if (!response.ok) throw new Error(data.error?.message || `OpenAI request failed (${response.status})`);
  return data;
}

async function updateSource(id: string, patch: Partial<CorpusSource>) {
  const store = getStore("detourops-corpus");
  const registry = (await store.get("registry", { type: "json" }) as CorpusSource[] | null) ?? [];
  await store.setJSON("registry", registry.map((source) => source.id === id ? { ...source, ...patch } : source));
}

export default async (request: Request) => {
  if (!isAdmin(request)) return new Response("Unauthorized", { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const vectorStoreId = await getVectorStoreId(apiKey, false);
  if (!apiKey || !vectorStoreId) return new Response("RAG environment is not configured", { status: 503 });

  const { uploadId } = await request.json() as { uploadId?: string };
  if (!uploadId) return new Response("Missing upload ID", { status: 400 });

  const uploads = getStore("detourops-corpus-uploads");
  const session = await uploads.get(`session/${uploadId}`, { type: "json" }) as UploadSession | null;
  if (!session) return new Response("Upload session not found", { status: 404 });

  try {
    const parts: ArrayBuffer[] = [];
    for (let index = 0; index < session.expectedChunks; index += 1) {
      const key = `chunk/${uploadId}/${String(index).padStart(5, "0")}`;
      const part = await uploads.get(key, { type: "arrayBuffer" }) as ArrayBuffer | null;
      if (!part) throw new Error(`Missing upload chunk ${index + 1}`);
      parts.push(part);
    }

    const form = new FormData();
    form.append("purpose", "assistants");
    form.append("file", new Blob(parts, { type: session.mimeType }), session.filename);
    const file = await openAI("/files", apiKey, { method: "POST", body: form });
    if (!file.id) throw new Error("OpenAI did not return a file ID");

    await openAI(`/vector_stores/${vectorStoreId}/files`, apiKey, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_id: file.id,
        attributes: {
          category: "approved-source",
          title: session.title.slice(0, 256),
          authority: session.authority.slice(0, 256),
          edition: session.edition.slice(0, 256),
        },
      }),
    });

    let status = "in_progress";
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const indexed = await openAI(`/vector_stores/${vectorStoreId}/files/${file.id}`, apiKey);
      status = indexed.status ?? status;
      if (status === "completed") break;
      if (status === "failed" || status === "cancelled") throw new Error(`Indexing ended with status: ${status}`);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    if (status !== "completed") throw new Error("Indexing did not complete within ten minutes");

    await updateSource(uploadId, {
      status: "ready",
      indexedAt: new Date().toISOString(),
      openaiFileId: file.id,
      error: undefined,
    });

    for (let index = 0; index < session.expectedChunks; index += 1) {
      await uploads.delete(`chunk/${uploadId}/${String(index).padStart(5, "0")}`);
    }
    await uploads.delete(`session/${uploadId}`);
    return new Response("Indexed", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown indexing failure";
    console.error("Corpus indexing failed", uploadId, message);
    await updateSource(uploadId, { status: "failed", error: message.slice(0, 300) });
    return new Response("Indexing failed", { status: 500 });
  }
};
