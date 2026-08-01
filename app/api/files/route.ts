import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json(
      { error: "Sign in is required for file storage." },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const category = String(form.get("category") ?? "evidence")
    .replace(/[^a-z0-9_-]/gi, "")
    .slice(0, 32);

  if (!(file instanceof File)) {
    return Response.json({ error: "A file is required." }, { status: 400 });
  }
  if (!allowedTypes.has(file.type)) {
    return Response.json({ error: "Unsupported file type." }, { status: 415 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return Response.json({ error: "Maximum file size is 25 MB." }, { status: 413 });
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const key = `${user.userId}/${category}/${crypto.randomUUID()}-${cleanName}`;
  await env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name, category },
  });

  return Response.json({
    ok: true,
    key,
    name: file.name,
    size: file.size,
    storage: "private-r2",
  });
}
