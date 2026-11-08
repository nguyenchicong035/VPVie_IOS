// VPVie – Trình cấp key (ứng dụng độc lập cho người phát hành).
// Bấm đúp mở cửa sổ, nhớ khoá riêng (mã hoá bằng OS), cấp key 1 máy / nhiều máy,
// lưu nhật ký. Ký số ECDSA P-256 ieee-p1363 — khớp với bộ kiểm trong VPVie.
'use strict';
const { app, BrowserWindow, ipcMain, Menu, dialog, clipboard, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let win = null;
const DIR = app.getPath('userData');
const KEY_ENC = path.join(DIR, 'key.enc');     // khoá riêng đã mã hoá (safeStorage)
const KEY_PLAIN = path.join(DIR, 'key.b64');   // dự phòng khi OS không hỗ trợ mã hoá
const LOG_FILE = path.join(DIR, 'issued.json');

const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ---- Lưu / đọc khoá riêng (ưu tiên mã hoá bằng OS) ----
function savePriv(b64) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(KEY_ENC, safeStorage.encryptString(b64));
      if (fs.existsSync(KEY_PLAIN)) fs.unlinkSync(KEY_PLAIN);
      return;
    }
  } catch (e) { /* rơi xuống lưu thường */ }
  fs.writeFileSync(KEY_PLAIN, b64, 'utf8');
}
function loadPriv() {
  try { if (fs.existsSync(KEY_ENC)) return safeStorage.decryptString(fs.readFileSync(KEY_ENC)); } catch (e) {}
  try { if (fs.existsSync(KEY_PLAIN)) return fs.readFileSync(KEY_PLAIN, 'utf8').trim(); } catch (e) {}
  return null;
}
function privKeyObj() {
  const b64 = loadPriv();
  if (!b64) return null;
  return crypto.createPrivateKey({ key: b64, format: 'der', type: 'pkcs8', encoding: 'base64' });
}
function publicB64url() {
  const pk = privKeyObj(); if (!pk) return null;
  return b64u(crypto.createPublicKey(pk).export({ type: 'spki', format: 'der' }));
}

// ---- Ký key ----
function sign(payload) {
  const pk = privKeyObj(); if (!pk) throw new Error('Chưa có khoá riêng.');
  const pbytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.sign('sha256', pbytes, { key: pk, dsaEncoding: 'ieee-p1363' });
  return 'VPL1.' + b64u(pbytes) + '.' + b64u(sig);
}

// ---- Nhật ký ----
function readLog() { try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (e) { return []; } }
function writeLog(l) { try { fs.writeFileSync(LOG_FILE, JSON.stringify(l, null, 0)); } catch (e) {} }
function addLog(entry) { const l = readLog(); l.unshift(entry); writeLog(l); }

// ---- IPC ----
ipcMain.handle('status', () => ({ hasKey: !!loadPriv(), publicKey: publicB64url(), encrypted: (() => { try { return safeStorage.isEncryptionAvailable(); } catch (e) { return false; } })() }));
ipcMain.handle('generate', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  savePriv(privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'));
  return { ok: true, publicKey: b64u(publicKey.export({ type: 'spki', format: 'der' })) };
});
ipcMain.handle('import', (e, b64) => {
  try {
    const pk = crypto.createPrivateKey({ key: (b64 || '').trim(), format: 'der', type: 'pkcs8', encoding: 'base64' });
    savePriv((b64 || '').trim());
    return { ok: true, publicKey: b64u(crypto.createPublicKey(pk).export({ type: 'spki', format: 'der' })) };
  } catch (err) { return { ok: false, error: 'Khoá riêng không hợp lệ.' }; }
});
ipcMain.handle('issueSingle', (e, p) => {
  const mid = String(p.mid || '').trim().toUpperCase();
  if (!/^VPV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(mid)) return { ok: false, error: 'Mã máy sai định dạng (VPV-XXXX-XXXX-XXXX).' };
  const days = parseInt(p.days, 10) || 0;
  const payload = { m: mid, p: p.plan || 'pro', e: days > 0 ? Math.floor(Date.now() / 1000) + days * 86400 : 0 };
  if (p.note) payload.n = p.note;
  try {
    const key = sign(payload);
    addLog({ t: Date.now(), kind: 'single', mid, plan: payload.p, e: payload.e, note: p.note || '', key });
    return { ok: true, key };
  } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('issueMulti', (e, p) => {
  const maxm = parseInt(p.maxm, 10) || 1;
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const days = parseInt(p.days, 10) || 0;
  const payload = { id, p: p.plan || 'pro', e: days > 0 ? Math.floor(Date.now() / 1000) + days * 86400 : 0, maxm };
  if (p.note) payload.n = p.note;
  try {
    const key = sign(payload);
    addLog({ t: Date.now(), kind: 'multi', id, maxm, plan: payload.p, e: payload.e, note: p.note || '', key });
    return { ok: true, key, id };
  } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('log', () => readLog());
ipcMain.handle('clearLog', () => { writeLog([]); return { ok: true }; });
ipcMain.handle('copy', (e, text) => { clipboard.writeText(text || ''); return { ok: true }; });
ipcMain.handle('exportPrivate', async () => {
  const b64 = loadPriv(); if (!b64) return { ok: false };
  const r = await dialog.showSaveDialog(win, { title: 'Sao lưu khoá riêng', defaultPath: 'private-key.b64' });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, b64, 'utf8');
  return { ok: true, path: r.filePath };
});
ipcMain.handle('importFile', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Chọn tệp khoá riêng', filters: [{ name: 'Khoá', extensions: ['b64', 'txt'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  return { ok: true, content: fs.readFileSync(r.filePaths[0], 'utf8').trim() };
});

function createWindow() {
  win = new BrowserWindow({
    width: 760, height: 820, minWidth: 560, minHeight: 600,
    title: 'VPVie – Trình cấp key', backgroundColor: '#f6f7f9',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  if (process.env.VPVIE_SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      try {
        let issued = null, pub = null;
        if (process.env.VPVIE_SMOKE_PRIV) {
          const b64 = fs.readFileSync(process.env.VPVIE_SMOKE_PRIV, 'utf8').trim();
          const imp = await win.webContents.executeJavaScript('window.KT.importKey(' + JSON.stringify(b64) + ')');
          pub = imp.publicKey;
          const r = await win.webContents.executeJavaScript('window.KT.issueSingle({mid:"VPV-ABCD-EFGH-JKLM",plan:"pro",days:30,note:"Smoke"})');
          issued = r.key;
        }
        const img = await win.webContents.capturePage();
        fs.writeFileSync(process.env.VPVIE_SMOKE, img.toPNG());
        const g = await win.webContents.executeJavaScript('(async()=>{const s=await window.KT.status();return {title:document.title, hasKeyUI:!!document.getElementById("gen")}})()');
        console.log('SMOKE_RESULT ' + JSON.stringify(Object.assign(g, { issued, pub })));
      } catch (e) { console.log('SMOKE_ERR ' + e.message); }
      app.quit();
    });
  }
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
