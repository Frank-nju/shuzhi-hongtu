import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const miniRoot = path.join(root, "miniprogram");

const readMini = (file) => fs.readFileSync(path.join(miniRoot, file), "utf8");

test("mini-program packages all 44 original landmark artworks", () => {
  const originalFiles = fs.readdirSync(path.join(root, "public", "landmarks"))
    .filter((file) => file.endsWith(".webp"))
    .sort();
  const miniFiles = fs.readdirSync(path.join(miniRoot, "src", "assets", "landmarks"))
    .filter((file) => file.endsWith(".webp"))
    .sort();

  assert.equal(originalFiles.length, 44);
  assert.deepEqual(miniFiles, originalFiles);

  const config = readMini("config/index.ts");
  assert.match(config, /src\/assets\/landmarks/);
  assert.match(config, /dist\/landmarks/);
});

test("home page lazy-loads the complete cloud landmark gallery", () => {
  const home = readMini("src/pages/index/index.tsx");
  const galleryImage = home.match(/<CloudImage[^>]+className='landmark-image'[^>]+\/>/)?.[0] ?? "";

  assert.match(home, /landmarkColumns/);
  assert.match(home, /spot\.image/);
  assert.ok(galleryImage);
  assert.match(galleryImage, /lazyLoad/);
  assert.match(home, /完整\s*44\s*处/);
});

test("landmark catalogue uses real artwork for every spot", () => {
  const catalogue = readMini("src/pages/landmarks/index.tsx");

  assert.match(catalogue, /src=\{spot\.image\}/);
  assert.match(catalogue, /lazyLoad/);
  assert.doesNotMatch(catalogue, /featuredSpotImages|spot-placeholder/);
});

test("planner choices use a compatibility-safe two-column layout", () => {
  const stylesheet = readMini("src/pages/planner/index.scss");
  const fieldRule = stylesheet.match(/\.planner-field\s*\{([^}]*)\}/s)?.[1] ?? "";

  assert.match(fieldRule, /width:\s*48%/);
  assert.match(fieldRule, /flex:\s*0\s+0\s+48%/);
  assert.doesNotMatch(fieldRule, /calc\(/);
});

test("rounded action controls stay consistent, protected and overflow-safe", () => {
  const appStyles = readMini("src/app.scss");
  const actionPill = readMini("src/components/action-pill/index.tsx");
  const actionPillStyles = readMini("src/components/action-pill/index.scss");
  const home = readMini("src/pages/index/index.tsx");
  const homeStyles = readMini("src/pages/index/index.scss");
  const detail = readMini("src/pages/route-detail/index.tsx");
  const detailStyles = readMini("src/pages/route-detail/index.scss");
  const routes = readMini("src/pages/routes/index.tsx");
  const routesStyles = readMini("src/pages/routes/index.scss");
  const landmark = readMini("src/pages/landmark-detail/index.tsx");
  const landmarkStyles = readMini("src/pages/landmark-detail/index.scss");
  const methodActionsRule = homeStyles.match(/\.method-actions\s*\{([^}]*)\}/s)?.[1] ?? "";
  const editActionsRule = detailStyles.match(/\.edit-actions\s*\{([^}]*)\}/s)?.[1] ?? "";

  assert.match(appStyles, /\.tap-button::after/);
  assert.doesNotMatch(appStyles, /(?:^|\n)button(?:,|\s*\{|::)/m);
  assert.match(actionPill, /action-pill-primary/);
  assert.match(actionPill, /action-pill-tonal/);
  assert.match(actionPill, /action-pill-outline/);
  assert.match(actionPill, /action-pill-danger/);
  assert.match(actionPill, /action-pill-disabled/);
  assert.match(actionPill, /<Button/);
  assert.match(actionPill, /disabled=\{disabled\}/);
  assert.match(actionPill, /ariaLabel=\{children\}/);
  assert.match(actionPill, /hoverClass/);
  assert.match(actionPillStyles, /border-radius:\s*999rpx/);
  assert.match(actionPillStyles, /min-height:\s*88rpx/);
  assert.match(actionPillStyles, /\.action-pill::after/);
  assert.match(actionPillStyles, /linear-gradient/);
  assert.match(actionPillStyles, /\.action-pill-pressed/);
  assert.match(home, /<ActionPill[^>]+variant='primary'/);
  assert.match(home, /<ActionPill[^>]+variant='tonal'/);
  assert.match(methodActionsRule, /flex-direction:\s*column/);
  assert.match(detail, /disabled=\{spot\.core\}/);
  assert.match(detail, /核心节点/);
  assert.match(detail, /spot-quick-actions/);
  assert.doesNotMatch(detail, /!spot\.core\s*&&/);
  assert.doesNotMatch(detail, /stop-side-actions/);
  assert.match(editActionsRule, /flex-wrap:\s*wrap/);
  assert.match(routes, /history-return-button/);
  assert.doesNotMatch(routesStyles, /\.history-route-summary\s*>\s*button/);
  assert.match(landmark, /visit-action/);
  assert.match(landmark, /detail-missing-action/);
  assert.doesNotMatch(landmarkStyles, /(?:\.visit-actions|\.detail-missing)\s+button/);
});

test("Ferrari glass visual system covers every mini-program page", () => {
  const pageStyles = [
    "src/pages/index/index.scss",
    "src/pages/planner/index.scss",
    "src/pages/routes/index.scss",
    "src/pages/landmarks/index.scss",
    "src/pages/saved/index.scss",
    "src/pages/route-detail/index.scss",
    "src/pages/landmark-detail/index.scss",
    "src/pages/history/index.scss",
    "src/pages/methodology/index.scss",
  ];

  for (const file of pageStyles) {
    const stylesheet = readMini(file);
    assert.match(stylesheet, /#da291c/i, `${file} should use Ferrari red`);
    assert.match(stylesheet, /border-radius:\s*(?:2[4-9]|3\d|4[0-4])rpx/, `${file} should include rounded surfaces`);
    assert.match(stylesheet, /linear-gradient/, `${file} should include layered gradients`);
  }

  const appConfig = readMini("src/app.config.ts");
  assert.match(appConfig, /navigationBarBackgroundColor:\s*['"]#fffaf7['"]/);
  assert.match(appConfig, /selectedColor:\s*['"]#da291c['"]/);
});
