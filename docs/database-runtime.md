# Prisma runtime và kết nối MySQL

Tài liệu này mô tả Prisma runtime của backend, cấu hình MySQL cục bộ trên Windows và kết quả kiểm tra. Initial migration đã được merge vào `main` qua PR #4; nhánh runtime dùng migration đã có, không tạo lại hoặc sửa migration đó. Mọi lần chạy MySQL trong Codex dùng container thử nghiệm tạm và credentials ngẫu nhiên; database của thành viên không được truy cập.

## Phạm vi hiện tại

- `backend/src/lib/prisma.ts` tạo Prisma Client dùng chung, đọc duy nhất `DATABASE_URL` và tạo pool qua `@prisma/adapter-mariadb` 7.10.1. MariaDB Connector/Node.js 3.5.4 là driver của adapter để kết nối MySQL; database vẫn là MySQL 8.4.
- Client/pool được tạo theo nhu cầu khi `/api/ready` lần đầu truy vấn. Không tạo client cho từng request. Nếu thiếu hoặc URL sai, `/api/health` vẫn hoạt động; readiness trả 503.
- `GET /api/health` xác nhận HTTP server đang phản hồi. `GET /api/ready` chạy `SELECT 1` và chỉ trả sẵn sàng khi truy vấn thành công. Xem [quy ước API](api-conventions.md).
- Prisma CLI migration dùng `MIGRATION_DATABASE_URL` riêng trong `backend/prisma.config.ts`. Runtime tuyệt đối không dùng biến này làm fallback. Không cần chạy lại migration nếu database đã được cập nhật.
- Backend có API đọc công khai Hub cơ hội; chưa có API ghi/Admin, đăng nhập, JWT hoặc xử lý Reminder. Kiểm thử runtime bên dưới chỉ chứng minh kết nối, quyền MySQL và transaction truy cập dữ liệu, không thay thế kiểm thử endpoint cơ hội.
- `google_sub`/`auth_sessions` và quyền runtime cho session đang được thêm trên nhánh `feat/auth-schema-migration`, chưa có trên `main` hoặc database nhóm. Migration/GRANT được kiểm thử riêng trên MySQL tạm 8.4.13; điều đó chưa triển khai Google login, JWT, refresh/logout hoặc middleware.

## Pool, thời gian và xác thực MySQL

Mỗi tiến trình backend dùng một pool với giới hạn **5 kết nối**. Giá trị này giữ tài nguyên nhỏ cho phát triển cục bộ, không phải thiết kế capacity production hay bằng chứng đạt NFR tải đồng thời.

| Tùy chọn          |  Giá trị | Mục đích                                                                         |
| ----------------- | -------: | -------------------------------------------------------------------------------- |
| `connectionLimit` |        5 | Giới hạn số kết nối trong pool của một backend process                           |
| `connectTimeout`  |   5 giây | Dừng sớm khi MySQL không chấp nhận kết nối mới                                   |
| `acquireTimeout`  |   5 giây | Không chờ vô hạn khi pool đã kín                                                 |
| `socketTimeout`   |  10 giây | Giới hạn chờ phản hồi socket                                                     |
| `idleTimeout`     | 600 giây | Thu hồi kết nối không hoạt động sau 10 phút                                      |
| `timezone`        |      `Z` | MariaDB driver đặt session timezone thành `+00:00` trên từng physical connection |

MySQL `DATETIME(0)` không lưu timezone. Driver của adapter đặt timezone session UTC khi mỗi kết nối vật lý được tạo; Prisma adapter riêng cũng chuyển đổi giá trị `DateTime` theo UTC. Vì vậy `CURRENT_TIMESTAMP`/`ON UPDATE CURRENT_TIMESTAMP` dùng UTC theo session, API nên trao đổi ISO 8601 UTC, còn giao diện hiển thị `Asia/Ho_Chi_Minh`. Không đặt timezone một lần bằng một truy vấn rời rạc rồi giả định mọi kết nối trong pool dùng cùng giá trị.

MySQL 8.4 dùng `caching_sha2_password` theo mặc định. Driver cần TLS hoặc khóa RSA để xác thực tài khoản khi kết nối TCP. Với môi trường phát triển, runtime chỉ bật `allowPublicKeyRetrieval` khi hostname của `DATABASE_URL` là loopback (`localhost`, `127.0.0.0/8` hoặc `::1`). Driver lấy public key từ MySQL để mã hóa mật khẩu; public key đó không được xác thực qua TLS. Giới hạn này dành cho kết nối cùng máy qua loopback, không dùng cho database từ xa hoặc production. Trước khi dùng remote MySQL cần bổ sung cấu hình TLS và xác thực CA rõ ràng; runtime hiện không bật lấy khóa cho host ngoài loopback.

## Cấu hình Windows

Các lệnh dưới đây chạy tại **gốc repository `UniHub`**, nơi có `package.json` và `package-lock.json`. Nếu thành viên đã áp dụng initial migration thì không chạy lại lệnh migration chỉ để dùng runtime.

Tạo file local từ mẫu mà không ghi đè file đã có:

```powershell
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
notepad .\backend\.env
```

Trong `backend/.env`, cập nhật `DATABASE_URL` bằng host, port, schema và tài khoản **runtime** `unihub_app` đã được cấp quyền theo [mẫu GRANT](database-migrations.md#tai-khoan-va-quyen). Không dùng tài khoản migration hoặc root cho tiến trình backend. `.env` thật đã bị Git ignore; không gửi file hoặc mật khẩu vào chat. Ví dụ dạng URL:

```text
mysql://unihub_app:<encoded-password>@localhost:3306/unihub_dev
```

Mã hóa ký tự đặc biệt trong username/password theo URL percent-encoding trước khi đặt vào URL, ví dụ `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`, `#` → `%23`, `%` → `%25`, `+` → `%2B`. Không thêm query string hoặc fragment (`?`/`#`) vào URL hiện tại. Giá trị trong `.env.example` chỉ là placeholder, không phải tài khoản chạy được.

Runtime chỉ đọc `DATABASE_URL`. `MIGRATION_DATABASE_URL` thuộc công cụ migration và không được tự nạp hoặc dùng thay thế trong server. Các lệnh generate/build/dev dưới đây không chạy migration:

```powershell
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev:backend
```

`predev`, `pretypecheck` và `prebuild` tự chạy Prisma generate; có thể bỏ lệnh generate riêng sau lần cài sạch. Backend đọc `backend/.env` khi lệnh dev chạy. Server mặc định nghe tại `http://127.0.0.1:3001`.

Mở PowerShell thứ hai tại bất kỳ thư mục nào để kiểm tra:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/ready
```

Health phải trả HTTP 200 dù MySQL chưa cấu hình. Readiness trả HTTP 200 khi `SELECT 1` đạt; trả HTTP 503 khi thiếu/sai URL hoặc database chưa sẵn sàng. Nếu lệnh PowerShell báo exception cho 503, đó là kết quả kiểm tra không sẵn sàng chứ không phải health server bị dừng. Đọc thông báo, kiểm tra host/port, quyền runtime và database; không in URL hoặc mật khẩu khi chia sẻ log. Nhấn `Ctrl+C` để dừng backend; server ngừng nhận request, chờ tối đa 10 giây để đóng HTTP connection rồi ngắt Prisma pool.

Để tạo/cấp runtime user, quản trị viên MySQL thực hiện các lệnh mẫu đã ghi trong [database-migrations.md](database-migrations.md#tai-khoan-va-quyen). Mẫu cấp `DELETE` trên `notifications` nhưng không cấp `DELETE` trên `users`, `activity_logs` hoặc database-wide. `activity_logs` chỉ có `SELECT, INSERT`. Không có lệnh nào trong tài liệu này đã chạy trên MySQL của nhóm.

## Kết quả kiểm thử

Đã chạy trên MySQL chính thức `mysql:8.4`, server **8.4.13**, bằng schema tạm `unihub_runtime_test` không gắn volume. Tài khoản migration và runtime được tạo ngẫu nhiên riêng cho container; quyền runtime theo mẫu trong database-migrations.md. Container bị xóa sau test.

- Dùng Prisma CLI và đúng initial migration đã có trên `origin/main`: `migrate deploy` áp dụng một migration, `migrate status` xác nhận up to date. Không sửa hoặc tạo lại file migration.
- Dùng `unihub_app` kết nối qua Prisma 7.10.1 với mật khẩu thử có ký tự cần URL-encode. Ứng dụng Express thực tế trả `/api/health` 200 và `/api/ready` 200.
- Giữ đồng thời năm transaction để kiểm tra năm physical connection riêng; cả năm trả `@@session.time_zone = '+00:00'`.
- Ghi và đọc lại `DATETIME(0)` qua Prisma; ISO UTC giữ nguyên chính xác đến giây.
- Runtime user tạo/đọc notification và xóa Reminder mà không xóa event. Trong một transaction, xóa notification rồi reset `reminded_at`; chủ động rollback và xác nhận cả notification lẫn giá trị timestamp được phục hồi.
- Runtime user `INSERT`/`SELECT` được `activity_logs`; MySQL từ chối `UPDATE` và `DELETE` trên bảng này.
- MySQL thật không tham gia test HTTP không cần DB: các test HTTP độc lập xác nhận thiếu/sai cấu hình và lỗi kết nối trả 503 an toàn, không lộ URL hoặc thông tin driver; health vẫn trả 200 khi server không có DATABASE_URL.
- Auth schema trong nhánh được kiểm thử riêng trên MySQL 8.4.13: fresh deploy cả ba migrations và upgrade database có hai migrations cùng bản ghi cũ; xác nhận dữ liệu cũ giữ nguyên, `google_sub` và deadline metadata legacy NULL, collation case-sensitive, UNIQUE/FK/RESTRICT/defaults, timestamp UTC, runtime `auth_sessions` SELECT/INSERT/UPDATE, cấm DELETE/DDL, và `activity_logs` chỉ SELECT/INSERT. Lần deploy lặp không chạy lại migration. Đây là SQL/schema/GRANT test, không gọi endpoint auth.

> Đây là kiểm thử adapter, readiness, quyền SQL và transaction Prisma trên database dùng một lần. Nó **không phải kiểm thử API nghiệp vụ Reminder**: chưa xác nhận validation due date/remind-before, ownership, điều kiện chọn Reminder cũ hay nghiệp vụ ở route/service.

Kiểm thử chạy trong Codex/Linux, không phải trên máy Windows của thành viên. Nhóm vẫn cần đối chiếu giới hạn Node/MySQL của môn học và tự kiểm tra local MySQL/Workbench của mình.

## Tài liệu kỹ thuật

- [Prisma v7 MySQL connector](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/core-concepts/supported-databases/mysql.mdx) và [adapter `@prisma/adapter-mariadb` 7.10.1](https://registry.npmjs.org/@prisma%2fadapter-mariadb/7.10.1).
- [MariaDB Connector/Node.js 3.5.4](https://registry.npmjs.org/mariadb/3.5.4); typings/source của gói đã xác nhận `timezone`, pool timeout và `allowPublicKeyRetrieval`.
- [MySQL 8.4 `caching_sha2_password`](https://dev.mysql.com/doc/refman/8.4/en/caching-sha2-pluggable-authentication.html) và [`DATETIME`](https://dev.mysql.com/doc/refman/8.4/en/datetime.html).
