// Requires a running VPVie server, Playwright and Chromium.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto((process.env.VPVIE_TEST_URL || 'http://127.0.0.1:8000') + '/bang.html');
    await page.locator('#btn-math').click();
    await page.locator('[data-cat="accent"]').click();
    const sixth = page.locator('#f-grid .fsym').nth(5);
    assert.equal(await sixth.getAttribute('title'), '\\dddot{}');
    async function rendered(selector) {
      const el = page.locator(selector);
      assert.equal(await el.locator('.katex-error').count(), 0);
      const html = await el.locator('.katex-html').textContent();
      assert.ok(!html.includes('\\dddot'), 'Unsupported LaTeX must not appear as red text');
      assert.ok(html.includes('⋯'), 'Three dots must be rendered above the base');
      assert.ok(await el.locator('mover').count() > 0, 'MathML must place dots above the base');
    }
    await rendered('#f-grid .fsym:nth-child(6)');
    await sixth.click();
    assert.equal(await page.locator('#math-input').inputValue(), '\\dddot{}');
    assert.equal(await page.locator('#math-input').evaluate(el => el.selectionStart), 7);
    await page.locator('#math-input').pressSequentially('x');
    assert.equal(await page.locator('#math-input').inputValue(), '\\dddot{x}');
    await rendered('#math-preview');
    await page.locator('#f-display').uncheck();
    await rendered('#math-preview');
    await page.locator('#math-input').fill('\\dddot{\\frac{x+1}{y}} + \\dddot{z}');
    await rendered('#math-preview');
    await page.locator('#math-ok').click();
    await rendered('.ov-math .ov-body');
    assert.equal(await page.evaluate(() => window.__vp.state.overlays[0].data.latex), '\\dddot{\\frac{x+1}{y}} + \\dddot{z}');
    await page.waitForTimeout(800);
    await page.reload();
    await page.locator('.ov-math').waitFor();
    await rendered('.ov-math .ov-body');
    if (process.env.FORMULA_SCREENSHOT) await page.screenshot({ path: process.env.FORMULA_SCREENSHOT });
    assert.deepEqual(errors, []);
    console.log('PASS: sixth accent tile, insertion/caret, preview, inline mode, nested/repeated dddot, board insertion and saved-book reload; no browser errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
