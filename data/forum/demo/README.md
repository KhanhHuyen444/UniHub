# UniHub Forum Demo Seed

> **Cài mới:** Theo [hướng dẫn local](../../../docs/LOCAL-SETUP-UNIHUB-DEMO.md#7-nạp-dữ-liệu-đã-được-duyệt), dùng catalog và backend/.env tự cấu hình unihub_demo. Các ví dụ backend/.env.demo bên dưới là cấu hình riêng tùy chọn. Tác giả fixture có Google sub giả lập, không phải tài khoản Google đăng nhập được. Test safety có ghi dữ liệu, không dùng database cần bảo toàn.

Thư mục này chứa bộ dữ liệu Forum demo chất lượng cao và kịch bản nạp dữ liệu (seed) vào cơ sở dữ liệu `unihub_demo` (MySQL), phục vụ môi trường demo và tích hợp trực tiếp lên HomePage.

## 1. Cấu trúc dữ liệu

- `authors-fixture.json`: 12 tài khoản sinh viên tác giả thuộc các ngành học Active trong hệ thống (`@gmail.com`, `role = Student`).
- `posts-fixture.json`: 24 bài viết diễn đàn chia đều 3 chủ đề (8 `Học tập`, 8 `Thực tập`, 8 `Kinh nghiệm phỏng vấn`).
- `comments-fixture.json`: 136 bình luận thảo luận ngữ cảnh chất lượng cao.
- `generate-forum-demo.mjs`: Script tạo lại fixtures và kiểm tra tính toàn vẹn.
- `seed-forum-demo.mjs`: Script nạp dữ liệu an toàn, có kiểm tra database guard và đảm bảo tính bất biến (idempotent).
- `forum-demo.test.mjs`: Unit test xác thực fixtures và ràng buộc nghiệp vụ.
- `safety-and-homepage-scenarios.test.mjs`: Bộ kiểm thử an toàn toàn diện (kết nối database thực, dry-run 0 creates, rollback transaction, soft-delete preservation, hành vi Homepage khi đăng bài mới hoặc gỡ bài).

## 2. Ba bài viết nổi bật trên HomePage

1. **POST 01 (`Kinh nghiệm phỏng vấn`)**:
   - Tiêu đề: _Chia sẻ kinh nghiệm phỏng vấn vị trí Software Intern cho sinh viên năm 3_
   - Số bình luận: **18 bình luận**
   - Tác giả: Nguyễn Hoàng (Kỹ thuật phần mềm - Năm 3)
2. **POST 02 (`Học tập`)**:
   - Tiêu đề: _Cách phân bổ thời gian ôn thi chứng chỉ TOEIC và đồ án chuyên ngành hiệu quả_
   - Số bình luận: **32 bình luận**
   - Tác giả: Trần Mai (Công nghệ thông tin - Năm 3)
3. **POST 03 (`Thực tập`)**:
   - Tiêu đề: _Nên chuẩn bị gì trước kỳ thực tập doanh nghiệp đầu tiên?_
   - Số bình luận: **14 bình luận**
   - Tác giả: Lê Trí (Hệ thống thông tin - Năm 3)

## 3. Hướng dẫn chạy

### Chạy kiểm tra dữ liệu mẫu (Unit Tests)

```bash
node --test data/forum/demo/forum-demo.test.mjs
```

### Chạy kiểm tra an toàn và các kịch bản Homepage

```bash
node --env-file=backend/.env.demo --test data/forum/demo/safety-and-homepage-scenarios.test.mjs
```

### Chạy thử nghiệm an toàn (Dry Run - không ghi database)

```bash
node --env-file=backend/.env.demo data/forum/demo/seed-forum-demo.mjs
```

### Nạp dữ liệu vào database demo (`unihub_demo`)

```bash
node --env-file=backend/.env.demo data/forum/demo/seed-forum-demo.mjs --apply
```

> **Lưu ý an toàn:** Kịch bản kiểm tra nghiêm ngặt `targetDb === 'unihub_demo'`. Nếu kết nối đến database khác (như `unihub_dev`), script sẽ từ chối thực thi để bảo vệ dữ liệu phát triển.
