import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { activityEvents, projectWorkspaces } from "../../../db/schema";

type WorkspacePayload = {
  projectCode?: unknown;
  projectTitle?: unknown;
  state?: unknown;
};

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ workspace: null, mode: "demo" });
  }

  const db = getDb();
  const [workspace] = await db
    .select()
    .from(projectWorkspaces)
    .where(eq(projectWorkspaces.ownerId, user.userId))
    .orderBy(desc(projectWorkspaces.updatedAt))
    .limit(1);

  if (!workspace) {
    return Response.json({ workspace: null, mode: "private" });
  }

  return Response.json({
    workspace: {
      ...workspace,
      state: JSON.parse(workspace.stateJson),
      stateJson: undefined,
    },
    mode: "private",
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json(
      { error: "Sign in is required for cloud saving." },
      { status: 401 },
    );
  }

  let payload: WorkspacePayload;
  try {
    payload = (await request.json()) as WorkspacePayload;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    typeof payload.projectCode !== "string" ||
    typeof payload.projectTitle !== "string" ||
    !payload.state ||
    typeof payload.state !== "object"
  ) {
    return Response.json({ error: "Invalid workspace payload." }, { status: 400 });
  }

  const projectCode = payload.projectCode.trim().slice(0, 80);
  const projectTitle = payload.projectTitle.trim().slice(0, 160);
  if (!projectCode || !projectTitle) {
    return Response.json(
      { error: "Project code and title are required." },
      { status: 400 },
    );
  }

  const stateJson = JSON.stringify(payload.state);
  if (stateJson.length > 1_500_000) {
    return Response.json({ error: "Workspace is too large." }, { status: 413 });
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: projectWorkspaces.id, revision: projectWorkspaces.revision })
    .from(projectWorkspaces)
    .where(
      and(
        eq(projectWorkspaces.ownerId, user.userId),
        eq(projectWorkspaces.projectCode, projectCode),
      ),
    )
    .limit(1);

  const id = existing?.id ?? crypto.randomUUID();
  const revision = (existing?.revision ?? 0) + 1;

  await db
    .insert(projectWorkspaces)
    .values({
      id,
      ownerId: user.userId,
      projectCode,
      projectTitle,
      stateJson,
      revision,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: projectWorkspaces.id,
      set: {
        projectTitle,
        stateJson,
        revision,
        updatedAt: new Date().toISOString(),
      },
    });

  await db.insert(activityEvents).values({
    workspaceId: id,
    ownerId: user.userId,
    action: "workspace.saved",
    detail: `Revision ${revision}`,
  });

  return Response.json({ ok: true, id, revision });
}
