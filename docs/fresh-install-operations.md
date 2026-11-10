# Cấu hình và vận hành bản cài mới UniHub

Theo thứ tự trong [README](../README.md). Mặc định backend 3001, frontend 5173; mọi lệnh PowerShell chạy tại gốc repo. Không đọc/in secret khi chẩn đoán hoặc gửi báo cáo.

## 1. Biến môi trường

| Biến                     | File / consumer thực tế                        | Yêu cầu                                                                                                   |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | `backend/.env`; `src/lib/prisma.ts`            | Runtime riêng, MySQL loopback, schema `unihub_demo`; user/password bắt buộc, URL-encode, không query/hash |
| `MIGRATION_DATABASE_URL` | `backend/.env.migration`; `prisma.config.ts`   | Migrator riêng, cùng schema; runtime không fallback sang biến này                                         |
| `PORT`                   | `backend/.env`; `src/config/env.ts`            | Số nguyên 1–65535, mặc định 3001                                                                          |
| `API_PROXY_TARGET`       | `frontend/.env`; `vite.config.ts`              | URL backend, mặc định `http://127.0.0.1:3001`; chỉ Vite server đọc                                        |
| `JWT_SIGNING_SECRET`     | `backend/.env`; `modules/auth/access-token.ts` | Ngẫu nhiên, UTF-8 ít nhất 32 byte; placeholder bị code từ chối                                            |
| `JWT_ISSUER`             | Cùng file/consumer JWT                         | Chuỗi không rỗng; mẫu `http://127.0.0.1:3001`                                                             |
| `JWT_AUDIENCE`           | Cùng file/consumer JWT                         | Chuỗi không rỗng; mẫu `unihub-demo-api`                                                                   |
| `GOOGLE_CLIENT_ID`       | `backend/.env`; `modules/auth/auth.routes.ts`  | OAuth Web Client ID để backend xác minh Google token                                                      |
| `VITE_GOOGLE_CLIENT_ID`  | `frontend/.env`; `GoogleIdentityButton.tsx`    | Cùng Client ID backend; định danh công khai, không phải client secret                                     |
| `AUTH_ALLOWED_ORIGINS`   | `backend/.env`; `auth.routes.ts`               | Danh sách origin frontend phân cách bằng dấu phẩy; mẫu `http://127.0.0.1:5173`                            |

Node npm scripts nạp `.env` runtime hoặc `.env.migration` trong workspace backend; không tự nạp `.env.demo`/`.env.demo.migration`. Nếu chủ động dùng file khác, cần dùng cùng file cho backend, bootstrap và seed; luồng cài mới thống nhất dùng file mặc định để tránh lệch database/cổng.

Biến shell được ưu tiên hơn file. Khi nghi bị ghi đè, chỉ xem **tên** biến:

```powershell
Get-ChildItem Env: | Where-Object { $_.Name -in @('PORT','DATABASE_URL','MIGRATION_DATABASE_URL','API_PROXY_TARGET','JWT_ISSUER','JWT_AUDIENCE','JWT_SIGNING_SECRET','GOOGLE_CLIENT_ID','VITE_GOOGLE_CLIENT_ID','AUTH_ALLOWED_ORIGINS') } | Select-Object Name
```

Mở terminal mới không có override hoặc chủ động bỏ đúng biến override đã xác minh trong phiên hiện tại; không in giá trị URL/secret. Khởi động lại backend sau sửa `.env`, Vite sau sửa `frontend/.env`. Vite dùng `loadEnv(mode, frontendDirectory, 'API_PROXY_TARGET')`; file theo mode/local có thể ảnh hưởng cấu hình. Không đưa bí mật vào biến `VITE_`.

Tạo khóa ngẫu nhiên bằng trình quản lý mật khẩu hoặc công cụ sinh khóa cục bộ, lưu trực tiếp vào `.env`; không dùng lại placeholder hoặc chia sẻ khóa. Backend ký và xác minh JWT cùng cấu hình issuer/audience. Đổi issuer/khóa sẽ khiến token cũ không hợp lệ, cần đăng nhập lại.

## 2. Cổng và tiến trình

Nếu backend báo `EADDRINUSE` hoặc PowerShell báo không kết nối được HTTP, xem cổng trong dòng `UniHub HTTP server: ...`. Kiểm tra listener và đúng PID trước khi dừng:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3001 | Select-Object LocalAddress,LocalPort,OwningProcess
# Thay 12345 bằng OwningProcess vừa tìm, không chạy với PID suy đoán:
Get-Process -Id 12345 | Select-Object Id,ProcessName,Path
```

Nếu máy không hỗ trợ cmdlet hoặc thiếu quyền, dùng `netstat -ano -p tcp` và đối chiếu PID trong Task Manager. Ưu tiên `Ctrl+C` tại terminal sở hữu server cũ. Không dừng mọi `node.exe` vì backend/frontend khác có thể đang dùng.

Nếu cổng 3001 phải dành cho tiến trình khác, chọn một cổng trống và:

1. Đặt `PORT` trong `backend/.env` theo cổng mới.
2. Đặt `API_PROXY_TARGET` trong `frontend/.env` theo cùng cổng/hostname.
3. Nếu dùng issuer URL theo mẫu, cập nhật `JWT_ISSUER` theo URL mới và đăng nhập lại. Code chỉ yêu cầu chuỗi issuer nhất quán, không tự suy ra từ PORT.
4. Restart backend và frontend; gọi `/api/health`, `/api/ready` đúng cổng backend và `/api/ready` qua frontend 5173.

`AUTH_ALLOWED_ORIGINS` và Google Authorized JavaScript origins vẫn là **origin frontend**, không đổi sang cổng backend. Vite cố định `strictPort: true`: nếu 5173 bận thì báo lỗi, không tự nhảy cổng. Nếu chủ động đổi frontend bằng `npm.cmd run dev:frontend -- --port <CONG_TRONG>`, thay placeholder bằng số thật và cập nhật hai origin trên, dùng đúng URL mới xuyên suốt.

`/ready` 503 phân biệt thiếu URL, URL không hợp lệ, database unavailable. URL hợp lệ vẫn có thể sai schema/password/quyền. Readiness `SELECT 1` thành công không kiểm tra đủ bảng hoặc quyền DML; cần migration status và checklist nghiệp vụ. Khi migration lỗi DDL, lưu lỗi đã che thông tin nhạy cảm, kiểm tra lịch sử/cấu trúc bằng DBA; không reset, sửa migration cũ hoặc tự đánh dấu applied để né lỗi.

## 3. Google Sign-In và Admin đầu tiên

Tham khảo [hướng dẫn Google Identity Services chính thức](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) khi thiết lập Client ID và Authorized JavaScript origins; tên mục trong Console có thể thay đổi.

Thực hiện sau migration/GRANT runtime, trước seed nội dung. Catalog không phải điều kiện của Google Login vì hồ sơ mới được phép chưa có ngành/năm.

1. Người quản lý project Google Cloud chuẩn bị OAuth consent screen/audience theo project. Nếu ứng dụng còn Testing và có giới hạn test user, thêm tài khoản Google dùng nghiệm thu vào danh sách phù hợp. Dùng project nhóm khi đã được chia sẻ quyền, hoặc tạo project riêng có quyền quản lý.
2. Trong Google Cloud Console, tạo OAuth Client loại **Web application**. Thêm Authorized JavaScript origin chính xác `http://127.0.0.1:5173` (không có path). Nếu thực sự dùng hostname/cổng khác, đăng ký origin đó. Luồng hiện tại dùng Google Identity Services ID token, không cần thêm redirect callback do mình tự suy diễn.
3. Sao chép **Client ID**, không phải Client Secret, vào `GOOGLE_CLIENT_ID` backend và `VITE_GOOGLE_CLIENT_ID` frontend. Đặt `AUTH_ALLOWED_ORIGINS` khớp frontend. Restart cả hai server.
4. Mở `/login` trên origin đã đăng ký và đăng nhập tài khoản Google thật. Backend xác minh token; tài khoản mới nhận Student. Không dùng Google token giả, email fixture hoặc nhập role từ client.
5. Trong MySQL CLI/Workbench cục bộ với quyền đọc đúng `unihub_demo`, tra email tài khoản vừa đăng nhập bằng truy vấn chỉ đọc sau (thay placeholder cục bộ, không lưu kết quả cá nhân vào Git/chat):

```sql
USE unihub_demo;
SELECT user_id, email, full_name, role, google_sub
FROM users
WHERE email = '<EMAIL_VUA_DANG_NHAP>';
```

Chỉ dùng `google_sub` không NULL của đúng tài khoản Google vừa được backend xác minh, không tự suy từ email. Nếu không tìm thấy, kiểm tra đăng nhập đã thành công và công cụ MySQL đang dùng cùng schema với backend; không INSERT user để thay đăng nhập.

6. Tại PowerShell gốc repo chạy `npm.cmd run admin:bootstrap`. Script nạp `backend/.env`, yêu cầu nhập Google sub, hiển thị tên/email/user_id để kiểm tra và chỉ cấp quyền khi nhập chính xác `PROMOTE`. Mọi câu trả lời khác hủy.
7. Đăng xuất/đăng nhập lại để nhận access token có role Admin rồi mở `/admin/dashboard`. Dùng một tài khoản Google thật khác cho các ca Student; Admin không thay thế kiểm thử Student-only.

### Điều kiện từ chối theo code

`admin-bootstrap.ts` từ chối input rỗng/quá 255 ký tự; database đã có bất kỳ Admin; không tìm thấy user theo google_sub; user không phải Student; người vận hành không xác nhận; tài khoản thay đổi đồng thời; hoặc lỗi DB/quyền. Script khóa dòng user nhỏ nhất và kiểm tra lại điều kiện trong transaction để tránh hai bootstrap đồng thời. Kết quả khác `promoted` có exit code 1; đọc thông báo để phân biệt hủy/từ chối với lỗi hạ tầng.

Nếu đã có Admin, dùng Admin đó cấp quyền tại `/admin/users`. Không xóa Admin để chạy bootstrap hoặc UPDATE role trực tiếp bằng SQL. Nếu không truy cập được Admin hiện có, nhờ người sở hữu hệ thống xử lý; đây không phải quy trình khôi phục tài khoản.

Cookie refresh cố định `HttpOnly; Secure; SameSite=Strict`, access token tối đa 15 phút, refresh tối đa 7 ngày. Cần kiểm tra browser lưu/gửi cookie trên HTTP loopback, reload, refresh và logout thực tế. Không trộn `localhost` với `127.0.0.1`, không hạ bảo mật cookie để khiến demo báo đạt.
