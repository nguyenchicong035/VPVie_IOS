# VPVie PWA – Bộ ứng dụng văn phòng tiếng Việt cho iPhone/iPad

Phiên bản này chuyển VPVie thành **Progressive Web App (PWA)** chạy trên Web và tối ưu cho Safari trên iPhone/iPad. Sau khi thêm vào màn hình chính, ứng dụng mở ở chế độ độc lập, phủ toàn màn hình khả dụng, hỗ trợ safe area của tai thỏ/Dynamic Island và lưu tài nguyên để tiếp tục dùng khi kết nối mạng không ổn định.

PWA không dùng chứng chỉ ký ứng dụng iOS nên không có thời hạn 7 ngày như bản cài thử qua Xcode. Ứng dụng vẫn cần một địa chỉ HTTPS còn hoạt động để cài đặt, nhận bản cập nhật và dùng các tính năng máy chủ.

## Cài trên iPhone/iPad

1. Mở địa chỉ HTTPS của VPVie bằng **Safari**.
2. Nhấn **Chia sẻ**.
3. Chọn **Thêm vào màn hình chính** rồi nhấn **Thêm**.
4. Mở VPVie từ biểu tượng vừa tạo.

Nút **Cài ứng dụng** trong giao diện cũng hiển thị hướng dẫn này trên iOS/iPadOS.

## Chạy và kiểm thử

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt httpx pytest
python run.py
```

Mở `http://127.0.0.1:8000`. Service worker được phép hoạt động trên localhost; môi trường công khai bắt buộc dùng HTTPS.

```bash
PYTHONPATH=. python -m pytest tests/ -q
```

Workflow GitHub Pages triển khai thư mục `web/` thành bản PWA tĩnh. Các chức năng chạy trong trình duyệt hoạt động trên Pages; nhận dạng/AI qua `/api/*` cần triển khai máy chủ FastAPI bằng `python run.py` trên một dịch vụ HTTPS.

Giao diện **tiếng Việt**, thân thiện người dùng Việt Nam. AI dùng **mã nguồn mở, miễn phí**.
Module đầu tiên: **Bảng dạy học** (trọng tâm dạy toán trực tuyến + nhận diện nét vẽ).

## Tính năng Bảng dạy học
- ✍️ **Vẽ tay** (bút nhiều màu, cỡ nét, tẩy, hoàn tác, xóa) trên bảng kẻ ô.
- ✨ **Làm đẹp nét (offline)**: nét nguệch ngoạc → **đường thẳng / tròn / elip / chữ nhật / tam giác**.
- 🤖 **Nhận diện nét vẽ bằng AI nguồn mở**:
  - **Tesseract.js** – nhận chữ tiếng Việt, chạy **ngay trong trình duyệt, miễn phí, không cần máy chủ**.
  - **Ollama** (tùy chọn) – mô hình thị giác mở chạy cục bộ (nhận cả chữ lẫn công thức). Công thức trả về **LaTeX mở ra để sửa** rồi chèn.
- ∑ **Công thức toán LaTeX** (KaTeX) có xem trước.
- 📈 **Máy tính đồ thị**: nhập `y = a*x^2 + b*x + c` → tự tạo **thanh trượt tham số** a, b, c, đồ thị đổi theo thời gian thực.
- 🧮 **Máy tính khoa học** (math.js): sin, cos, log, √, lũy thừa…
- △ **Mẫu hình học**: tam giác, chữ nhật, đường tròn, hệ trục Oxy.
- 🖼️ **Xuất PNG** / 📄 **Xuất PDF** cả bảng (html2canvas + jsPDF).

## Chạy thử
```bash
pip install -r requirements.txt
python run.py            # http://127.0.0.1:8000
```
Nhận dạng **Tesseract** chạy ngay (miễn phí, không cần cấu hình).

### Bật nhận dạng bằng Ollama (mô hình mở, mạnh hơn)
```bash
# cài Ollama (ollama.com) rồi tải một mô hình thị giác mở, ví dụ:
ollama pull qwen2.5vl:7b
export VPVIE_AI_PROVIDER=ollama          # mặc định
export VPVIE_OLLAMA_MODEL=qwen2.5vl:7b
python run.py
```
Chọn "Máy chủ (Ollama/Claude)" ở ô công cụ nhận dạng. (Tùy chọn Claude: `VPVIE_AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`.)

## Thiết kế an toàn
- AI **chỉ nhận dạng** nội dung trong hình; mọi tính toán/đồ thị do thư viện thật xử lý (không để AI bịa số).
- Mọi thư viện (KaTeX, function-plot, math.js, jsPDF, html2canvas, Tesseract.js + dữ liệu `vie`/`eng`) đều **nguồn mở**, lấy từ các kho công khai trên GitHub và **đóng gói sẵn** trong `web/vendor/` → chạy được cả khi không có mạng (riêng Ollama/Claude cần dịch vụ tương ứng).

## Công nghệ
Backend FastAPI (Python). Frontend HTML/Canvas thuần. Thư viện nguồn mở: KaTeX, function-plot, math.js, Tesseract.js, jsPDF, html2canvas.

## Lộ trình
Hình học động kéo-thả • Khối câu hỏi trắc nghiệm/Đúng-Sai • Nhiều trang & sổ bài giảng • Bảng biến thiên/xét dấu • Hỏi Excel tiếng Việt • Tạo slide bằng AI • Soạn thảo Word/PowerPoint/PDF/Markdown/HTML.
