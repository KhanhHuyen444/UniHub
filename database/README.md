# Quản lý dữ liệu UniHub

Đã có [schema Prisma](../backend/prisma/schema.prisma), [cấu hình CLI](../backend/prisma.config.ts) và initial migration đang review trên nhánh `feat/initial-migration`. Migration chỉ được áp dụng cho MySQL dùng một lần để kiểm thử; **chưa áp dụng vào database của nhóm/thành viên**, chưa seed. Health HTTP chạy mà không cần MySQL.

**Nguồn chính duy nhất** là:

- `backend/prisma/schema.prisma`: mô hình Prisma ánh xạ đủ 12 bảng Chương 4.
- `backend/prisma/migrations/`: nguồn lịch sử migration duy nhất. Initial schema giữ CHECK, ON UPDATE, collation và referential actions đã chốt.
- `backend/prisma.config.ts`: Prisma CLI 7 đọc URL riêng `MIGRATION_DATABASE_URL`; scripts nạp `backend/.env.migration` nếu có. Health không cần database.

Không tạo bộ SQL/schema cạnh tranh trong database/. Thư mục này hiện giữ hướng dẫn, sau có thể bổ sung tài liệu dữ liệu đã review. TV1 điều phối migration; mỗi TV đề xuất và kiểm tra thay đổi của phần mình. Không đưa dump, tài khoản hoặc dữ liệu cá nhân lên Git.

Đọc [database-schema.md](../docs/database-schema.md) để xem kiểm đếm schema và [database-migrations.md](../docs/database-migrations.md) để xem quyết định charset/timezone/quyền, hướng dẫn Windows và kết quả kiểm thử. Không tạo bộ SQL/schema cạnh tranh trong database/. Google sub/session vẫn là vấn đề cho nhiệm vụ xác thực, không tự thêm bảng/cột vào schema hiện tại.
