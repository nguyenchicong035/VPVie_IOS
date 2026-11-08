# VPVie Key Tool — Trình cấp key (ứng dụng độc lập)

Phần mềm riêng cho **người phát hành**: bấm đúp mở cửa sổ, cấp key bản quyền VPVie,
không cần dòng lệnh.

## Dùng
- **Lần đầu**: bấm **Tạo khoá mới** (hiện khoá công khai → dán vào `web/js/license.js`
  và `vpvie/license.py` rồi phát hành lại app), hoặc **Nhập khoá có sẵn** (tệp
  `private-key.b64` bạn đã có).
- Khoá riêng được **lưu an toàn ngay trên máy** (mã hoá bằng hệ điều hành nếu hỗ trợ),
  nhớ cho các lần sau — không phải dán lại.
- **Cấp key**: chọn *Gắn 1 máy* (nhập Mã máy người dùng gửi) hoặc *Nhiều máy* (đặt số
  máy tối đa) → nhập số ngày, ghi chú → **Cấp key** → **Chép key** gửi người dùng.
- **Nhật ký** lưu mọi key đã cấp; **Sao lưu khoá riêng** để cất giữ nơi an toàn.

## Tạo bản cài (.exe)
Cần Node.js trên máy Windows:
```bash
cd keytool
npm install
npm run dist:win    # ra keytool/dist/VPVie Key Tool Setup.exe
```

> Key do công cụ này cấp dùng chung cơ chế ký ECDSA P-256 với VPVie nên kích hoạt
> được ngay (đã kiểm chứng verify khớp khoá công khai trong app).
