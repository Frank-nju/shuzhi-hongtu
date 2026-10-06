import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "../miniprogram/node_modules/esbuild/lib/main.js";

const root = path.resolve(import.meta.dirname, "..");
const miniRoot = path.join(root, "miniprogram");
const stateBundle = path.join(os.tmpdir(), `shuzhi-strict-state-${process.pid}.mjs`);
const planBundle = path.join(os.tmpdir(), `shuzhi-strict-plan-${process.pid}.mjs`);
const readMini = (file) => fs.readFileSync(path.join(miniRoot, file), "utf8");

after(() => {
  fs.rmSync(stateBundle, { force: true });
  fs.rmSync(planBundle, { force: true });
});

async function bundleModule(entry, outfile) {
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

const planFixture = (spotCount = 3) => {
  const themes = { 重要人物: 3, 重大事件: 4, 军事斗争: 3, 群众支前: 4, 政权建设: 2, 长征文化: 2, 革命精神: 5 };
  const experience = { 深度讲解: 4, 现场观察: 4, 互动体验: 3, 轻松参观: 3 };
  const spots = Array.from({ length: spotCount }, (_, index) => ({
    id: String.fromCharCode(65 + index),
    name: `点位 ${index + 1}`,
    short: `点位${index + 1}`,
    region: "测试区",
    county: "于都县",
    image: "/landmarks/YD01-park.webp",
    minutes: 60,
    closed: [],
    core: index === 0,
    lat: 25.95,
    lng: 115.4 + index * 0.05,
    themes,
    experience,
    intro: "测试点位",
  }));
  return {
    id: "plan-test",
    name: "测试路线",
    angle: "测试",
    score: 90,
    spots,
    days: [spots],
    reason: "测试",
    background: "测试",
    services: { hotels: [], charters: [] },
    dimensions: [],
    criteria: { county: "于都县", startDate: "2026-10-01", days: 1, theme1: "重大事件", theme2: "群众支前", experience: "现场观察", purpose: "社会实践", travelMode: "self" },
    feasible: true,
  };
};

test("planner opens a dedicated recommendation page with all five plans", () => {
  const config = readMini("src/app.config.ts");
  const home = readMini("src/pages/index/index.tsx");
  const planner = readMini("src/pages/planner/index.tsx");
  const routes = readMini("src/pages/routes/index.tsx");

  assert.match(config, /pages\/routes\/index/);
  assert.match(home, /slice\(0, 5\)/);
  assert.match(home, /pages\/routes\/index/);
  assert.match(planner, /pages\/routes\/index/);
  assert.doesNotMatch(planner, /slice\(0, 3\)/);
  assert.match(routes, /slice\(0, 5\)/);
  assert.match(routes, /重新规划/);
});

test("saving edited variants keeps multiple versions of one base route", async () => {
  const state = await bundleModule(path.join(miniRoot, "src/utils/route-state.ts"), stateBundle);
  const base = planFixture();
  const first = state.upsertSavedRoute([], base, "2026-08-24T10:00:00.000Z", "saved-a");
  const second = state.upsertSavedRoute(first, { ...base, spots: [...base.spots].reverse() }, "2026-08-24T11:00:00.000Z", "saved-b");

  assert.equal(second.length, 2);
  assert.deepEqual(second.map((item) => item.id), ["saved-b", "saved-a"]);
  assert.deepEqual(second.map((item) => item.plan.id), [base.id, base.id]);
  assert.deepEqual(state.removeSavedRoute(second, "saved-a").map((item) => item.id), ["saved-b"]);
});

test("history topics render the original artwork and relative-location illustration", () => {
  const history = readMini("src/pages/history/index.tsx");
  const config = readMini("config/index.ts");

  assert.match(history, /stage\.artwork/);
  assert.match(history, /stage\.mapImage/);
  assert.match(history, /专题艺术图/);
  assert.match(history, /点位相对位置图/);
  assert.match(config, /src\/assets\/history/);
  for (const file of [
    "timeline-autumn-uprising-woodcut.webp",
    "timeline-huangyangjie-field-sketch.webp",
    "timeline-yeping-ink-archive.webp",
    "timeline-dongmen-oil-march.webp",
    "map-stage-01-woodcut.webp",
    "map-stage-02-field-sketch.webp",
    "map-stage-03-ink-archive.webp",
    "map-stage-04-oil-march.webp",
  ]) {
    assert.ok(fs.existsSync(path.join(miniRoot, "src/assets/history", file)), file);
  }
});

test("mini maps expose county polygons and zoom-tier landmark labels", () => {
  const home = readMini("src/pages/index/index.tsx");
  const routeMap = readMini("src/components/route-map/index.tsx");
  const routeDetail = readMini("src/pages/route-detail/index.tsx");

  assert.match(home, /overviewMode/);
  assert.match(routeMap, /polygons=/);
  assert.match(routeMap, /onRegionChange/);
  assert.match(routeMap, /mapScale/);
  assert.match(routeMap, /spot\.core/);
  assert.match(routeMap, /资源覆盖县区/);
  assert.match(routeDetail, /onSpotTap=\{openSpotDetails\}/);
  assert.doesNotMatch(routeDetail, /onSpotTap=\{openSpotLocation\}/);
});

test("mini map markers use restrained numbered labels instead of landmark photos", () => {
  const routeMap = readMini("src/components/route-map/index.tsx");

  assert.doesNotMatch(routeMap, /iconPath:\s*spot\.image/);
  assert.match(routeMap, /iconPath:\s*['"]\/map\/marker-anchor\.png['"]/);
  assert.match(routeMap, /label:\s*\{/);
  assert.match(routeMap, /content:\s*String\(sourceIndex \+ 1\)/);
  assert.match(routeMap, /bgColor:\s*['"]#da291c['"]/);
});

test("overview map renders a complete legend with stable point numbering", () => {
  const routeMap = readMini("src/components/route-map/index.tsx");
  const routeMapStyles = readMini("src/components/route-map/index.scss");

  assert.match(routeMap, /const legendSpots = overviewMode \? spots : spots\.slice/);
  assert.match(routeMap, /\{legendSpots\.map\(\(spot, index\)/);
  assert.match(routeMap, /全部 \{spots\.length\} 处点位/);
  assert.match(routeMap, /<ScrollView[\s\S]*scrollY/);
  assert.match(routeMap, /\{spot\.region\} · \{spot\.county\}/);
  assert.match(routeMap, /上下滑动查看全部/);
  assert.match(routeMap, /id: sourceIndex \+ 1/);
  assert.match(routeMap, /spots\[Number\(markerId\) - 1\]/);
  assert.doesNotMatch(routeMap, /\{spots\.slice\(0, compact \? 4 : 8\)\.map/);
  assert.match(routeMapStyles, /\.route-map-legend-scroll\s*\{[\s\S]*?height:\s*600rpx/);
  assert.match(routeMapStyles, /\.route-map-legend-name\s*\{[\s\S]*?font-size:\s*23rpx/);
  assert.match(routeMapStyles, /\.route-map-legend-county\s*\{[\s\S]*?font-size:\s*19rpx/);
});

test("history planner handoff preserves chapter metadata and result summary", () => {
  const preset = readMini("src/services/planner-preset.ts");
  const history = readMini("src/pages/history/index.tsx");
  const planner = readMini("src/pages/planner/index.tsx");
  const routes = readMini("src/pages/routes/index.tsx");

  for (const field of ["number", "shortTitle", "period", "intro", "spotIds"]) {
    assert.match(preset, new RegExp(`${field}:`));
  }
  assert.match(history, /historyContext/);
  assert.match(planner, /historyContext\.period/);
  assert.match(planner, /historyContext\.spotIds\.length/);
  assert.match(routes, /historyStage\.intro/);
  assert.match(routes, /historyStage\.spotIds\.length/);
});

test("landmark detail explicitly renders fixed closing days", () => {
  const detail = readMini("src/pages/landmark-detail/index.tsx");

  assert.match(detail, /固定闭馆/);
  assert.match(detail, /spot\.closed/);
});

test("a two-stop route can delete its remaining non-core spot", async () => {
  const routePlan = await bundleModule(path.join(miniRoot, "src/utils/route-plan.ts"), planBundle);
  const plan = planFixture(2);
  const edited = routePlan.removeRouteSpot(plan, 1);

  assert.deepEqual(edited.spots.map((spot) => spot.id), ["A"]);
  assert.equal(edited.feasible, false);
});
