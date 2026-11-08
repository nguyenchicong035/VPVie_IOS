# VPVie – Phát hành key theo máy

Hệ thống cấp phép **gắn theo từng máy**, ký số **ECDSA P-256**. Người dùng không thể
tự tạo key; chỉ người giữ **khoá riêng** (`private-key.b64`) mới cấp được.

## Quy trình

1. **Tạo cặp khoá (chỉ 1 lần đầu):**
   ```bash
   node keygen.js genkeys
   ```
   Lệnh ghi `private-key.b64` (GIỮ BÍ MẬT) và in ra khoá công khai.
   Dán khoá công khai vào biến `PUBKEY_SPKI_B64URL` trong `web/js/license.js`.
   *(Kho này đã có sẵn một cặp khoá mẫu — hãy tạo cặp khoá mới của riêng bạn trước khi phát hành thật.)*

2. **Người dùng lấy Mã máy:** mở bảng dạy học → nút **🔑 Kích hoạt** → sao chép
   dòng `VPV-XXXX-XXXX-XXXX` gửi cho bạn.

3. **Bạn cấp key:**
   ```bash
   node keygen.js issue VPV-ABCD-EFGH-JKLM --days 365 --note "Cô Lan"
   ```
   Gửi chuỗi `VPL1.....` cho người dùng dán vào ô kích hoạt.

4. **Cấp hàng loạt:** tệp `may.txt` mỗi dòng `MÃ_MÁY,ghi chú`:
   ```bash
   node keygen.js batch may.txt --days 365 > keys.csv
   ```

## Key dùng nhiều máy (kích hoạt qua máy chủ — hướng C)

Key gắn 1 máy (`issue`) chạy ngoại tuyến nhưng mỗi key chỉ 1 máy. Muốn **1 key cho
nhiều máy** (vd cả trường) và **chống crack mạnh hơn**, dùng key kích-hoạt-qua-máy-chủ:

```bash
node keygen.js license --max 5 --days 365 --note "Trường A"
```

- Người dùng dán key → app gọi `POST /api/activate` trên máy chủ VPVie, máy chủ **đếm
  số máy** (tối đa `--max`); máy thứ N+1 bị từ chối.
- Máy chủ lưu trạng thái ở `activations.json` (KHÔNG commit). Muốn **gỡ máy cũ**: xoá
  mã máy đó khỏi `activations.json` rồi khởi động lại.
- Bật kiểm tra ở máy chủ: `VPVIE_REQUIRE_LICENSE=1`. Khi bật, **API Ai chỉ phục vụ máy
  đã kích hoạt** → dù client bị crack cũng không dùng được AI của máy chủ.
- Thu hồi cả key: thêm `id` (hoặc mã máy) vào tệp JSON trỏ bởi `VPVIE_REVOKED_KEYS`.

## Cấp key không cần dòng lệnh
Mở `cap-key.html` bằng trình duyệt (trên máy bạn), dán nội dung `private-key.b64`,
nhập Mã máy → bấm **Cấp key**. Toàn bộ chạy offline trong trình duyệt.

## An toàn
- **Không commit** `private-key.b64` lên kho công khai (đã có trong `.gitignore`).
- `--days 0` (hoặc bỏ qua) = key vĩnh viễn; đặt số ngày để key tự hết hạn.
- Mất khoá riêng = phải đổi khoá công khai và cấp lại toàn bộ key.
