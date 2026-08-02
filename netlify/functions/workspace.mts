import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

type WorkspaceEnvelope = {
  workspace: {
    state: unknown;
    projectCode: string;
    projectTitle: string;
  };
  revision: number;
  updatedAt: string;
};

const idPattern = /^[a-f0-9-]{36}$/i;
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function workspaceId(request: Request) {
  const value = request.headers.get("x-detourops-workspace")?.trim() ?? "";
  return idPattern.test(value) ? value : null;
}

function sameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site";
}

export default async (request: Request) => {
  const id = workspaceId(request);
  if (!id) return json({ error: "A valid workspace identifier is required." }, 400);
  if (!sameOrigin(request)) return json({ error: "Cross-site requests are not allowed." }, 403);

  const store = getStore("detourops-workspaces");
  const key = `workspace/${id}`;

  if (request.method === "GET") {
    const current = await store.get(key, { type: "json" }) as WorkspaceEnvelope | null;
    if (!current) return json({ workspace: null, revision: 0 });
    return json(current);
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 700_000) return json({ error: "Workspace payload is too large." }, 413);

  let payload: { state?: unknown; projectCode?: string; projectTitle?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  if (!payload.state || typeof payload.state !== "object") {
    return json({ error: "Workspace state is required." }, 400);
  }

  const current = await store.get(key, { type: "json" }) as WorkspaceEnvelope | null;
  const revision = (current?.revision ?? 0) + 1;
  const updatedAt = new Date().toISOString();
  const envelope: WorkspaceEnvelope = {
    workspace: {
      state: payload.state,
      projectCode: String(payload.projectCode ?? "").slice(0, 80),
      projectTitle: String(payload.projectTitle ?? "").slice(0, 200),
    },
    revision,
    updatedAt,
  };

  await store.setJSON(key, envelope);
  const audit = getStore("detourops-audit");
  await audit.setJSON(`workspace/${id}/${Date.now()}-${crypto.randomUUID()}`, {
    action: "workspace.saved",
    revision,
    projectCode: envelope.workspace.projectCode,
    timestamp: updatedAt,
  });

  return json({ revision, updatedAt });
};

export const config: Config = {
  path: "/api/workspace",
};
