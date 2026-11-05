# UniHub

UniHub là ứng dụng web hỗ trợ sinh viên tìm kiếm cơ hội học tập, thực tập, việc làm và học bổng; tham khảo lộ trình kỹ năng, nhận gợi ý theo hồ sơ, quản lý lịch/deadline và tham gia diễn đàn. Hệ thống có cổng quản trị để thống kê, thẩm định cơ hội, kiểm duyệt nội dung cộng đồng, quản lý danh mục và phân quyền.

> **Hướng dẫn này dành cho cách chạy cục bộ bằng Node.js + MySQL, không dùng Docker hoặc dịch vụ hosting.** Source code, Prisma migrations và dữ liệu fixture không thay thế MySQL Server. Trong bản bàn giao local, database chuẩn là `unihub_demo`. Khi cài trên máy khác, người nhận tự tạo `unihub_demo` mới theo migration và hướng dẫn seed/import bên dưới; quy trình cài mới vẫn cần kiểm chứng trên MySQL đích, không cần dữ liệu từ `unihub_dev` của nhóm.

## 1. Công nghệ và điều kiện chạy

| Thành phần            | Phiên bản/giải pháp trong source                                          |
| --------------------- | ------------------------------------------------------------------------- |
| Frontend              | React 19, React Router 8, Vite 8, TypeScript 5, Tailwind CSS 3            |
| Backend               | Node.js 24, Express 5, TypeScript                                         |
| Database              | MySQL 8.4; Prisma ORM 7 với `@prisma/adapter-mariadb`                     |
| Dependency management | npm workspaces (`frontend`, `backend`), một `package-lock.json` tại gốc   |
| Kiểm thử              | Node.js Test Runner; một số bài browser test dùng Playwright có điều kiện |
| Kiểm tra code         | TypeScript typecheck, Prettier                                            |

**Phiên bản máy chạy bắt buộc theo `package.json`:** Node.js `>=24.19.0 <25` và npm `>=11.9.0 <12`. Cần Git, MySQL 8.4 đang chạy, một terminal (PowerShell trên Windows), và trình duyệt hiện đại. Sử dụng `npm.cmd` trong PowerShell để tránh lỗi chính sách thực thi `npm.ps1`.

## 2. Lấy source và cài dependency

Chạy trong PowerShell tại thư mục muốn lưu source:

```powershell
git clone --branch main https://github.com/KhanhHuyen444/UniHub.git
Set-Location .\UniHub
node --version
npm.cmd --version
npm.cmd ci
```

Nếu đã clone, kiểm tra `git status` rồi đồng bộ `main` khi không có thay đổi cục bộ cần bảo toàn:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
```

Không dùng `git reset --hard` hoặc `git clean` để xử lý file của thành viên. `npm ci` sử dụng dependency trong lockfile; không cần cài riêng từng workspace.

## 3. Chuẩn bị MySQL `unihub_demo` và Prisma migrations

Ứng dụng cần **database được tạo trước** và **hai tài khoản MySQL riêng**: tài khoản migration có quyền DDL trên schema được chỉ định và tài khoản runtime có quyền truy cập bảng theo nghiệp vụ. **Thống nhất tên database `unihub_demo`** cho bản chạy thử và nghiệm thu. `unihub_dev` chỉ là database phát triển cũ, không tham gia quy trình cài đặt này. Mọi thao tác tạo schema/user phải được thực hiện trên MySQL mà bạn có quyền quản trị.

1. Theo **[Hướng dẫn setup MySQL `unihub_demo`](docs/LOCAL-SETUP-UNIHUB-DEMO.md)**, tạo schema `unihub_demo` với charset `utf8mb4` và collation `utf8mb4_0900_as_ci`.
2. Tạo hai tài khoản MySQL **riêng** cho migration và runtime; cấp quyền đúng trên `unihub_demo` theo hướng dẫn mới. Không cấp quyền nhầm vào `unihub_dev`, không dùng mật khẩu minh họa.
3. Tại gốc UniHub, chỉ tạo các file cấu hình nếu chúng chưa tồn tại:

```powershell
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
if (-not (Test-Path .\backend\.env.migration)) { Copy-Item .\backend\.env.migration.example .\backend\.env.migration }
if (-not (Test-Path .\frontend\.env)) { Copy-Item .\frontend\.env.example .\frontend\.env }
```

Sửa **cục bộ** (không commit):

- `backend/.env`: `DATABASE_URL` trỏ `unihub_demo` cho **runtime**; `PORT=3001`; `JWT_SIGNING_SECRET` ngẫu nhiên, tối thiểu 32 byte; `JWT_ISSUER`, `JWT_AUDIENCE`, `GOOGLE_CLIENT_ID`, `AUTH_ALLOWED_ORIGINS` theo môi trường.
- `backend/.env.migration`: `MIGRATION_DATABASE_URL` cho **migration account**, cũng trỏ `unihub_demo`.
- `frontend/.env`: `API_PROXY_TARGET=http://127.0.0.1:3001` và `VITE_GOOGLE_CLIENT_ID` trùng với Google Client ID backend.

`DATABASE_URL` và `MIGRATION_DATABASE_URL` đều dùng định dạng `mysql://user:encoded-password@127.0.0.1:3306/unihub_demo`; URL-encode ký tự đặc biệt trong mật khẩu. Ứng dụng không tự dùng URL migration thay cho URL runtime. **Không in hoặc chia sẻ file `.env`**.

Sau khi bảo đảm cả hai URL đều trỏ đến `unihub_demo`, kiểm tra và chạy migration (chỉ trên database mới mà bạn có quyền thao tác):

```powershell
npm.cmd run prisma:validate
npm.cmd run db:migrate:status
npm.cmd run db:migrate:deploy
npm.cmd run prisma:generate
```

`db:migrate:deploy` thay đổi schema đích: chỉ chạy sau khi kiểm tra cấu hình đúng database và có quyền sử dụng database đó. Không sử dụng `prisma migrate reset`, không xóa/sửa lịch sử migration. Cấu trúc Prisma hiện có **13 bảng nghiệp vụ**; `_prisma_migrations` là bảng kỹ thuật của Prisma.

Xem thêm [Prisma runtime và readiness](docs/database-runtime.md) và [migration & quyền MySQL](docs/database-migrations.md).

## 4. Khởi động frontend/backend local

Mở **hai terminal PowerShell**, đều tại thư mục gốc UniHub.

**Terminal 1 — Backend**

```powershell
npm.cmd run dev:backend
```

Backend mặc định: `http://127.0.0.1:3001`.

**Terminal 2 — Frontend**

```powershell
npm.cmd run dev:frontend
```

Frontend: **http://127.0.0.1:5173/**. Vite chuyển tiếp đường dẫn `/api` tới backend qua `API_PROXY_TARGET`. Đây là dev proxy, không phải cấu hình deploy production.

Kiểm tra từ PowerShell khác:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/ready
```

`/api/health` chỉ kiểm tra HTTP server; `/api/ready` phải phản hồi thành công nếu Prisma truy vấn được MySQL. Nếu `/ready` trả 503, kiểm tra MySQL, cấu hình URL, quyền tài khoản runtime và migrations. Dừng mỗi server bằng `Ctrl+C`.

## 5. Các chức năng và đường dẫn chính

| Vai trò | Chức năng/route                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------- |
| Guest   | Trang chủ `/`; Hub cơ hội `/opportunities`; lộ trình `/roadmaps`; diễn đàn `/forum`; trang đăng nhập `/login`        |
| Student | Hồ sơ `/profile`; gợi ý `/recommendations`; lịch/deadline `/calendar`; tham gia diễn đàn sau khi xác thực            |
| Admin   | Dashboard `/admin/dashboard`; kiểm duyệt `/admin/moderation`; danh mục `/admin/categories`; tài khoản `/admin/users` |

Trang `/admin/moderation` có **hai tab**: thẩm định cơ hội (UC-10) và giám sát cộng đồng/kiểm duyệt diễn đàn (UC-11). Route `/admin/opportunities` được giữ để chuyển hướng tương thích. Trang kiểm tra kỹ thuật riêng ở `/_dev/health`; **trang `/` là trang chủ thực tế**, không còn chuyển thẳng đến health check.

### Google Sign-In và quyền Admin

UniHub sử dụng Google Identity Services. Tạo hoặc sử dụng OAuth **Web Client ID** do nhóm sở hữu và thêm origin local thực tế (`http://127.0.0.1:5173`) vào **Authorized JavaScript origins** trong Google Cloud Console. Điền cùng Client ID vào `frontend/.env` và `backend/.env`; đặt `AUTH_ALLOWED_ORIGINS` khớp origin. Cần Internet và cấu hình OAuth đúng mới đăng nhập Google thành công. Không dùng ID token giả hoặc tự cho phép đăng nhập bằng email seed.

Người dùng mới từ Google có vai trò Student. Để tạo Admin đầu tiên trên database mới: đăng nhập Google hợp lệ trước, xác định đúng `google_sub` đã được backend xác minh, rồi chạy **lệnh có xác nhận tương tác**:

```powershell
npm.cmd run admin:bootstrap
```

Lệnh chỉ cấp Admin đầu tiên cho người dùng Student đã tồn tại khi đáp ứng điều kiện kiểm tra; không tạo Admin dựa trên email seed chưa xác minh. Sau đó Admin có thể quản lý vai trò theo UC-14. Không commit credential hoặc mã định danh cá nhân vào tài liệu nộp.

Operator có quyền đọc database có thể tra `google_sub` của đúng tài khoản vừa đăng nhập trong bảng `users` bằng công cụ MySQL cục bộ; không chia sẻ kết quả hoặc ID token. Sau bootstrap, đăng xuất/đăng nhập lại để nhận quyền mới. Thực hiện bootstrap **trước khi nạp fixture có tài khoản Admin**; lệnh từ chối nếu đã tồn tại Admin.

Cookie refresh hiện cố định `HttpOnly; Secure; SameSite=Strict`. Cần kiểm tra trình duyệt lưu/gửi cookie trên origin HTTP loopback đã chọn, refresh trang, hết hạn access token và logout. Nếu trình duyệt chặn cookie Secure trên HTTP, phiên có thể mất sau reload; không hạ thuộc tính cookie hoặc coi Google login một lần là đã kiểm thử session đầy đủ. Dùng cùng hostname xuyên suốt; không trộn `localhost` và `127.0.0.1`.

## 6. Dữ liệu mẫu và demo

Repository có các bộ fixture/import riêng trong `data/catalog`, `data/opportunities`, `data/guidance/demo` và `data/forum/demo`. **Chưa có script gốc `npm run prisma:seed` để nạp toàn bộ UniHub.** Các bộ dữ liệu có tiền điều kiện, chế độ dry-run và ràng buộc an toàn khác nhau:

- Danh mục cơ bản: [data/catalog/README.md](data/catalog/README.md).
- Guidance: [data/guidance/demo/README.md](data/guidance/demo/README.md).
- Forum: [data/forum/demo/README.md](data/forum/demo/README.md).
- Bộ 100 cơ hội synthetic: [data/opportunities/demo/README.md](data/opportunities/demo/README.md). Batch hiện có metadata leader_approved; ghi chú needs_review trong README dữ liệu là lịch sử. Vẫn phải chạy validation/dry-run tại thời điểm nhập, vì deadline có thể hết hạn. Không suy ra dữ liệu đã được nạp.

**Quy trình bàn giao:** chỉ nhắm `unihub_demo`. Seeder Guidance/Forum có guard tên schema; importer tổng quát và một số script seed cũ không có guard hoặc ghi ngay khi chạy. Chỉ dùng các lệnh được chỉ rõ trong hướng dẫn cài mới; giữ nguyên guard của Guidance/Forum. Trước khi chạy `--apply`, phải xem README từng bộ, xác nhận catalog prerequisite, trạng thái phê duyệt, dry-run, quyền MySQL và database đích. File fixture không có nghĩa là dữ liệu đã được seed trong MySQL.

Nếu cần trình diễn đầy đủ cho giảng viên, nhóm phải kiểm chứng quy trình khởi tạo database mới, migrations, nạp dữ liệu đã được duyệt và Google Sign-In/Student/Admin trên máy sạch. Không dùng dump database có dữ liệu cá nhân khi chưa rà soát.

Thứ tự và lệnh import cụ thể nằm ở [hướng dẫn cài mới, mục 7](docs/LOCAL-SETUP-UNIHUB-DEMO.md#7-nạp-dữ-liệu-đã-được-duyệt). Migration chỉ tạo cấu trúc; database mới chưa có nội dung. Email Reminder đã được loại bỏ; nhắc lịch hiện dùng thông báo trong ứng dụng, không cấu hình Gmail/SMTP/Resend.

## 7. Kiểm tra chất lượng source

Tại gốc repository:

```powershell
npm.cmd run prisma:validate
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run format:check
git diff --check
git status --short
```

`npm test` có thể báo `SKIP` với một số bài kiểm thử cần Playwright/Chromium hoặc MySQL test database cô lập. Ghi rõ số PASS/SKIP/FAIL của **lần chạy thực tế**; không coi SKIP là PASS. Build thành công không thay thế kiểm thử tích hợp với MySQL thật hoặc xác thực Google thật.

## 8. Cấu trúc mã nguồn

```text
UniHub/
├── frontend/                 # React/Vite, giao diện, routing, test
├── backend/
│   ├── src/                  # Express API, auth, middleware, nghiệp vụ
│   └── prisma/               # Schema và migrations MySQL
├── data/                     # Catalog, guidance, opportunities, forum fixtures
├── database/                 # Tài liệu CSDL
├── docs/                     # Tài liệu thiết kế, API, migration và kiểm thử
├── package.json              # npm workspaces và scripts tổng
└── package-lock.json         # Lockfile dùng chung
```

## 9. Xử lý sự cố thường gặp

| Triệu chứng                                       | Kiểm tra                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `node` hoặc `npm.cmd` không chạy                  | Kiểm tra Node 24, npm 11 và PATH                                                           |
| `npm ci` lỗi                                      | Đọc thông báo, kiểm tra phiên bản Node/npm và mạng; không tự ý thay lockfile               |
| `/api/health` thành công nhưng `/api/ready` = 503 | Kiểm tra MySQL, `DATABASE_URL`, quyền runtime và migration                                 |
| Frontend gọi API thất bại                         | Kiểm tra backend cổng 3001 và `API_PROXY_TARGET`, sau đó restart Vite                      |
| Google Sign-In không hoạt động                    | Đối chiếu Client ID, JavaScript origin, backend origin và trạng thái cấu hình Google OAuth |
| Không có dữ liệu ở Hub/Guidance/Forum             | Xác minh database mới đã được nạp dữ liệu được phép, không suy ra từ fixture Git           |
| Không vào được trang Admin                        | Kiểm tra đã Google login thành công và tài khoản có `role=Admin` hợp lệ                    |

## 10. Phạm vi và nguyên tắc bàn giao

- Đây là bản **cài đặt trực tiếp để trình diễn/nghiệm thu local**, không phải website đã deploy. Máy chạy cần tự cài Node/npm/MySQL; sử dụng schema `unihub_demo`.
- Không commit `.env`, mật khẩu, dữ liệu thật, `node_modules`, `dist` hoặc kết quả test tự sinh.
- Không chạy thao tác destructive như `DROP DATABASE`, `prisma migrate reset`, `git clean -fd` hoặc `git reset --hard` trong quy trình cài đặt.
- Dự án không yêu cầu Docker để chạy local; hướng dẫn này là nguồn bắt đầu cho người nhận source. Khi thay đổi cách cài đặt hay schema, cập nhật README và tài liệu liên quan đồng thời.
