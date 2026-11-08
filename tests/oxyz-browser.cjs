// Run against a running VPVie server with Playwright installed:
// node tests/oxyz-browser.cjs (optional VPVIE_TEST_URL / CHROMIUM_PATH / OXYZ_ARTIFACTS).
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1365, height: 705 },
        serviceWorkers: "block",
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      (process.env.VPVIE_TEST_URL || "http://127.0.0.1:8000") + "/bang.html",
    );
    await page.waitForFunction(() => window.__vp && window.VPOxyz);
    await page.evaluate(() => localStorage.removeItem("vpvie.book"));
    const board = await page.locator("#paper").boundingBox();
    async function open() {
      await page.locator("#btn-oxyz").click();
      await page.mouse.move(board.x + 90, board.y + 100);
      await page.mouse.down();
      await page.mouse.move(board.x + 640, board.y + 430, { steps: 5 });
      await page.mouse.up();
      await page.locator(".ox-studio").waitFor();
    }
    async function capture(name) {
      if (process.env.OXYZ_ARTIFACTS) {
        fs.mkdirSync(process.env.OXYZ_ARTIFACTS, { recursive: true });
        await page.screenshot({
          path: process.env.OXYZ_ARTIFACTS + "/" + name + ".png",
        });
      }
    }
    await open();
    await capture("empty");
    await page.locator('[data-kind="plane"]').first().click();
    await capture("plane");
    for (const name of ["A", "B", "C"])
      await page
        .getByRole("textbox", { name: "Hệ số " + name, exact: true })
        .fill("0");
    await page.locator("#ox-add button").click();
    assert.match(await page.locator("#ox-error").textContent(), /không được/);
    await page.locator('[data-tab="tools"]').click();
    const checks = [/u · v = -8/, /6.6667/, /I = \(2; 2; 2\)/, /Giao tuyến/];
    for (let i = 0; i < 4; i++) {
      await page.locator('[data-tool-index="' + i + '"]').click();
      await capture("tool-" + i);
      await page.locator("#ox-calculate button").click();
      assert.match(await page.locator("#ox-result").textContent(), checks[i]);
    }
    for (let i = 1; i <= 5; i++) {
      await page.locator("#ox-preset").selectOption(String(i));
      assert.ok((await page.locator(".ox-object").count()) >= 3);
      await capture("model-" + i);
    }
    await page.locator('[data-action="clear"]').click();
    // All six user-created types, with arithmetic and coordinates.
    for (const kind of [
      "point",
      "vector",
      "line",
      "plane",
      "sphere",
      "polygon",
    ]) {
      await page
        .locator('[data-kind="' + kind + '"]')
        .first()
        .click();
      if (kind === "point")
        await page.locator("#ox-p input").first().fill("sqrt(4)");
      await page.locator("#ox-add button").click();
      assert.equal(await page.locator("#ox-error").textContent(), "");
    }
    assert.equal(await page.locator(".ox-object").count(), 6);
    await page.locator('[data-edit="0"]').click();
    await page.locator("#ox-name").fill("A");
    await page.locator("#ox-add button").click();
    await page.locator("#ox-command-input").fill("H = project(A; P)");
    await page.locator("#ox-command button").last().click();
    assert.equal(await page.locator(".ox-object").count(), 7);
    await page.locator("#ox-command-input").fill("distance(A; P)");
    await page.locator("#ox-command button").last().click();
    assert.match(await page.locator("#ox-result").textContent(), /d\(A, P\)/);
    await page.locator('[data-visible="0"]').uncheck();
    await page.locator('[data-delete="1"]').click();
    assert.equal(await page.locator(".ox-object").count(), 6);
    for (const view of ["xy", "xz", "yz", "3d"])
      await page.locator('[data-view="' + view + '"]').click();
    for (const option of ["grid", "planes", "guides", "labels", "auto"]) {
      await page.locator('[data-display="' + option + '"]').click();
      await page.locator('[data-display="' + option + '"]').click();
    }
    const cv = await page.locator(".ox-stage canvas").boundingBox();
    await page.mouse.move(cv.x + 120, cv.y + 160);
    await page.mouse.down();
    await page.mouse.move(cv.x + 180, cv.y + 190, { steps: 4 });
    await page.mouse.up();
    await page.mouse.wheel(0, 200);
    await page.locator('[data-action="done"]').click();
    const inserted = await page.evaluate(() => window.__vp.state.items.at(-1));
    assert.equal(inserted.type, "oxyz");
    assert.equal(inserted.w, 550);
    assert.equal(inserted.h, 330);
    assert.equal(inserted.scene.objects.length, 6);
    assert.notEqual(inserted.scene.camera.yaw, 0.6);
    await page.keyboard.press("Control+z");
    assert.equal(await page.evaluate(() => window.__vp.state.items.length), 0);
    await page.keyboard.press("Control+y");
    assert.equal(await page.evaluate(() => window.__vp.state.items.length), 1);
    await page.mouse.dblclick(board.x + 130, board.y + 130);
    await page.locator(".ox-studio").waitFor();
    await page.locator('[data-action="clear"]').click();
    await page.locator('[data-action="cancel"]').click();
    assert.equal(
      await page.evaluate(
        () => window.__vp.state.items[0].scene.objects.length,
      ),
      6,
    );
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForFunction(() =>
      window.__vp?.state.items.some((i) => i.type === "oxyz"),
    );
    assert.equal(
      await page.evaluate(
        () => window.__vp.state.items[0].scene.objects.length,
      ),
      6,
    );
    await capture("board");
    await page.locator("#btn-select").click();
    await page.mouse.dblclick(board.x + 130, board.y + 130);
    await page.locator(".ox-studio").waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".ox-studio").count(), 0);
    await open();
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.__vp.state.items.length), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: drag region, six object forms, validation, four calculations, five models, commands, object editing/visibility/deletion, cameras, rotation/zoom, insert, undo/redo, cancel, reload, Escape; no browser errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
