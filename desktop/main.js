// VPVie – Ứng dụng máy tính (Electron). Mở cửa sổ riêng, không cần trình duyệt.
// Khởi động: nếu có Python + phụ thuộc -> chạy máy chủ FastAPI (đủ AI máy chủ);
// nếu không -> chạy máy chủ tĩnh Node (đủ mọi tính năng ngoại tuyến).
'use strict';
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { startStaticServer } = require('./static-server');

const PORT = 8750;
const isPackaged = app.isPackaged;
// Thư mục mã nguồn: khi đóng gói nằm trong resources/, khi chạy dev nằm ở thư mục cha
const RES = isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const WEB_DIR = path.join(RES, 'web');
const PROJECT_DIR = RES; // chứa run.py + vpvie/

let backendProc = null;
let staticServer = null;
let win = null;

function httpOk(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs || 1200, () => { req.destroy(); resolve(false); });
  });
}
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function findPython() {
  for (const cmd of (process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'])) {
    try {
      const r = spawnSync(cmd, ['-c', 'import fastapi, uvicorn'], { timeout: 6000 });
      if (r.status === 0) return cmd;
    } catch (e) { /* bỏ qua */ }
  }
  return null;
}

async function startBackend() {
  // 1) Thử máy chủ Python (đủ AI). Chỉ khi có sẵn fastapi+uvicorn.
  const py = process.env.VPVIE_FORCE_OFFLINE ? null : findPython();
  if (py) {
    try {
      backendProc = spawn(py, [path.join(PROJECT_DIR, 'run.py')], {
        cwd: PROJECT_DIR,
        env: Object.assign({}, process.env, { PORT: String(PORT), PYTHONPATH: PROJECT_DIR, PYTHONUNBUFFERED: '1' }),
        stdio: 'ignore'
      });
      backendProc.on('error', () => { backendProc = null; });
      for (let i = 0; i < 30; i++) { // chờ tối đa ~9s
        await wait(300);
        if (await httpOk(`http://127.0.0.1:${PORT}/api/health`, 800)) return { mode: 'python' };
      }
      // không lên được -> tắt và chuyển sang tĩnh
      try { backendProc && backendProc.kill(); } catch (e) {}
      backendProc = null;
    } catch (e) { backendProc = null; }
  }
  // 2) Máy chủ tĩnh Node (ngoại tuyến, vẫn đủ mọi tính năng không cần máy chủ)
  staticServer = await startStaticServer(WEB_DIR, PORT);
  return { mode: 'offline' };
}

function buildMenu() {
  const template = [
    { label: 'Tệp', submenu: [{ role: 'reload', label: 'Tải lại' }, { type: 'separator' }, { role: 'quit', label: 'Thoát' }] },
    { label: 'Sửa', submenu: [{ role: 'undo', label: 'Hoàn tác' }, { role: 'redo', label: 'Làm lại' }, { type: 'separator' }, { role: 'cut', label: 'Cắt' }, { role: 'copy', label: 'Sao chép' }, { role: 'paste', label: 'Dán' }, { role: 'selectAll', label: 'Chọn tất cả' }] },
    { label: 'Hiển thị', submenu: [{ role: 'resetZoom', label: 'Thu phóng 100%' }, { role: 'zoomIn', label: 'Phóng to' }, { role: 'zoomOut', label: 'Thu nhỏ' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Toàn màn hình' }] },
    { label: 'Trợ giúp', submenu: [{ label: 'Giới thiệu VPVie', click: () => dialog.showMessageBox(win, { title: 'VPVie', message: 'VPVie – Bảng dạy học', detail: 'Phần mềm văn phòng + dạy học tiếng Việt, mã nguồn mở.' }) }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1024, minHeight: 680,
    title: 'VPVie – Bảng dạy học', backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  // mở liên kết ngoài bằng trình duyệt mặc định
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) { shell.openExternal(url); return { action: 'deny' }; } return { action: 'allow' }; });
  buildMenu();
  const info = await startBackend();
  await win.loadURL(`http://127.0.0.1:${PORT}/bang.html`);
  win.setTitle('VPVie – Bảng dạy học' + (info.mode === 'offline' ? ' (ngoại tuyến)' : ''));
  // Smoke-test: chụp màn hình rồi thoát (chỉ khi đặt biến môi trường VPVIE_SMOKE)
  if (process.env.VPVIE_SMOKE) {
    try {
      await wait(2500);
      const img = await win.webContents.capturePage();
      require('fs').writeFileSync(process.env.VPVIE_SMOKE, img.toPNG());
      const title = await win.webContents.executeJavaScript('document.title');
      const hasCanvas = await win.webContents.executeJavaScript('!!document.getElementById("paper")');
      console.log('SMOKE_RESULT ' + JSON.stringify({ mode: info.mode, title: title, hasCanvas: hasCanvas }));
    } catch (e) { console.log('SMOKE_ERR ' + e.message); }
    app.quit();
  }
}

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
function cleanup() { try { backendProc && backendProc.kill(); } catch (e) {} try { staticServer && staticServer.close(); } catch (e) {} }
app.on('before-quit', cleanup);
process.on('exit', cleanup);
