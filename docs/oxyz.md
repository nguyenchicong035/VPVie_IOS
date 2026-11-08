# Hình học không gian Oxyz

Trong bảng dạy học, chọn nút **Hình học không gian Oxyz (3D)** cạnh Bảng biến thiên. Kéo một vùng trên giấy (hoặc bấm một lần để dùng khung mặc định). Cửa sổ **Oxyz 3D Studio** mở ra.

- **Đối tượng**: xem tọa độ/phương trình, ẩn/hiện, sửa hoặc xóa đối tượng; nhập lệnh theo phần “Cách gõ đối tượng”.
- **Thêm hình**: điểm, vectơ có điểm đặt, đường thẳng qua điểm và vectơ chỉ phương, mặt phẳng Ax + By + Cz + D = 0, mặt cầu và đoạn/đa giác.
- **Công cụ Oxyz**: tích vô hướng/có hướng và góc hai vectơ; khoảng cách điểm–mặt, hình chiếu và điểm đối xứng; giao điểm và góc đường–mặt; góc, vị trí tương đối và giao tuyến hai mặt phẳng.
- **Mô hình mẫu**: đủ năm mô hình trong yêu cầu. Chọn mẫu sẽ thay các đối tượng trong bản nháp hiện tại. Đường tròn giao tuyến của mẫu mặt cầu là kết quả dựng sẵn, có thể ẩn hoặc xóa.
- Chuột trái xoay; chuột phải hoặc Shift + kéo để tịnh tiến; con lăn hoặc nút −/+ để zoom. Các nút camera chuyển giữa góc 3D chuẩn và ba hình chiếu tọa độ. Các tùy chọn bên phải điều khiển lưới, mặt phẳng tọa độ, đường gióng, nhãn, tự xoay, trục, cỡ chữ và độ dài trục.
- **Xong** lưu hình vào giấy. Dùng công cụ chọn để kéo hình; nhấp đúp để mở lại Studio. **Hủy** hoặc Escape bỏ thay đổi trong cửa sổ. Hình hỗ trợ hoàn tác/làm lại và lưu/mở sổ như các hình canvas khác.

Tọa độ hỗ trợ số thập phân, phân số và biểu thức số như `sqrt(2)`. Các phép dựng kiểm tra vectơ không, mặt phẳng suy biến và trường hợp không có giao điểm duy nhất. Phép tính dùng tọa độ 3D; phần nhìn dùng phép chiếu xiên theo kiểu hình vẽ Oxyz trong ảnh mẫu. Không cần dịch vụ AI hay thư viện 3D bên ngoài.

## Mã nguồn

- `web/js/oxyz-math.js`: phép tính hình học độc lập với giao diện.
- `web/js/tools-oxyz.js`: giao diện Studio, mẫu dựng hình và bộ vẽ canvas.
- `web/oxyz.css`: kiểu giao diện giới hạn trong Studio.
- `web/js/app.js`: chọn vùng, chèn/chỉnh sửa, chọn/di chuyển và lịch sử.
- `web/sw.js`: phiên bản cache mới và các tài nguyên Oxyz ngoại tuyến.

Cảnh lưu dưới dạng `type: "oxyz"` trong `items` của trang, cùng khung `x/y/w/h` và `scene` chứa danh sách đối tượng, camera và tùy chọn hiển thị. Studio sửa một bản sao; chỉ ghi lại khi bấm Xong.

## Kiểm thử

```bash
node --test tests/oxyz-math.test.cjs
PYTHONPATH=. .venv/bin/python -m pytest tests/ -q
```

Kiểm thử trình duyệt cần Playwright và Chromium. Khởi động `.venv/bin/python run.py` ở một phiên khác, rồi chạy:

```bash
node tests/oxyz-browser.cjs
```

Có thể đặt `VPVIE_TEST_URL` để đổi địa chỉ máy chủ, `CHROMIUM_PATH` để đổi đường dẫn Chromium, và `OXYZ_ARTIFACTS` để lưu ảnh kiểm thử. Kiểm thử sử dụng ngữ cảnh trình duyệt riêng và chặn service worker để luôn kiểm tra mã mới.
