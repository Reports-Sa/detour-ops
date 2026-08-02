import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

type UploadSession = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  chunkSize: number;
  expectedChunks: number;
  title: string;
  authority: string;
  edition: string;
  createdAt: string;
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

const CHUNK_SIZE = 3 * 1024 * 1024;
const MAX_FILE_SIZE = 200 * 1024 * 1024;
const supportedExtensions = [".pdf", ".docx", ".txt", ".md", ".pptx", ".html"];
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function sameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site";
}

function isAdmin(request: Request) {
  const expected = process.env.CORPUS_ADMIN_KEY?.trim();
  const provided = request.headers.get("x-corpus-admin-key")?.trim();
  return Boolean(expected && provided && expected.length >= 12 && provided === expected);
}

async function getRegistry() {
  const store = getStore("detourops-corpus");
  return (await store.get("registry", { type: "json" }) as CorpusSource[] | null) ?? [];
}

async function saveRegistry(items: CorpusSource[]) {
  await getStore("detourops-corpus").setJSON("registry", items);
}

function publicSource(source: CorpusSource) {
  const { openaiFileId: _secret, ...safe } = source;
  return safe;
}

export default async (request: Request) => {
  if (request.method === "GET") {
    const sources = await getRegistry();
    return json({ sources: sources.map(publicSource) });
  }

  if (!sameOrigin(request)) return json({ error: "Cross-site requests are not allowed." }, 403);
  if (!isAdmin(request)) return json({ error: "Corpus administrator access is required." }, 401);

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (request.method === "POST" && action === "init") {
    const body = await request.json() as Partial<UploadSession>;
    const filename = String(body.filename ?? "").slice(0, 240);
    const extension = supportedExtensions.find((item) => filename.toLowerCase().endsWith(item));
    const size = Number(body.size ?? 0);
    if (!extension) return json({ error: `Supported source types: ${supportedExtensions.join(", ")}` }, 400);
    if (!Number.isFinite(size) || size < 1 || size > MAX_FILE_SIZE) {
      return json({ error: "Source file must be between 1 byte and 200 MB." }, 400);
    }

    const id = crypto.randomUUID();
    const session: UploadSession = {
      id,
      filename,
      mimeType: String(body.mimeType || "application/octet-stream").slice(0, 120),
      size,
      chunkSize: CHUNK_SIZE,
      expectedChunks: Math.ceil(size / CHUNK_SIZE),
      title: String(body.title || filename).slice(0, 180),
      authority: String(body.authority || "Authority to be verified").slice(0, 120),
      edition: String(body.edition || "Revision to be verified").slice(0, 120),
      createdAt: new Date().toISOString(),
    };

    await getStore("detourops-corpus-uploads").setJSON(`session/${id}`, session);
    const registry = await getRegistry();
    registry.unshift({
      id,
      filename,
      title: session.title,
      authority: session.authority,
      edition: session.edition,
      status: "uploading",
      uploadedAt: session.createdAt,
    });
    await saveRegistry(registry);
    return json({ uploadId: id, chunkSize: CHUNK_SIZE, expectedChunks: session.expectedChunks }, 201);
  }

  if (request.method === "POST" && action === "chunk") {
    const uploadId = url.searchParams.get("uploadId") ?? "";
    const index = Number(url.searchParams.get("index"));
    const uploads = getStore("detourops-corpus-uploads");
    const session = await uploads.get(`session/${uploadId}`, { type: "json" }) as UploadSession | null;
    if (!session) return json({ error: "Upload session was not found." }, 404);
    if (!Number.isInteger(index) || index < 0 || index >= session.expectedChunks) {
      return json({ error: "Invalid chunk index." }, 400);
    }
    const chunk = await request.arrayBuffer();
    if (chunk.byteLength < 1 || chunk.byteLength > CHUNK_SIZE) {
      return json({ error: "Invalid chunk size." }, 400);
    }
    await uploads.set(`chunk/${uploadId}/${String(index).padStart(5, "0")}`, chunk);
    return json({ received: index });
  }

  if (request.method === "POST" && action === "complete") {
    const body = await request.json() as { uploadId?: string };
    const uploadId = body.uploadId ?? "";
    const uploads = getStore("detourops-corpus-uploads");
    const session = await uploads.get(`session/${uploadId}`, { type: "json" }) as UploadSession | null;
    if (!session) return json({ error: "Upload session was not found." }, 404);
    const { blobs } = await uploads.list({ prefix: `chunk/${uploadId}/` });
    if (blobs.length !== session.expectedChunks) {
      return json({ error: `Upload is incomplete (${blobs.length}/${session.expectedChunks} chunks).` }, 409);
    }

    const registry = await getRegistry();
    await saveRegistry(registry.map((source) => source.id === uploadId ? { ...source, status: "indexing", error: undefined } : source));

    const backgroundUrl = new URL("/.netlify/functions/corpus-index-background", request.url);
    const queued = await fetch(backgroundUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-corpus-admin-key": request.headers.get("x-corpus-admin-key") ?? "",
      },
      body: JSON.stringify({ uploadId }),
    });
    if (!queued.ok) return json({ error: "Indexing job could not be queued." }, 502);
    return json({ uploadId, status: "indexing" }, 202);
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id") ?? "";
    const registry = await getRegistry();
    const source = registry.find((item) => item.id === id);
    if (!source) return json({ error: "Source was not found." }, 404);

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID?.trim();
    if (apiKey && vectorStoreId && source.openaiFileId) {
      const auth = { authorization: `Bearer ${apiKey}` };
      await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${source.openaiFileId}`, { method: "DELETE", headers: auth });
      await fetch(`https://api.openai.com/v1/files/${source.openaiFileId}`, { method: "DELETE", headers: auth });
    }
    await saveRegistry(registry.filter((item) => item.id !== id));
    return json({ deleted: id });
  }

  return json({ error: "Unsupported corpus operation." }, 405);
};

export const config: Config = {
  path: "/api/corpus",
  rateLimit: {
    windowLimit: 180,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
