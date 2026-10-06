import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "../miniprogram/node_modules/esbuild/lib/main.js";

const root = path.resolve(import.meta.dirname, "..");
const domainRoot = path.join(root, "shared", "domain");
const bundlePath = path.join(
  os.tmpdir(),
  `shuzhi-hongtu-domain-${process.pid}.mjs`,
);

let domainPromise;

async function loadDomain() {
  domainPromise ??= (async () => {
    const entry = path.join(domainRoot, "index.ts");
    assert.ok(fs.existsSync(entry), "shared/domain/index.ts");
    await build({
      bundle: true,
      entryPoints: [entry],
      format: "esm",
      logLevel: "silent",
      outfile: bundlePath,
      platform: "node",
      target: "node22",
    });
    return import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
  })();
  return domainPromise;
}

after(() => {
  fs.rmSync(bundlePath, { force: true });
});

test("shared domain source is framework agnostic", () => {
  for (const file of [
    "history-data.ts",
    "index.ts",
    "planner-query.ts",
    "planner.ts",
    "platform-data.ts",
    "spot-details.ts",
    "travel.ts",
  ]) {
    const source = fs.readFileSync(path.join(domainRoot, file), "utf8");
    assert.doesNotMatch(
      source,
      /from\s+["'](?:@\/|next|react|@taro)|\b(?:window|document|localStorage)\b/,
      file,
    );
  }
});

test("shared domain exposes the complete content catalogue", async () => {
  const { historyStages, spotDetails, spots } = await loadDomain();

  assert.equal(spots.length, 44);
  assert.equal(historyStages.length, 4);
  assert.equal(Object.keys(spotDetails).length, 44);
});

test("shared planner deterministically generates feasible routes", async () => {
  const { dayMinutes, generatePlans } = await loadDomain();
  const input = [
    "于都县",
    "2026-10-01",
    2,
    "长征文化",
    "群众支前",
    "现场观察",
    "社会实践",
    "self",
  ];
  const first = generatePlans(...input);
  const second = generatePlans(...input);

  assert.ok(first.length > 0 && first.length <= 5);
  assert.deepEqual(
    first.map((plan) => plan.spots.map((spot) => spot.id)),
    second.map((plan) => plan.spots.map((spot) => spot.id)),
  );
  assert.ok(
    first.every(
      (plan) =>
        plan.feasible &&
        plan.days.every(
          (day) => dayMinutes(day, plan.criteria.travelMode) <= 480,
        ),
    ),
  );
});

test("shared criteria parser applies safe boundary defaults", async () => {
  const { parsePlannerCriteria } = await loadDomain();
  const criteria = parsePlannerCriteria({
    days: "99",
    startDate: "not-a-date",
    theme1: "不存在",
    travelMode: "flight",
  });

  assert.equal(criteria.days, 2);
  assert.equal(criteria.theme1, "长征文化");
  assert.equal(criteria.travelMode, "self");
  assert.match(criteria.startDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("shared criteria parser decodes mini-program query values without mojibake", async () => {
  const { parsePlannerCriteria } = await loadDomain();
  const expected = {
    county: "于都县",
    startDate: "2026-10-01",
    days: 2,
    theme1: "长征文化",
    theme2: "群众支前",
    experience: "现场观察",
    purpose: "社会实践",
    travelMode: "self",
  };
  const encoded = Object.fromEntries(
    Object.entries(expected).map(([key, value]) => [key, encodeURIComponent(String(value))]),
  );
  const twiceEncoded = Object.fromEntries(
    Object.entries(encoded).map(([key, value]) => [key, encodeURIComponent(value)]),
  );

  assert.deepEqual(parsePlannerCriteria(encoded), expected);
  assert.deepEqual(parsePlannerCriteria(twiceEncoded), expected);
  assert.doesNotThrow(() => parsePlannerCriteria({ county: "%E4%A" }));
});

test("shared travel engine returns usable road and transit results", async () => {
  const { spots, travelEngine } = await loadDomain();
  const jinggangshan = spots.find((spot) => spot.id === "J01");
  const nanchang = spots.find((spot) => spot.id === "N01");
  assert.ok(jinggangshan && nanchang);

  const road = travelEngine.travel(jinggangshan, nanchang, "self");
  const transit = travelEngine.travel(jinggangshan, nanchang, "transit");

  assert.ok(road.minutes > 0 && road.km > 0);
  assert.ok(transit.minutes > 0 && transit.km > 0);
  assert.equal(transit.mode, "transit");
});
