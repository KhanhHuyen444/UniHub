# Cài đặt MySQL local cho UniHub (`unihub_demo`)

Tài liệu này là **hướng dẫn bàn giao cài đặt mới**. `unihub_demo` là tên schema chuẩn cho bản chạy demo/đồ án. `unihub_dev` là database phát triển cũ, **không dùng để cài đặt bản bàn giao**. Hướng dẫn không xóa, đổi tên, sao chép hoặc truy cập database phát triển cũ.

## 1. Điều kiện

- MySQL Server 8.4 đang chạy trên máy local, một tài khoản DBA có quyền tạo database/user và cấp quyền.
- Node.js `>=24.19.0 <25` và npm `>=11.9.0 <12` theo `package.json`.
- Repo vừa clone, `npm ci` thành công.
- **Không chạy các câu SQL sau nếu `unihub_demo` hoặc user tương ứng đã tồn tại**. Dùng `SHOW DATABASES` và `SELECT user, host FROM mysql.user ...` với tài khoản có quyền để kiểm tra trước. Nếu đã tồn tại, xác minh chủ sở hữu và cấu hình, không DROP/RESET.

## 2. Tạo schema và hai tài khoản

Đăng nhập MySQL CLI/Workbench bằng DBA. Chọn **hai mật khẩu mới, khác nhau**, lưu ngoài Git. SQL bên dưới là ví dụ cho một máy mới hoàn toàn; thay các chuỗi `<...>` trước khi thực thi. **Không lưu SQL đã điền mật khẩu vào Git**.

```sql
CREATE DATABASE unihub_demo
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

CREATE USER 'unihub_demo_migrator'@'localhost'
  IDENTIFIED BY '<NEW_MIGRATION_PASSWORD>';
CREATE USER 'unihub_demo_app'@'localhost'
  IDENTIFIED BY '<NEW_RUNTIME_PASSWORD>';

-- Migrator chỉ có quyền DDL/DML trong schema riêng, không cấp trên *.*.
GRANT ALL PRIVILEGES ON unihub_demo.*
  TO 'unihub_demo_migrator'@'localhost';
```

`localhost` ở đây dùng cho trường hợp MySQL và Node.js cùng máy; với MySQL host/TCP khác, xác minh quy tắc host của account trước khi áp dụng, không cấp `'%'` theo thói quen. Runtime chỉ bật lấy RSA public key tự động trên loopback; không có cấu hình TLS/CA cho remote trong hướng dẫn này. Chỉ dùng MySQL cùng máy.

## 3. Cấu hình hai URL

Các migration hiện có cần DDL và ghi `_prisma_migrations`; grant migrator ở trên chỉ giới hạn schema, không có `WITH GRANT OPTION` hay quyền toàn cục. Runtime không được cấp quyền DDL, quyền bảng migration, UPDATE/DELETE activity log hoặc DELETE session. Danh sách bảng bên dưới khớp `@@map` trong schema; Skill và hồ sơ nằm trong `categories`/`users`, không có bảng `skills`/`student_profiles` riêng.

Tại gốc repo, **không ghi đè file `.env` đã tồn tại**:

```powershell
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
if (-not (Test-Path .\backend\.env.migration)) { Copy-Item .\backend\.env.migration.example .\backend\.env.migration }
if (-not (Test-Path .\frontend\.env)) { Copy-Item .\frontend\.env.example .\frontend\.env }
```

Điền giá trị **cục bộ**, không đăng tải:

```dotenv
# backend/.env (minh họa; thay mật khẩu bằng mật khẩu runtime thực)
PORT=3001
DATABASE_URL="mysql://unihub_demo_app:<URL_ENCODED_RUNTIME_PASSWORD>@127.0.0.1:3306/unihub_demo"
# JWT_SIGNING_SECRET, JWT_ISSUER, JWT_AUDIENCE,
# GOOGLE_CLIENT_ID, AUTH_ALLOWED_ORIGINS: xem backend/.env.example
```

```dotenv
# backend/.env.migration
MIGRATION_DATABASE_URL="mysql://unihub_demo_migrator:<URL_ENCODED_MIGRATION_PASSWORD>@127.0.0.1:3306/unihub_demo"
```

Giữ `frontend/.env` với `API_PROXY_TARGET=http://127.0.0.1:3001`; thiết lập cùng Google Web Client ID ở frontend/backend, đăng ký origin local trong Google Cloud Console. URL-encode ký tự đặc biệt của user/password; không thêm query hoặc fragment vào `DATABASE_URL`.

## 4. Chạy migrations rồi cấp quyền runtime theo từng bảng

Lệnh tại gốc repo (PowerShell):

```powershell
npm.cmd run prisma:validate
npm.cmd run db:migrate:status
npm.cmd run db:migrate:deploy
npm.cmd run db:migrate:status
npm.cmd run prisma:generate
```

Trên database mới, `db:migrate:status` có thể trả mã thoát khác 0 vì còn migration chưa áp dụng; đọc thông báo để phân biệt pending với lỗi kết nối/quyền. Sau deploy, status phải xác nhận up to date. Scripts migrate nạp `backend/.env.migration`, không nạp `backend/.env`; biến môi trường shell đã đặt sẵn được ưu tiên hơn file. Trước khi chạy, operator xác minh cả host/schema của hai URL trong trình soạn thảo cục bộ, không in URL ra terminal hoặc báo cáo.

`db:migrate:deploy` có ghi cấu trúc SQL vào `unihub_demo`: chỉ chạy sau khi xác nhận đúng database đích và bạn có quyền thực hiện. Không dùng `prisma migrate reset`. Migration hiện có tạo 13 bảng **nghiệp vụ** cùng bảng kỹ thuật `_prisma_migrations`.

Sau khi migration thành công, DBA cấp quyền cho runtime account trên **từng bảng** (không cấp `ALL PRIVILEGES` cho runtime):

```sql
GRANT SELECT, INSERT, UPDATE ON unihub_demo.users TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.categories TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.opportunities TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON unihub_demo.events TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.forum_posts TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.comments TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT ON unihub_demo.activity_logs TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON unihub_demo.notifications TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_demo.user_skills TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_demo.opportunity_majors TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_demo.opportunity_skills TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_demo.opportunity_years TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.auth_sessions TO 'unihub_demo_app'@'localhost';
```

Đây là mẫu quyền theo `docs/database-migrations.md` đã kiểm tra, thay tên schema/user cho bản demo local. Nếu runtime báo thiếu quyền, xác định thao tác/tables liên quan và kiểm tra với nguyên tắc đặc quyền tối thiểu, không tự mở rộng quyền tùy tiện.

## 5. Chạy ứng dụng và xác minh kết nối

Mở hai PowerShell tại gốc repo:

```powershell
# Terminal 1
npm.cmd run dev:backend
```

```powershell
# Terminal 2
npm.cmd run dev:frontend
```

Truy cập `http://127.0.0.1:5173/`. Xác minh API tại PowerShell khác:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/ready
```

`health` chỉ xác nhận HTTP; `ready` kiểm tra kết nối thật đến MySQL. Để seed demo, xem từng `data/*/README.md`, dry-run và xác nhận phê duyệt trước khi `--apply`. **Không có một script `npm run prisma:seed` chung trong source hiện tại**. Google Sign-In và Admin bootstrap được trình bày trong README gốc.

## 6. An toàn và bàn giao

- `unihub_demo` của người cài mới **không phải** schema `unihub_demo` trên máy nhóm; GitHub không mang theo dữ liệu MySQL đã được seed.
- Giữ guard của Guidance/Forum chỉ chấp nhận `unihub_demo`. Không giả định mọi script đều có guard/dry-run; tránh chạy script seed cũ ngoài danh sách hướng dẫn.
- Không commit `.env`, token, mật khẩu hoặc dump chứa dữ liệu riêng tư.
- Không chạy `DROP DATABASE`, `prisma migrate reset` hay thao tác phá hủy trên `unihub_dev`. Không có bước dọn database cũ trong quy trình bàn giao.

## 7. Nạp dữ liệu đã được duyệt

Các lệnh sau là **hướng dẫn cho operator**, chưa được thực thi trong đợt cleanup. Chỉ apply sau khi xác nhận database đích và được phép ghi. Không có lệnh seed tổng. Chạy tại gốc repo, sau migration/grants, Google login và bootstrap Admin; build backend trước:

```powershell
npm.cmd run build --workspace @unihub/backend
```

### Catalog trước, nội dung sau

Importer nhận mảng `type/name` từ các file catalog. Với **từng file**, dry-run, xem `plan.blocked: false` và action `create/reuse`, sau đó mới chạy apply. Không chạy liền apply nếu dry-run lỗi. Thứ tự:

1. `data/catalog/initial-categories.json` (bộ cơ bản).
2. `data/catalog/expanded-majors.json` (ngành mở rộng).
3. `data/catalog/expanded-skills.json` (kỹ năng mở rộng).
4. `data/opportunities/demo/catalog.json` (snapshot demo đầy đủ, bổ sung Major **Kinh doanh số và trí tuệ nhân tạo** còn thiếu trong ba file trên; các tên đã có được reuse).

Ví dụ bộ cơ bản; thay đúng đường dẫn `--file` cho ba bộ tiếp theo:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/catalog/initial-categories.json --dry-run
# Chỉ sau khi review kết quả và được phép ghi:
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/catalog/initial-categories.json --apply
```

Importer giữ danh mục đã có, từ chối danh mục Closed/không rõ ràng; không sửa ID hoặc bật lại trạng thái để vượt kiểm tra. Dùng truy vấn chỉ đọc để đối chiếu từng tên mà fixture tham chiếu, không chỉ tổng số. Các file mapping nghề nghiệp là dữ liệu tham khảo của ứng dụng, không phải script ghi database.

### Cơ hội

`data/opportunities/demo/batch-proposal.json` có metadata phê duyệt `leader_approved`; báo cáo needs_review trong README cùng thư mục là lịch sử. Không sửa metadata/deadline để vượt validation. Batch và thời hạn cần kiểm tra lại ở thời điểm cài:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --file data/opportunities/demo/batch-proposal.json --dry-run
# Chỉ khi dry-run hợp lệ, không blocked và được phép ghi:
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --file data/opportunities/demo/batch-proposal.json --apply
```

Importer tạo **Pending**, không tự xuất bản. Admin dùng tab Tin chờ thẩm định tại `/admin/moderation` để duyệt các tin được chọn; chỉ Approved mới xuất hiện công khai. JSON trong Git không chứng minh bản MySQL nào đã import. Không dùng generator để tự gia hạn dữ liệu hết hạn.

### Guidance và Forum

Sau catalog, đọc tiền điều kiện trong [Guidance](../data/guidance/demo/README.md) và [Forum](../data/forum/demo/README.md). Các ví dụ dưới dùng `backend/.env` vừa cấu hình `unihub_demo`, thay vì phụ thuộc file `.env.demo` riêng của nhóm:

```powershell
node --env-file=backend/.env data/guidance/demo/seed-guidance-demo.mjs
node --env-file=backend/.env data/forum/demo/seed-forum-demo.mjs
```

Hai lệnh mặc định dry-run, kiểm tra catalog/đích. Chỉ thêm `--apply` cho từng lệnh khi đã review và có phép ghi; Guidance hỗ trợ `--verify` sau import. Fixture Forum tạo tác giả mẫu, không tạo danh tính Google được xác minh; email fixture không cấp quyền đăng nhập. Không chạy test safety/live từ README dữ liệu trên database có dữ liệu cần giữ: một số test ghi/rollback hoặc tạo nội dung kiểm thử.

**Không dùng trong quy trình cài mới:** `seed-dev-opportunities.mjs` và `seed-major-coverage.mjs`. Hai script cũ ghi/update ngay khi chạy và không có guard schema/dry-run như Guidance/Forum. Đây là phát hiện cần review riêng nếu nhóm còn sử dụng, không được sửa runtime trong nhiệm vụ tài liệu này.

## 8. Checklist xác minh trên máy mới

- Xác minh MySQL 8.4, migrations up to date, `health` và `ready` đều 200.
- Kiểm tra Google login thật, reload/refresh session, logout; Student bị chặn Admin, Admin truy cập đúng bốn trang.
- Sau apply được phép: đối chiếu số bản ghi/tên catalog và nội dung; duyệt Pending rồi kiểm tra Hub và gợi ý theo hồ sơ.
- Kiểm tra Guidance, Forum, Calendar và Notification Bell; tạo sự kiện thử riêng và kiểm tra scheduler nhắc trong ứng dụng, không gửi email.
- Ghi riêng kết quả thực tế, test skip và các bước chưa chạy. Đợt cleanup source không chứng minh cài mới MySQL hoặc Google OAuth đã thành công.
