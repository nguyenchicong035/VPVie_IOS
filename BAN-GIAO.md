# BIÊN BẢN BÀN GIAO CÔNG VIỆC — Phần mềm VPVie

> Tài liệu để chuyển giao cho người/tài khoản tiếp theo. Cập nhật lần cuối: xem commit mới nhất.
> Kho mã: **github.com/nguyenchicong035/vpvie** — nhánh làm việc: **main**.

---

## 1. Tổng quan dự án

**VPVie** là bộ ứng dụng văn phòng + dạy học tiếng Việt, AI nguồn mở miễn phí, thân thiện với người dùng Việt Nam.

Trọng tâm hiện tại (theo yêu cầu người dùng) là **Bảng dạy học** (`/bang.html`) — dựng lại **giống 100% phần mềm NoteRenderer** mà người dùng gửi ảnh mẫu, đồng thời phát triển **AI nhận diện nét vẽ**.

Ràng buộc quan trọng (người dùng đã nêu, phải giữ):
- **Giao diện tiếng Việt**, thân thiện người dùng Việt.
- **AI phải là mã nguồn mở, miễn phí, lấy từ kho công khai trên GitHub** (Tesseract.js trong trình duyệt; Ollama chạy máy chủ cục bộ; Claude chỉ là tùy chọn).
- **Không dùng CDN ngoài** trong trình duyệt (bị chặn trong môi trường) → mọi thư viện đã **vendor cục bộ** vào `web/vendor/`.
- Giao diện phải **giống 100% ảnh NoteRenderer** người dùng gửi.

---

## 2. Cách chạy & kiểm thử (BẮT BUỘC đọc)

### Chạy máy chủ
```bash
cd /home/user/vpvie
PYTHONPATH=/home/user/vpvie PORT=8011 python3 run.py
# Mở http://127.0.0.1:8011/bang.html  (bảng dạy học)
#     http://127.0.0.1:8011/          (trang chủ bộ office)
```
Backend: FastAPI + uvicorn, phục vụ tĩnh thư mục `web/` + các API AI.

### Quy trình phát triển đã áp dụng (giữ nguyên)
Mỗi tính năng: **sửa mã → kiểm thử bằng Playwright (Chromium thật, headless) → chụp màn hình đối chiếu ảnh mẫu → commit → push → báo người dùng kèm ảnh.** Không commit khi chưa chạy qua trình duyệt thật.

Mẫu script kiểm thử (đặt ở thư mục scratch, KHÔNG commit):
```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args:['--no-sandbox'] });
  const pg = await b.newPage({ viewport:{width:1280,height:820}, deviceScaleFactor:2 });
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await pg.goto('http://127.0.0.1:8011/bang.html',{waitUntil:'networkidle'});
  // ... thao tác ...
  await pg.screenshot({path:'/tmp/.../shot.png'});
  console.log(JSON.stringify({errs}));
  await b.close();
})();
```
Chạy từ `web/` để `require('playwright')` thấy được (Chromium + Playwright đã cài sẵn trong môi trường; `--no-sandbox`).
`window.__vp` được app.js phơi ra cho kiểm thử: `state, insertMath, insertPlot, redraw, gotoPage, addPage, pages(), cur()`.

### Quy ước commit (BẮT BUỘC)
Cuối mỗi commit message thêm 2 dòng:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jsa3PakQPUPdCVENJgtnyX
```
(Người kế nhiệm dùng phiên/định danh của mình.) Author git dùng: `user.email=nguyenchicong035@gmail.com`, `user.name="Nguyen Chi Cong"`.

---

## 3. Kiến trúc mã nguồn

### Backend — `vpvie/`
- `server/app.py` — FastAPI: phục vụ `web/`, `GET /api/health`, `POST /api/recognize` (ảnh→chữ/LaTeX), `POST /api/assist` (tác vụ văn bản), `POST /api/slides` (AI tạo slide).
- `ai/recognize.py` — provider động theo env `VPVIE_AI_PROVIDER` (mặc định "ollama"); `_ollama_model()` mặc định "qwen2.5vl:7b". Hàm: `available()`, `provider_info()`, `recognize(image_b64, mode)`.
- `ai/assist.py` — `TEXT_MODEL="qwen2.5:7b"`, PROMPTS (rewrite/summarize/fix/continue/expand/translate_en).
- `ai/slides.py` — `generate(topic, n)`.

### Frontend bảng dạy học — `web/bang.html` + `web/js/`
HTML `bang.html`: thanh tiêu đề `.nr-title`, **3 hàng công cụ** `.nr-row` (biểu tượng đơn sắc, công cụ chọn nền đỏ booc-đô `--maroon #7a1020`), `.nr-main` (danh sách trang trái + `#board` canvas), tab `.nr-sheets`. Các hộp thoại: `#dlg-math` (bộ công thức), `#dlg-plot`, `#dlg-shapes`, `#dlg-solid`, `#dlg-var`, `#dlg-quiz`, `#dlg-settings` (3 cột), `#dlg-sci` (công cụ môn Tự nhiên), menu `#arrow-menu`.

**`js/app.js`** (lõi — quan trọng nhất):
- `state`: `tool, color, size, pen, beautify, items[], overlays[], paper{}, opt{}, selected[], selBox, ...`.
- Vẽ canvas: `drawPaper()` (kẻ dòng/ô vuông/chấm/trơn + lề + ô tiêu đề + số trang + **nền ảnh/PDF** `state.pageBg`), `drawItem()` (stroke theo bút bi/dạ/chì/dạ-quang; line, rect, triangle, circle, ellipse, poly, path, **arrow** `drawArrow()`, solid; **tô nền** `it.fill`), `redraw()`.
- Công cụ: bút (pen types), tẩy (`eraseAt`), **mũi tên** (type "arrow", 5 kiểu: arrow/darrow/dash/dim/brace), **tô màu miền** (`fillAt`+`containsPoint`+`inPoly`), **chọn vùng** (marquee→`state.selected`, kéo `translateItem`, Delete xoá), pan.
- Overlay (lớp phủ dữ liệu, kéo được): `overlayBody(kind,...)` phân nhánh math/text/plot/calc/quiz/var/note/timer/picker/ptable/chem/**circuit/force/pedigree/dna**/table/web. `addOverlayData`, `renderOverlays`, `makeDraggable`.
- Trang & sổ: `pages[]`, `cur`, `capture/restore/gotoPage/addPage/delPage/movePage`, `snapshotThumb/makeThumbs` (thumbnail), lưu `localStorage "vpvie.book"`, mở/lưu tệp `.vpvie.json`.
- Cài đặt: `loadSettings/saveSettings` (`localStorage "vpvie.settings"`), đồng bộ UI 3 cột, nhập ảnh/PDF làm nền (`setPageBg`, pdf.js), **quay màn hình** (`toggleRecord`, getDisplayMedia+mic).
- AI nhận dạng: nút `#btn-ai` → `VPRecognize.recognizeTesseract(cropForOCR(), cb, {math,psm})` hoặc server; chèn chữ/LaTeX, thay nét.

**Các module công cụ** (`window.VP*`):
- `recognize.js` → `VPRecognize`: **tiền xử lý Otsu + giãn nở nét**, Tesseract (vie+eng, whitelist tiếng Việt+toán, PSM), trả `confidence`.
- `beautify.js` → `VPBeautify`: nắn nét tay thành đường thẳng/hình (tròn dựa độ lệch bán kính).
- `tools-geo.js` → `VPGeo`: hình học động (điểm/đoạn/đường/tròn + trung điểm/trung trực/phân giác + trọng tâm/trực tâm/tâm ngoại-nội; điểm dẫn xuất tính lại mỗi khung).
- `tools-grapher.js` → `VPGrapher.draw()`: **đồ thị như sách** (trục mũi tên, lưới bước đẹp, đỉnh/giao trục/tiệm cận/đường gióng, **tô miền nghiệm** bất PT & hệ).
- `tools-calc.js` → `VPCalc.buildGraph/buildSciCalc` (dùng VPGrapher + thanh trượt tham số).
- `tools-sci.js` → `VPSci`: máy tính fx-580 hiển thị tự nhiên.
- `tools-var.js` → `VPVar`: bảng biến thiên/xét dấu (đạo hàm tự động math.js).
- `tools-solid.js` → `VPSolid.make`: hình không gian 3D (nét khuất đứt).
- `tools-class.js` → `VPClass.buildTimer/buildPicker`: đồng hồ + gọi tên.
- `tools-quiz.js` → `VPQuiz.buildMCQ/buildTF`.
- `tools-formula.js` → `VPFormula`: **bộ công thức 19 danh mục, ~471 ký hiệu** render KaTeX, tìm kiếm, mẫu nhanh, màu/cỡ/display/Toán-Văn bản. `CATS[]` là dữ liệu chính.
- `tools-science.js` → `VPScience`: bảng tuần hoàn 118 nguyên tố + cân bằng phương trình hoá (`balance()` dùng khử Gauss tìm vector null).
- `tools-diagram.js` → `VPDiagram.build(body,kind)`: SVG mạch điện/sơ đồ lực/phả hệ/ADN (mỗi loại có `VARIANTS`).
- `tools-ruler.js` → `VPRuler.toggle(board)`: thước đo góc ảo (xoay/đổi dài).
- `tools-export.js` → `VPExport.png/pdf` (html2canvas + jsPDF).
- `mathplot.js` → `VPMathPlot.renderMath/plot`.

### Thư viện vendor (`web/vendor/`) — nguồn mở, cục bộ
katex, function-plot (kèm d3), math.min.js (mathjs UMD `lib/browser/math.js`), jspdf.umd.min.js, html2canvas.min.js, tesseract (core wasm LSTM + vie/eng traineddata tessdata_fast), marked.min.js, pdfjs (pdf.min.js + pdf.worker.min.js). **Lưu ý:** mathjs phải là bản `lib/browser/math.js` (~724KB), KHÔNG dùng `dist/math.min.js` (chỉ là stub 4KB).

### Bộ Office (đã làm, hiện giảm ưu tiên nhưng vẫn chạy)
`index.html` + `soanthao.html`(office-doc.js) + `markdown.html` + `htmledit.html` + `bangtinh.html`(office-sheet.js+sheet-engine.js) + `trinhchieu.html`(office-slides.js) + `pdf.html`(office-pdf.js). CSS `web/office.css`.

---

## 4. ĐÃ HOÀN THÀNH (đều kiểm thử trình duyệt thật, đã push)

| Nhóm | Tính năng |
|---|---|
| Giao diện | Thanh 3 hàng NoteRenderer, Cài đặt 3 cột (giấy/hình vẽ/môn dạy), danh sách trang, tab Sheet, ô tiêu đề + lề, thước đo góc, quay màn hình + micro |
| Viết tay | Bút bi/chì/dạ/dạ-quang theo lực nhấn; giữ tay → nắn thẳng/thành hình (beautify) |
| AI | Nhận diện nét vẽ → chữ (Otsu + Tesseract tiếng Việt, báo độ tin cậy) |
| Toán | Đồ thị như sách (đỉnh/giao/tiệm cận/miền nghiệm), bảng biến thiên, **bộ công thức 471 ký hiệu/19 danh mục**, hình 2D (14 mẫu) & 3D |
| Hoá | Bảng tuần hoàn 118 nguyên tố, cân bằng phương trình tự động |
| Lý | Mạch điện (nối tiếp/song song), sơ đồ lực (ngang/nghiêng/treo) |
| Sinh | Phả hệ, phân tử ADN |
| Vẽ | Mũi tên/đoạn đo/ngoặc (menu kiểu), tô màu miền, chọn vùng (di chuyển/xoá) |
| Tài liệu | Mở PDF/ảnh viết đè lên đề; xuất PNG/PDF; lưu/mở sổ bài giảng |
| Lớp học | Đồng hồ đếm ngược, gọi tên ngẫu nhiên, câu hỏi trắc nghiệm, giấy note, bảng, trình duyệt web nhúng |

---

## 5. CÒN LẠI (chưa làm) + hướng triển khai

1. ~~Nhân bản & menu ngữ cảnh đối tượng~~ — **ĐÃ XONG** (menu chuột phải: Sao chép/Cắt/Dán/Nhân bản/Đưa lên-xuống/Tô/Viền/Chọn tất cả/Xoá; phím tắt Ctrl+C/X/V/D/A/Z/Y, Delete, mũi tên dịch chuyển; undo/redo thật bằng snapshot).
2. ~~Menu thả xuống (▾) cho bút/tẩy~~ — **ĐÃ XONG** (`#pen-menu`: loại bút/độ dày/làm đẹp; `#eraser-menu`: tẩy cả nét / một phần nét / tẩy vùng / xoá nét tay / xoá trang). *Còn lại: menu ▾ cho nhóm Hình nếu muốn.*
3. ~~Mở Word (.docx) để viết đè~~ — **ĐÃ XONG** (vendor `mammoth.browser.min.js` → HTML → html2canvas → `setPageBg`; nút "Thêm từ Word…" trong Cài đặt).
4. ~~Đồng bộ Google Drive~~ — **ĐÃ XONG** (`web/js/gdrive.js` → `VPDrive`): Google Identity Services + Drive REST, quyền `drive.file`, lưu/mở sổ JSON `so-bai-giang.vpvie.json`. Nút "☁ Google Drive" trên thanh tiêu đề mở hộp thoại: Đăng nhập / Lưu lên Drive / Mở từ Drive / Đăng xuất + ô dán Client ID. **Người dùng tự tạo OAuth Client ID** (Web app, bật Drive API, thêm origin) rồi dán vào (Client ID không phải bí mật, không nhúng sẵn). *Đã test: UI + luồng tới bước consent của Google; đăng nhập thật cần trình duyệt thật của người dùng.*
5. **Miền nghiệm nâng cao / TikZ** — dán đề TikZ hiện chưa parse (chỉ LaTeX/KaTeX). Khó; cân nhắc bỏ qua.
6. ~~Nhận diện chữ viết tay bằng nét (online recognition)~~ — **ĐÃ LÀM** (`web/js/ink-recognize.js` → `VPInk`): thuật toán **$P Point-Cloud Recognizer** (nguồn mở) nhận dạng **theo quỹ đạo nét**, bộ mẫu sẵn cho chữ số 0-9 + toán tử + vài chữ cái, **học thêm nét của người dùng** (lưu localStorage, hộp thoại ✍ Dạy nét). Engine "Theo nét" trong menu Nhận dạng; `recognizeItems` gom nét → biểu thức (phát hiện mũ ^). Mạnh với chữ số/ký hiệu toán & học được kiểu viết riêng; chính xác hơn Tesseract cho chữ tay rời.

---

## 5b. AI nhận diện — 3 provider (chọn cái mạnh nhất cho máy của bạn)

Trọng tâm: **nhận diện công thức toán viết tay → LaTeX** + **chữ viết tay tiếng Việt**.

| Engine (web) | Provider backend | Cài đặt | Độ mạnh với TOÁN viết tay |
|---|---|---|---|
| "AI Tesseract (miễn phí)" | (chạy trong trình duyệt) | Không cần | Thấp – chỉ ra **bản nháp LaTeX** để sửa (Tesseract là OCR chữ in). Có hậu xử lý `mathToLatex`. |
| "Máy chủ" + `VPVIE_AI_PROVIDER=ollama` (mặc định) | Ollama + `qwen2.5vl:7b` (mô hình thị giác nguồn mở) | `ollama run qwen2.5vl:7b` | **Cao** – khuyến nghị. Hiểu công thức 2D + chữ Việt. |
| "Máy chủ" + `VPVIE_AI_PROVIDER=pix2tex` | pix2tex (LaTeX-OCR, nguồn mở) | `pip install "pix2tex[api]"` (kéo torch; tải trọng số lần đầu) | **Cao cho công thức** (mạnh với công thức in/chuẩn; viết tay khá). Chỉ ra LaTeX. |
| "Máy chủ" + `VPVIE_AI_PROVIDER=anthropic` | Claude (tùy chọn, cần API key) | `ANTHROPIC_API_KEY=...` | Rất cao (không miễn phí). |

- Web tự chọn engine **"Máy chủ"** khi `/api/health` báo `ai:true`, và hiện nhãn provider trên thanh tiêu đề.
- Engine "Máy chủ" **không phụ thuộc provider**: đổi provider chỉ bằng biến môi trường `VPVIE_AI_PROVIDER`, không sửa code.
- Mã provider: `vpvie/ai/recognize.py` — `_ollama`, `_pix2tex` (lazy `LatexOCR`), `_anthropic`. Prompt máy chủ đã tăng cường cho LaTeX (lũy thừa/phân số/căn/tích phân/nguyên hàm/đạo hàm/giới hạn/hệ PT/ma trận) + giữ dấu tiếng Việt.
- Web: `recognize.js` có `preprocess` (Otsu + giãn nét), `mathToLatex`, `looksMath`; `app.js` tách dòng (`strokeLines`) cho chữ Việt, chế độ math mở bộ công thức.
- **Muốn AI mạnh nhất mà vẫn miễn phí:** chạy Ollama với `qwen2.5vl` (hoặc model thị giác lớn hơn nếu máy đủ khỏe), hoặc bật pix2tex cho riêng công thức.

## 5c. Bản quyền theo máy & chống crack (MỚI)

Hệ thống cấp phép gắn **theo từng máy**, ký số **ECDSA P-256**, chạy **ngoại tuyến**.

**Luồng:** máy tính ra *Mã máy* `VPV-XXXX-XXXX-XXXX` (vân tay trình duyệt+phần cứng,
băm SHA-256) → người phát hành ký ra *Key* `VPL1.<payload>.<chữ ký>` gắn đúng Mã máy →
người dùng dán vào nút **🔑 Kích hoạt**. App chỉ nhúng **khoá công khai** để kiểm tra.

**Tệp:**
- `web/js/license.js` → `VPLicense` (machineId / check / activate / deactivate / isPro / creds).
  Biến `PUBKEY_SPKI_B64URL` = khoá công khai (thay bằng khoá của bạn khi phát hành thật).
- `vpvie/license.py` → kiểm key phía máy chủ (dùng `cryptography`), **chống crack**.
- `tools/vpvie-keygen/` → `keygen.js` (genkeys / issue / batch), `cap-key.html` (cấp key
  bằng trình duyệt, ngoại tuyến), `README.md`. **KHOÁ RIÊNG** `private-key.b64` KHÔNG commit
  (đã có `.gitignore`).

**Chống crack (hướng D — đã làm):** các API AI `/api/recognize`, `/api/assist`, `/api/slides`
yêu cầu Key hợp lệ khi bật `VPVIE_REQUIRE_LICENSE=1`. Dù client bị sửa "đã kích hoạt" cũng
**không lấy được kết quả AI** nếu không có Key thật (không ký giả được). Client gửi kèm
`{license, machine}` qua `VPLicense.creds()`. Thu hồi key: tệp JSON trỏ bởi `VPVIE_REVOKED_KEYS`.

**Hướng C (nhiều máy):** `keygen.js license --max N` tạo key không gắn máy; app gọi
`POST /api/activate`, máy chủ đếm số máy ở `activations.json` (tối đa N), chặn máy vượt;
key nhiều máy buộc kích hoạt online; API AI chỉ phục vụ máy đã kích hoạt.
Mặc định TẮT để bản miễn phí/phát triển vẫn chạy.

> Lưu ý thật: phần vẽ chạy 100% trong trình duyệt + mã nguồn mở thì **không chống crack tuyệt đối**
> (ai cũng sửa được `isPro()`); key offline chỉ chống *làm giả key*. Giá trị bán thật nên đặt ở
> **AI máy chủ** (đã khoá) hoặc kích hoạt online (**hướng C — ĐÃ LÀM**: key nhiều máy, đếm/giới hạn số máy, thu hồi).

## 5d. Nắn mượt nét chữ viết tay (MỚI — theo yêu cầu)

Khác với nhận dạng ra chữ: tính năng này **giữ nguyên nét viết tay của người dùng**
nhưng **làm mượt, bớt run tay, bớt nguệch ngoạc** sau khi viết xong.

- `web/js/beautify.js` → `VPBeautify.refineInk(points, strength)`: resample → làm trơn khử
  run tay → RDP lấy đỉnh → **tách tại góc nhọn** (`cornerSplit`) → **phân loại mỗi đoạn là
  THẲNG hay CONG**: đoạn thẳng vẽ lại thành đường thẳng sạch (snap ngang/dọc), đoạn cong
  nội suy Catmull-Rom. Chữ = tổ hợp nét thẳng + nét cong gọn như chữ viết. strength 1-4.
- `app.js`: `state.tidyInk` (mặc định BẬT) tự nắn mỗi nét sau pointerup (không áp cho
  bút dạ quang; chạy sau khi shape-beautify trả null). `tidyWholePage()` nắn lại mọi
  nét trên trang (có pushHist để Ctrl+Z).
- Giao diện: menu ▾ của Bút, mục "Nắn nét chữ viết tay": bật/tắt, mức Nhẹ/Vừa/Mạnh,
  "Nắn lại toàn trang". Tách bạch với "✨ Nắn thành hình (thẳng/tròn)".

> Phân biệt: "Theo nét" (VPInk) = ra CHỮ đánh máy; "Nắn nét" (refineInk) = GIỮ nét tay,
> chỉ làm mượt. Người dùng muốn cái sau.

## 5e. Đóng gói ỨNG DỤNG: máy tính (.exe) + iPad/Android (PWA) (MỚI)

Cùng một bộ mã web, chạy 3 dạng: ứng dụng máy tính, PWA cài trên iPad, và web.

**Ứng dụng máy tính — Electron** (`desktop/`):
- `main.js`: khởi động backend — nếu có Python+fastapi thì chạy `run.py` (đủ AI),
  không thì chạy máy chủ tĩnh Node (`static-server.js`, đủ mọi tính năng ngoại tuyến);
  rồi mở cửa sổ nạp `bang.html`. `VPVIE_FORCE_OFFLINE=1` để ép ngoại tuyến.
- `package.json`: electron + electron-builder; `npm run dist:win` → `.exe` (NSIS) + `.msi`.
- Biểu tượng `desktop/build/icon.ico|png`. Build `.exe` phải chạy trên Windows.
- Đã smoke-test bằng xvfb: cả 2 chế độ (python/offline) nạp `bang.html`, canvas OK.

**Cài trên iPad/Android — PWA**:
- `web/manifest.webmanifest` (standalone, theme #7a1020, icons 192/512/maskable),
  `web/sw.js` (service worker cache-first, bỏ qua /api → chạy ngoại tuyến),
  thẻ apple-touch-icon + apple-mobile-web-app-capable trong `bang.html`/`index.html`,
  đăng ký SW. `web/icons/*` (PIL tạo).
- iPad: Safari → Chia sẻ → Thêm vào màn hình chính. Cần HTTPS khi lên mạng.
- Đã test: manifest/sw/icon phục vụ đúng kiểu, SW đăng ký, đủ điều kiện cài, không lỗi.

## 6. Lỗi đã gặp & cách xử lý (để không lặp lại)
- CDN bị chặn trong trình duyệt → vendor hết thư viện cục bộ.
- mathjs stub 4KB → dùng `lib/browser/math.js`.
- Tesseract OEM=1 cần core `-lstm` wasm.
- Hình học: bỏ `setPointerCapture` cho click rời rạc (chỉ capture khi kéo "move").
- `parseFormula` (cân bằng hoá) lặp vô hạn cuối chuỗi vì `/[a-z]/.test(undefined)` khớp "undefined" → phải chặn `i < len` và so ký tự trực tiếp.
- Ký hiệu công thức: trong **thuộc tính HTML** `\\` là 2 ký tự thật; trong **chuỗi JS** `"\\frac"` mới ra `\frac`. Dễ nhầm.
- localStorage có giới hạn (~5MB): nền PDF (ảnh base64) + thumbnail có thể tràn → autosave nuốt lỗi; cân nhắc nén/giảm số trang PDF.

## 7. An toàn
- KHÔNG tải khoá ký riêng (.pem) của dự án Python cũ lên bất cứ đâu.
- Không gửi email người dùng tới dịch vụ không liên quan.
