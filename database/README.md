# Quản lý dữ liệu UniHub

Đã có [schema Prisma](../backend/prisma/schema.prisma) và [cấu hình CLI](../backend/prisma.config.ts). **Chưa có database thực tế, migration hoặc seed.** Health HTTP chạy mà không cần MySQL.

**Nguồn chính duy nhất** là:

- `backend/prisma/schema.prisma`: mô hình Prisma ánh xạ đủ 12 bảng Chương 4.
- `backend/prisma/migrations/`: vị trí dự kiến, **chưa tạo migration**. Nhiệm vụ sau phải bổ sung SQL để giữ CHECK/ON UPDATE đúng thiết kế.
- `backend/prisma.config.ts`: cấu hình Prisma 7; không tự đọc `.env` thật hoặc bắt health có database.

Không tạo bộ SQL/schema cạnh tranh trong database/. Thư mục này hiện giữ hướng dẫn, sau có thể bổ sung tài liệu dữ liệu đã review. TV1 điều phối migration; mỗi TV đề xuất và kiểm tra thay đổi của phần mình. Không đưa dump, tài khoản hoặc dữ liệu cá nhân lên Git.

Đọc [database-schema.md](../docs/database-schema.md) để xem kiểm đếm thực tế, quyết định FK/timestamp đã được xác nhận, phần SQL/backend còn phải làm, lệnh Windows và giới hạn kiểm tra. Vị trí này thay cho đề xuất cũ database/prisma/. Google sub/session vẫn là vấn đề cho nhiệm vụ xác thực, không tự thêm bảng/cột vào schema hiện tại.
