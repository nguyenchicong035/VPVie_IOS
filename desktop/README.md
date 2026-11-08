# VPVie – Ứng dụng máy tính (Electron) & cài trên iPad (PWA)

VPVie chạy được ở **3 dạng**, dùng chung một bộ mã giao diện:

| Dạng | Thiết bị | Cách |
|---|---|---|
| **Ứng dụng máy tính** | Windows / macOS / Linux | Electron → `.exe` / `.dmg` / `.AppImage` |
| **Cài như app (PWA)** | iPad, iPhone, Android, máy tính | Mở trong trình duyệt → "Thêm vào màn hình chính" |
| **Web** | mọi nơi | Mở bằng trình duyệt |

## A. Ứng dụng máy tính (.exe cho Windows)

Cần **Node.js 18+** trên máy build.

```bash
cd desktop
npm install
npm run dist:win     # tạo bộ cài .exe (NSIS) + .msi trong desktop/dist/
```
- `npm start` để chạy thử ngay (không đóng gói).
- `npm run dist` build cho hệ điều hành hiện tại; `dist:win` ép Windows.
- Kết quả: `desktop/dist/VPVie Setup x.y.z.exe` — gửi cho người dùng bấm đúp cài.

**AI khi chạy app:** nếu máy người dùng có **Python + fastapi/uvicorn**, app tự chạy
máy chủ AI nội bộ (nhận dạng qua máy chủ). Nếu không, app vẫn chạy **đầy đủ ngoại
tuyến** (vẽ, nắn nét, công thức, đồ thị, nhận dạng theo nét, OCR Tesseract, bản
quyền, xuất PNG/PDF). Ép ngoại tuyến bằng biến môi trường `VPVIE_FORCE_OFFLINE=1`.

> Lưu ý: build `.exe` phải chạy **trên Windows** (hoặc dùng CI Windows). Build `.dmg`
> trên macOS, `.AppImage` trên Linux. electron-builder không build chéo sang Windows
> từ Linux một cách ổn định.

## B. Cài trên iPad / iPhone / Android (PWA)

1. Mở địa chỉ VPVie bằng trình duyệt (Safari trên iPad, Chrome trên Android).
2. **iPad/iPhone:** nút Chia sẻ → **Thêm vào màn hình chính**.
   **Android:** menu ⋮ → **Cài ứng dụng** / **Thêm vào màn hình chính**.
3. Mở từ biểu tượng → chạy toàn màn hình như app, **offline được** (service worker).

PWA cần phục vụ qua **HTTPS** (hoặc `localhost`). Khi đưa lên mạng, dùng tên miền có
HTTPS thì iPad mới cài được.

## Biểu tượng
`desktop/build/icon.ico` (Windows), `icon.png` (mac/Linux), `web/icons/*` (PWA).
Thay bằng logo của bạn nếu muốn, giữ nguyên tên tệp.
