import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("DetourOps production sources contain the operational controls", async () => {
  const [page, component, data, hosting, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/detour-ops.tsx", root), "utf8"),
    readFile(new URL("app/detour-data.ts", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /DetourOps \| Traffic Diversion Control System/);
  assert.match(component, /Operational Control Board/);
  assert.match(component, /Evidence Gate/i);
  assert.match(component, /current-gate blockers/i);
  assert.match(component, /future controls/i);
  assert.match(component, /Pass needs evidence; N\/A needs a reason/i);
  assert.match(component, /Open → submit → answer → incorporate → close/i);
  assert.match(component, /Source-Controlled Code Assistant/i);
  assert.match(data, /Project Setup/);
  assert.match(data, /Normal traffic restored/);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, "FILES");
  assert.match(hostingConfig.project_id, /^appgprj_/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
  await access(new URL("dist/server/index.js", root));
});
