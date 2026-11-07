# UniHub

UniHub hỗ trợ sinh viên tìm cơ hội thực tập, việc làm, học bổng; tham khảo lộ trình kỹ năng, quản lý lịch/deadline và tham gia diễn đàn. Admin có dashboard, thẩm định cơ hội, kiểm duyệt diễn đàn, quản lý danh mục và tài khoản.

Đây là hướng dẫn **cài mới local trên Windows/PowerShell**, không cần Docker hoặc hosting. Người nhận tự tạo database `unihub_demo` trên MySQL của mình. GitHub chứa source/migration/fixture, không mang theo dữ liệu MySQL của nhóm. Không dùng hoặc thao tác `unihub_dev` trong quy trình bàn giao.

## 1. Yêu cầu hệ thống

| Thành phần    | Yêu cầu theo source                                                                 |
| ------------- | ----------------------------------------------------------------------------------- |
| Windows       | PowerShell, Git, trình duyệt hiện đại                                               |
| Node.js / npm | Node `>=24.19.0 <25`, npm `>=11.9.0 <12`                                            |
| Database      | MySQL Server 8.4 và MySQL CLI hoặc Workbench; có quyền DBA tạo schema/user và GRANT |
| Frontend      | React 19 / TypeScript / Vite 8 / Tailwind 3.4                                       |
| Backend       | Express 5 / TypeScript ES modules / Prisma 7 với adapter MariaDB cho MySQL          |
| Đăng nhập     | Internet, tài khoản Google thật và Google OAuth **Web Client ID** hợp lệ            |

Chỉ cài Workbench chưa đủ: cần MySQL Server đang chạy. Dự án dùng npm workspaces và một `package-lock.json` ở gốc; không tự nâng major dependency. Dùng `npm.cmd` để tránh Execution Policy của `npm.ps1`.

## 2. Quick Start từ máy mới

Thực hiện lần lượt, dừng khi một bước lỗi. Các lệnh npm/Node dưới đây chạy **tại gốc UniHub**.

### Bước 1 — Clone và cài dependency

```powershell
git clone --branch main https://github.com/KhanhHuyen444/UniHub.git
Set-Location .\UniHub
node --version
npm.cmd --version
npm.cmd ci
```

Nếu đã có checkout, kiểm tra `git status` và bảo toàn thay đổi trước khi cập nhật; không clone đè hoặc reset để xử lý lỗi.

### Bước 2 — Tạo database và tài khoản MySQL

Mở MySQL CLI/Workbench bằng DBA. Theo [setup §2](docs/LOCAL-SETUP-UNIHUB-DEMO.md#2-tạo-schema-và-hai-tài-khoản), kiểm tra tên chưa tồn tại, tạo `unihub_demo` với `utf8mb4_0900_as_ci`, tạo riêng `unihub_demo_migrator` và `unihub_demo_app`, rồi cấp migrator quyền trên đúng schema. Chưa cấp quyền bảng cho runtime vì bảng chưa được tạo.

Nếu database/user đã tồn tại, xác minh chủ sở hữu trước; không DROP/RESET hoặc chạy lại CREATE tùy tiện.

### Bước 3 — Tạo và cấu hình môi trường

```powershell
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
if (-not (Test-Path .\backend\.env.migration)) { Copy-Item .\backend\.env.migration.example .\backend\.env.migration }
if (-not (Test-Path .\frontend\.env)) { Copy-Item .\frontend\.env.example .\frontend\.env }
```

Điền giá trị cục bộ theo [setup §3](docs/LOCAL-SETUP-UNIHUB-DEMO.md#3-cấu-hình-hai-url) và [bảng biến môi trường](docs/fresh-install-operations.md#1-biến-môi-trường):

- `backend/.env`: `DATABASE_URL` runtime trỏ `unihub_demo`, `PORT=3001`, `JWT_SIGNING_SECRET` ngẫu nhiên ít nhất 32 byte, `JWT_ISSUER`, `JWT_AUDIENCE`, `GOOGLE_CLIENT_ID`, `AUTH_ALLOWED_ORIGINS`.
- `backend/.env.migration`: `MIGRATION_DATABASE_URL` của migrator, cũng trỏ `unihub_demo`.
- `frontend/.env`: `API_PROXY_TARGET=http://127.0.0.1:3001`, `VITE_GOOGLE_CLIENT_ID` giống backend.

Không dùng nguyên placeholder; URL-encode user/password, không thêm query/fragment vào URL MySQL. Lệnh npm mặc định **không nạp `backend/.env.demo`**. Biến shell có thể ghi đè file. Không đưa `.env`, token hay mật khẩu vào Git/chat/log; biến `VITE_` có thể công khai.

### Bước 4 — Migration, GRANT runtime và build

```powershell
npm.cmd run prisma:validate
npm.cmd run db:migrate:status
```

Database mới có thể báo pending và mã thoát khác 0. Chỉ khi đã xác minh đúng đích và đây không phải lỗi kết nối/quyền, tiếp tục:

```powershell
npm.cmd run db:migrate:deploy
npm.cmd run db:migrate:status
npm.cmd run prisma:generate
```

Kỳ vọng status **up to date**, 13 bảng nghiệp vụ và `_prisma_migrations`. DBA thực hiện [GRANT từng bảng ở setup §4](docs/LOCAL-SETUP-UNIHUB-DEMO.md#4-chạy-migrations-rồi-cấp-quyền-runtime-theo-từng-bảng), sau đó:

```powershell
npm.cmd run build
```

Generate/build không tự migration/seed. Không dùng `prisma migrate reset`, `db push` hoặc sửa migration đã áp dụng.

### Bước 5 — Khởi động và kiểm tra kết nối

Mở hai terminal PowerShell tại gốc repo, giữ chúng chạy:

```powershell
# Terminal 1
npm.cmd run dev:backend
```

```powershell
# Terminal 2
npm.cmd run dev:frontend
```

Mở **http://127.0.0.1:5173/**. Tại terminal thứ ba:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/ready
Invoke-RestMethod http://127.0.0.1:5173/api/ready
```

Kỳ vọng health `ok`, ready `ready`/`database: available`; lệnh cuối kiểm tra Vite proxy. Readiness chỉ chạy `SELECT 1`, chưa chứng minh đủ bảng/quyền/dữ liệu. Nếu cổng khác, dùng URL server in ra và [đồng bộ proxy](docs/fresh-install-operations.md#2-cổng-và-tiến-trình). Dừng server bằng `Ctrl+C` trong đúng terminal.

### Bước 6 — Google Login và Admin đầu tiên

Theo [hướng dẫn Google/Admin](docs/fresh-install-operations.md#3-google-sign-in-và-admin-đầu-tiên), tạo OAuth Web Client ID, đăng ký origin `http://127.0.0.1:5173`, điền cùng Client ID ở hai workspace rồi restart cả hai server. Đăng nhập Google thật tại `/login` để backend tạo Student.

Operator đọc đúng `google_sub` của tài khoản vừa đăng nhập bằng MySQL, rồi chạy:

```powershell
npm.cmd run admin:bootstrap
```

Kiểm tra danh tính script hiển thị, nhập `PROMOTE` nếu đúng người. Đăng xuất/đăng nhập lại và mở `/admin/dashboard`. Nếu đã có Admin, script từ chối; dùng Admin hiện có quản lý quyền tại `/admin/users`. Không sửa trực tiếp `users.role` bằng SQL hoặc dùng email fixture để đăng nhập.

### Bước 7 — Nạp demo

Theo [quy trình seed đầy đủ](docs/demo-seed-workflow.md): **Catalog → Cơ hội → Guidance → Forum**. Mỗi bộ có lệnh dry-run, điểm kiểm tra trước apply và kết quả kỳ vọng. Không có `npm run prisma:seed` tổng; không chạy script seed/sync lịch sử ngoài danh sách.

Catalog đầy đủ có 117 Major + 328 Skill. Cơ hội synthetic gồm 100 tin (40 thực tập / 35 việc làm / 25 học bổng), phải validation deadline tại thời điểm nhập và được import **Pending**. Admin duyệt riêng trong tab cơ hội ở `/admin/moderation` để xuất hiện Public Hub. Guidance có 146 bài định hướng Approved; Forum có 12 tác giả mẫu, 24 bài, 136 bình luận. Không tự gia hạn deadline hay đổi phê duyệt để vượt kiểm tra.

### Bước 8 — Nghiệm thu vai trò

Dùng [checklist máy sạch](docs/fresh-install-acceptance.md), ghi `PASS`, `FAIL`, `SKIP`, `NOT RUN` riêng từng mục. Cần Student thật riêng với Admin để kiểm tra đủ quyền. Bao gồm Guest, hồ sơ/gợi ý/lịch/diễn đàn Student, các chức năng Admin và Activity Log bằng SQL đọc; không yêu cầu trang xem log.

## 3. Xử lý sự cố

| Triệu chứng                               | Xử lý                                                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Node/npm sai phiên bản; `npm.ps1` bị chặn | Đối chiếu §1, mở lại terminal sau cài, dùng `npm.cmd`; không đổi lockfile để né lỗi                                          |
| MySQL chưa chạy/sai tài khoản             | Kiểm tra service, host/port, schema và quyền theo setup                                                                      |
| Migration thất bại                        | Phân biệt pending với lỗi kết nối/quyền/DDL; kiểm tra lịch sử, không reset hay sửa checksum                                  |
| `Unable to connect to the remote server`  | Chưa gọi được HTTP backend: xem terminal server và cổng thực tế trước khi chẩn đoán DB                                       |
| Health 200, ready 503                     | Đọc mã `DATABASE_NOT_CONFIGURED`, `DATABASE_CONFIGURATION_INVALID`, `DATABASE_UNAVAILABLE`; kiểm tra URL runtime/MySQL/quyền |
| `EADDRINUSE` trên 3001 hoặc 5173          | [Xác định tiến trình và đổi cổng](docs/fresh-install-operations.md#2-cổng-và-tiến-trình); không dừng toàn bộ Node/MySQL      |
| Backend chạy cổng khác, frontend gọi lỗi  | Đồng bộ `API_PROXY_TARGET`, restart Vite, kiểm tra ready qua frontend                                                        |
| Google lỗi origin/Client ID               | Cùng OAuth Web Client ID ở hai workspace, đúng origin frontend; xem hướng dẫn Google/Admin                                   |
| Mất phiên sau reload                      | Kiểm tra cookie Secure/refresh/logout; giữ cùng hostname, không hạ bảo mật cookie                                            |
| Bootstrap báo đã có Admin                 | Dùng Admin hiện có; bootstrap chỉ dành cho Admin đầu tiên                                                                    |
| Dry-run thành công nhưng chưa có dữ liệu  | Dry-run không ghi; review rồi apply từng bộ đúng đích                                                                        |
| Import cơ hội xong nhưng Hub rỗng         | Tin mới Pending; Admin duyệt riêng, kiểm tra deadline/bộ lọc                                                                 |
| Clone source nhưng không có dữ liệu nhóm  | MySQL mỗi máy độc lập; migration và seed trên database mới của người nhận                                                    |

## 4. Kiểm tra source và tài liệu kỹ thuật

```powershell
npm.cmd run prisma:validate
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run format:check
git diff --check
```

Test MySQL/browser có điều kiện có thể SKIP. Build/unit test không thay thế cài mới MySQL, Google OAuth thật hoặc nghiệm thu UI. Kết quả rà soát và giới hạn: [báo cáo](docs/fresh-install-review.md).

Source ở `frontend/src`, `backend/src`; schema/migrations chỉ ở `backend/prisma`, fixture ở `data`. Xem [công nghệ](docs/technology-stack.md), [kiến trúc](docs/architecture.md), [workflow](docs/team-workflow.md), [API](docs/api-contracts.md), [runtime](docs/database-runtime.md), [migration](docs/database-migrations.md), [auth](docs/auth-api-contract.md). Ghi chú scaffold/PR cũ là lịch sử; xác định chức năng bằng source và kiểm thử hiện tại.

Không commit `.env`, mật khẩu, token, dump riêng tư, `node_modules`, `dist`, `coverage`; không reset/xóa database hiện có.
