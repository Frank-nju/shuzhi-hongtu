import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "../miniprogram/node_modules/esbuild/lib/main.js";

const root = path.resolve(import.meta.dirname, "..");
const miniRoot = path.join(root, "miniprogram");
const stateBundle = path.join(os.tmpdir(), `shuzhi-route-state-${process.pid}.mjs`);
const linkBundle = path.join(os.tmpdir(), `shuzhi-route-link-${process.pid}.mjs`);

after(() => {
  fs.rmSync(stateBundle, { force: true });
  fs.rmSync(linkBundle, { force: true });
});

const readMini = (file) => fs.readFileSync(path.join(miniRoot, file), "utf8");

async function bundleModule(entry, outfile) {
  assert.ok(fs.existsSync(entry), path.relative(miniRoot, entry));
  await build({
    bundle: true,
    entryPoints: [entry],
    format: "esm",
    logLevel: "silent",
    outfile,
    platform: "node",
    target: "node22",
  });
  return import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
}

const planFixture = (id = "plan-1") => ({
  id,
  name: `路线 ${id}`,
  angle: "测试主题",
  score: 91,
  spots: [
    { id: "A", name: "点位 A" },
    { id: "B", name: "点位 B" },
    { id: "C", name: "点位 C" },
  ],
  days: [[{ id: "A" }, { id: "B" }, { id: "C" }]],
  reason: "测试推荐理由",
  background: "测试背景",
  services: { hotels: [], charters: [] },
  dimensions: [],
  criteria: {
    county: "于都县",
    startDate: "2026-10-01",
    days: 1,
    theme1: "长征文化",
    theme2: "群众支前",
    experience: "现场观察",
    purpose: "社会实践",
    travelMode: "self",
  },
  feasible: true,
});

test("route state safely validates, versions and limits saved routes", async () => {
  const state = await bundleModule(
    path.join(miniRoot, "src/utils/route-state.ts"),
    stateBundle,
  );

  assert.deepEqual(state.parseSavedRoutes(null), []);
  assert.deepEqual(state.parseSavedRoutes([{ plan: { id: "broken" } }]), []);

  const first = state.upsertSavedRoute([], planFixture(), "2026-08-24T10:00:00.000Z", "saved-1");
  const updated = state.upsertSavedRoute(first, { ...planFixture(), name: "更新后的路线" }, "2026-08-24T11:00:00.000Z", "saved-2");
  assert.equal(updated.length, 2);
  assert.equal(updated[0].plan.name, "更新后的路线");

  let many = [];
  for (let index = 0; index < 14; index += 1) {
    many = state.upsertSavedRoute(many, planFixture(`plan-${index}`), `2026-08-24T${String(index).padStart(2, "0")}:00:00.000Z`);
  }
  assert.equal(many.length, 12);
  assert.equal(state.removeSavedRoute(many, many[0].id).some((item) => item.id === many[0].id), false);
});

test("route progress counts unique valid completed spots", async () => {
  const state = await bundleModule(
    path.join(miniRoot, "src/utils/route-state.ts"),
    stateBundle,
  );
  const progress = state.routeProgress(planFixture(), ["A", "A", "missing"]);

  assert.deepEqual(progress, { completed: 1, total: 3, percent: 33 });
});

test("shared mini-program route links recover the same generated plan", async () => {
  const links = await bundleModule(
    path.join(miniRoot, "src/utils/route-link.ts"),
    linkBundle,
  );
  const plan = links.defaultSharedPlan();
  const routePath = links.miniPlanPath(plan);
  const url = new URL(`https://mini.local${routePath}`);
  const recovered = links.resolvePlanFromParams(Object.fromEntries(url.searchParams));
  const rawParams = Object.fromEntries(
    routePath.split("?")[1].split("&").map((entry) => {
      const [key, ...value] = entry.split("=");
      return [key, value.join("=")];
    }),
  );
  const twiceEncodedParams = Object.fromEntries(
    Object.entries(rawParams).map(([key, value]) => [key, encodeURIComponent(value)]),
  );
  const recoveredFromRawParams = links.resolvePlanFromParams(rawParams);
  const recoveredFromTwiceEncodedParams = links.resolvePlanFromParams(twiceEncodedParams);

  assert.match(routePath, /^\/pages\/route-detail\/index\?/);
  assert.equal(recovered?.id, plan.id);
  assert.deepEqual(recoveredFromRawParams?.criteria, plan.criteria);
  assert.deepEqual(recoveredFromTwiceEncodedParams?.criteria, plan.criteria);
  assert.ok(recoveredFromRawParams?.dimensions.every((item) => !/%(?:25)?[\dA-F]{2}/i.test(item.label)));
});

test("phase four registers saved routes and route detail pages", () => {
  const appConfig = readMini("src/app.config.ts");

  assert.match(appConfig, /pages\/saved\/index/);
  assert.match(appConfig, /pages\/route-detail\/index/);
  assert.match(appConfig, /text:\s*['"]我的['"]/);
});

test("recommendation page can save and open a generated route", () => {
  const planner = readMini("src/pages/routes/index.tsx");

  assert.match(planner, /saveRoute/);
  assert.match(planner, /setActiveRoute/);
  assert.match(planner, /miniPlanPath/);
  assert.match(planner, /保存路线/);
  assert.match(planner, /查看行程/);
});

test("saved page refreshes on display and supports removal", () => {
  const saved = readMini("src/pages/saved/index.tsx");

  assert.match(saved, /useDidShow/);
  assert.match(saved, /loadSavedRoutes/);
  assert.match(saved, /removeRoute/);
  assert.match(saved, /还没有保存路线/);
});

test("route detail supports progress, maps and native sharing", () => {
  const detail = readMini("src/pages/route-detail/index.tsx");
  const pageConfig = readMini("src/pages/route-detail/index.config.ts");

  assert.match(detail, /useShareAppMessage/);
  assert.match(detail, /Taro\.openLocation/);
  assert.match(detail, /toggleCompletedSpot/);
  assert.match(detail, /Progress/);
  assert.match(detail, /openType='share'/);
  assert.match(pageConfig, /enableShareAppMessage:\s*true/);
});

test("landmark detail can open the selected point in a map", () => {
  const landmarks = readMini("src/pages/landmarks/index.tsx");

  assert.match(landmarks, /Taro\.openLocation/);
  assert.match(landmarks, /地图查看/);
});
