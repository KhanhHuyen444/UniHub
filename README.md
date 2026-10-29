# UniHub

UniHub là nền tảng hỗ trợ học tập và định hướng nghề nghiệp cho sinh viên. `main` có bộ khung chung, Public Hub cơ hội, Guidance public, Events API, danh mục Major/Skill và API Admin duyệt cơ hội; `GET /api/opportunities` cùng `GET /api/opportunities/:id` là API đọc công khai. `GET /api/health` kiểm tra liveness HTTP; `GET /api/ready` kiểm tra khả năng chạy truy vấn MySQL.

Health chỉ xác nhận HTTP server; readiness dùng Prisma Client dùng chung và adapter MySQL để chạy `SELECT 1`. Server khởi động được khi thiếu `DATABASE_URL`, khi đó health trả 200 còn readiness trả 503. Auth schema/backend bốn API và backend Admin duyệt cơ hội (PR #24) đã có trên `main`; frontend auth được kế thừa từ nhánh `feat/auth-frontend` và cần merge trước khi tích hợp UI Admin hiện tại. Xem [hướng dẫn runtime database](docs/database-runtime.md) và [database-migrations.md](docs/database-migrations.md). Không có tài khoản mẫu; shared UI preview vẫn chỉ là preview, không xác thực. Health/preview không cần MySQL hoặc Docker.

TV1 điều phối mục lục và trạng thái các hợp đồng API tại [docs/api-contracts.md](docs/api-contracts.md); leader duyệt toàn bộ contract trước khi thành viên triển khai. Hợp đồng không đồng nghĩa endpoint đã có code. Auth schema/migration/GRANT đã có trên `main`; mỗi database đích phải xác nhận migration và quyền đã áp dụng trước khi chạy auth.

## 1. Công nghệ và điều kiện môi trường

| Thành phần        | Phiên bản / vai trò                                                      |
| ----------------- | ------------------------------------------------------------------------ |
| Node.js           | 24.19.0 thuộc dòng 24 LTS; chạy JavaScript và công cụ phát triển         |
| npm               | Khuyến nghị 11.9.0; dùng npm 11 từ 11.9.0, một lockfile ở gốc            |
| Git               | Cài Git for Windows; quản lý commit, nhánh và đồng bộ GitHub             |
| Frontend          | React 19.3.1, TypeScript 5.9.3, Vite 8.3.5, Tailwind CSS 3.4.19          |
| Backend           | Express 5.3.0 + TypeScript; Prisma 7.10.1 + adapter MySQL, ES modules    |
| Database / schema | MySQL 8.4 LTS; Prisma runtime dùng `DATABASE_URL`, pool tối đa 5 kết nối |

Antigravity là IDE (trình soạn thảo và chạy terminal), không thay thế Node.js/Git. Những công cụ có sẵn ở Codex **không có nghĩa máy Windows của bạn đã cài**. Cài Git từ [git-scm.com](https://git-scm.com/downloads/win) và Node.js từ [nodejs.org](https://nodejs.org/en/download), chọn đúng dòng/phiên bản trên, rồi mở lại terminal/IDE. `.nvmrc` chỉ ghi phiên bản, không tự cài Node.

Giới hạn phần mềm của môn học vẫn cần đối chiếu; chưa có bằng chứng máy phòng học hỗ trợ phiên bản đã chọn. Không tự đổi major nếu gặp xung đột. Tailwind 3.4 giữ yêu cầu trình duyệt cũ trong Chương 3; chưa kiểm thử đủ mọi trình duyệt tối thiểu.

## 2. Lấy bộ khung về máy Windows

Scaffold, schema, initial migration và Prisma runtime đã vào `main` qua PR #2–#5. Bắt đầu từ `main` mới nhất để nhận bộ khung chung. Nếu database đã được migration, làm theo [hướng dẫn runtime](docs/database-runtime.md); không áp dụng lại migration.

Mở PowerShell trong Antigravity hoặc Windows. Ví dụ dưới đây dùng thư mục Documents; có thể chọn nơi khác nhưng phải điều chỉnh đường dẫn ở các lệnh sau.

**Thư mục chạy: thư mục cha nơi muốn lưu dự án, ví dụ Documents.**

```powershell
Set-Location "$HOME\Documents"
git clone --branch main --single-branch https://github.com/KhanhHuyen444/UniHub.git
Set-Location .\UniHub
git status
```

`clone` tải một bản repository về máy; `--branch main` chọn nhánh tích hợp. Sau đó mở **cả thư mục UniHub** trong Antigravity, không chỉ frontend hoặc backend.

Nếu đã clone trước đó, không clone đè lên thư mục có sẵn. **Tại gốc repository hiện có**, chạy `git status`; nếu có thay đổi của bạn thì commit hoặc lưu chúng an toàn trước khi chuyển nhánh. Khi working tree sạch:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
```

Nếu nhánh local chưa tồn tại và Git không tự tạo tracking branch, dùng `git switch --track origin/main`. Không dùng reset/clean để xử lý thay đổi chưa commit.

## 3. Cài dependency tại gốc repository

**Thư mục chạy: `Documents\UniHub`, nơi có package.json gốc.**

```powershell
node --version
npm.cmd --version
git --version
npm.cmd ci
```

Dependency là các thư viện dự án sử dụng. `npm ci` cài đúng phiên bản trong `package-lock.json`; không chạy npm install riêng từng ứng dụng. Lệnh này có thể thay thế thư mục node_modules cũ, nhưng không xóa mã nguồn.

Dùng `npm.cmd` trong hướng dẫn PowerShell để tránh lỗi chính sách chạy file `npm.ps1`; không cần nới ExecutionPolicy. Trên Linux/macOS dùng `npm` với các tham số tương tự. Nếu npm quá cũ hoặc ngoài dòng 11, cài bản đã chọn bằng `npm.cmd install --global npm@11.9.0`, rồi kiểm tra lại. Nếu không có quyền cài phần mềm trên máy môn học, trao đổi với nhóm/giảng viên thay vì bỏ qua yêu cầu phiên bản.

Hai file cấu hình mẫu không chứa bí mật. Bộ khung chạy được với mặc định; nếu muốn tạo cấu hình cục bộ, chạy **từ gốc UniHub**:

```powershell
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
if (-not (Test-Path .\frontend\.env)) { Copy-Item .\frontend\.env.example .\frontend\.env }
```

Không ghi đè `.env` đã có. `backend/.env` dùng `PORT=3001` và `DATABASE_URL` tài khoản runtime; `frontend/.env` dùng `API_PROXY_TARGET=http://127.0.0.1:3001`. Nếu đổi cổng backend, đổi cả đích proxy rồi khởi động lại hai tiến trình. `API_PROXY_TARGET` do Vite dev server đọc, không phải bí mật; biến `VITE_` không được chứa mật khẩu hoặc khóa backend. Hiện không cần `.env` ở gốc. Runtime chỉ đọc `DATABASE_URL`, không dùng `MIGRATION_DATABASE_URL` làm dự phòng.

## 4. Chạy bằng hai terminal

**Terminal 1 — tại gốc UniHub, chạy backend:**

```powershell
Set-Location "$HOME\Documents\UniHub"
npm.cmd run dev:backend
```

Giữ terminal mở. Trước khi chạy dev, npm sinh Prisma Client; backend mặc định nghe tại `http://127.0.0.1:3001` và tự khởi động lại khi sửa mã nguồn. Node nạp `.env` trong workspace backend nếu tệp tồn tại. Không có `DATABASE_URL` vẫn chạy HTTP và health; readiness báo 503.

**Terminal 2 — cũng tại gốc UniHub, chạy frontend:**

```powershell
Set-Location "$HOME\Documents\UniHub"
npm.cmd run dev:frontend
```

Mở trình duyệt tại **`http://127.0.0.1:5173`**. `/` chuyển tới `/_dev/health`; trang hiển thị "Đang kiểm tra kết nối…", sau đó "Backend hoạt động" nếu nhận đúng health JSON. Nếu backend chưa chạy, trang báo "Không kết nối được backend"; chạy backend rồi bấm **Thử lại**. Mỗi lần kiểm tra có timeout 5 giây. Yêu cầu bị hủy/bỏ qua khi component được tháo khỏi trang hoặc lần kiểm tra đã hết hiệu lực. Đường dẫn chưa triển khai hiển thị trang 404 tối giản, không có menu giả.

Component/layout preview không cần backend: chỉ cần Terminal 2 chạy frontend. Mở một URL sau để xem shell tương ứng:

```text
http://127.0.0.1:5173/_dev/ui?area=public
http://127.0.0.1:5173/_dev/ui?area=student
http://127.0.0.1:5173/_dev/ui?area=admin
```

Thanh chọn shell và các mục nav trong preview chỉ đổi trạng thái xem trước. Student/Admin preview không xác thực; nút đăng nhập, chuông, đăng xuất không hoạt động. Footer giữ cột Hỗ trợ với hai mục đã chốt “Điều khoản sử dụng” (`/terms`) và “Chính sách bảo mật” (`/privacy`). Preview tiếp tục hiển thị chữ tĩnh cho đến khi nhóm cung cấp nội dung trang; chưa tạo trang rỗng hoặc tự soạn chính sách.

Frontend gọi đường dẫn tương đối `/api/health`; Vite **dev proxy** chuyển `/api` tới backend. Proxy là cơ chế chuyển tiếp yêu cầu khi phát triển, **chưa phải cấu hình production**. Build frontend không tự tạo proxy hoặc hosting. Cả hai server hiện chỉ nghe loopback trên máy đang chạy, không mở ra Internet.

**Terminal thứ ba, ở bất kỳ thư mục nào**, kiểm tra trực tiếp API:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

Kết quả tương ứng JSON `{"status":"ok","service":"unihub-api"}`. Không có kiểm tra MySQL trong endpoint này. Nếu đã cấu hình `backend/.env`, kiểm tra readiness:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/ready
```

HTTP 200 nghĩa là truy vấn `SELECT 1` thành công; HTTP 503 nghĩa là cần kiểm tra `DATABASE_URL`, MySQL và quyền tài khoản theo [database-runtime.md](docs/database-runtime.md). Không gửi file `.env` hoặc mật khẩu vào chat. Nhấn **Ctrl+C** ở mỗi terminal để dừng server.

## 5. Kiểm tra trước khi gửi thay đổi

**Tất cả lệnh sau chạy tại gốc UniHub:**

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run format:check
git status
```

- `typecheck`: kiểm tra kiểu TypeScript của cả frontend/backend.
- `build`: tạo `frontend/dist` và `backend/dist`. Thư mục dist là kết quả sinh tự động, không commit.
- `test`: chạy kiểm thử API client và tương thích Tailwind/CSS ở frontend, build backend rồi chạy kiểm thử HTTP/config bằng `node:test` có sẵn trong Node.js. Chưa có kiểm thử E2E xuyên frontend-backend-MySQL hoặc toàn bộ UI. Lý do kiểm tra CSS và phạm vi override dependency ở [dependency-security.md](docs/dependency-security.md).
- `format:check`: kiểm tra định dạng mã và tài liệu mới bằng Prettier. Nếu cần sửa định dạng, chạy `npm.cmd run format`, xem diff rồi kiểm tra lại. Hai tài liệu kiến trúc cũ được giữ định dạng riêng để tránh sửa hàng loạt phần đã review.

Chưa cấu hình ESLint; TypeScript dùng strict và Prettier lo định dạng. Không có thêm framework kiểm thử hoặc công cụ chạy song song chỉ để dự phòng.

Để thử **backend từ bản build**, dừng backend dev đang chiếm cổng 3001; sau khi đã chạy build, **tại gốc UniHub**:

```powershell
npm.cmd run start --workspace @unihub/backend
```

Frontend dev ở terminal 2 vẫn gọi được backend này. Đây là kiểm tra bản build cục bộ, không phải deploy production.

## 6. Cấu trúc và cách 5 người bắt đầu

```text
UniHub/
├── frontend/src/
│   ├── app/                 # router, health, 404, shared UI preview
│   ├── components/ui/       # Button, Input, Select, FormField, Badge, Card, states
│   ├── layouts/             # PublicLayout, StudentLayout, AdminLayout
│   ├── assets/              # logo và icon Figma đang được shell sử dụng
│   ├── features/            # module theo chức năng; Hub cơ hội list/detail đã có trên main
│   ├── lib/                 # API client và kiểm tra health
│   └── styles/              # Tailwind CSS và tokens
├── backend/
│   ├── src/
│   │   ├── app.ts           # cấu hình Express, không mở cổng
│   │   ├── server.ts        # mở cổng và dừng server
│   │   ├── config/          # kiểm tra PORT
│   │   ├── middleware/      # lỗi JSON và 404
│   │   ├── lib/             # README cho hạ tầng dùng chung
│   │   └── modules/         # health và API cơ hội đã chạy; module khác theo phạm vi README
│   ├── test/                # Node.js built-in test runner
│   └── prisma/              # schema, migration SQL và Prisma config
├── database/README.md       # lối vào tài liệu dữ liệu
├── docs/                    # kiến trúc, workflow, roadmap, quy ước API
│   └── shared-ui-design/    # handoff Figma, screenshot/evidence không vào build
├── AGENTS.md
├── package.json             # npm workspaces
└── package-lock.json        # lockfile duy nhất
```

Mỗi người tải bộ khung và tự chạy kiểm tra trên máy mình. Phân công theo yêu cầu mới nhất, chưa gán tên/deadline:

| Thành viên | Phần frontend và backend                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| TV1        | Nền tảng auth backend/frontend dùng chung; Hub cơ hội/tìm kiếm/chi tiết; Admin duyệt cơ hội; điều phối tích hợp |
| TV2        | Hồ sơ và chức năng tài khoản; Admin quản lý tài khoản                                                           |
| TV3        | Lộ trình kỹ năng, gợi ý/cơ hội dành cho bạn; Admin danh mục                                                     |
| TV4        | Lịch, thông báo; Dashboard Admin, phối hợp thống kê với các TV khác                                             |
| TV5        | Diễn đàn, bình luận; Admin kiểm duyệt, xóa mềm/log/thông báo theo transaction                                   |

Đọc [quy trình cộng tác](docs/team-workflow.md), [lộ trình](docs/development-roadmap.md) và [ghi nhận thiết kế shared UI](docs/shared-ui-design/implementation.md). Public Hub, Guidance, Events, API Major/Skill và backend Admin duyệt đã có trên `main`. Nhánh hiện tại kế thừa frontend auth từ `feat/auth-frontend` và hoàn thiện giao diện Admin duyệt. Font Inter được tự lưu trong frontend theo SIL OFL 1.1. Đường dẫn Footer `/terms` và `/privacy` đã chốt, nội dung trang còn chờ nhóm. Không chia toàn bộ Admin cho một người; TV1 điều phối shell và route.

## 7. Lỗi thường gặp và giới hạn

- `node`/`git` không được nhận diện: cài công cụ và mở lại terminal. IDE không tự bảo đảm chúng tồn tại.
- Cổng 5173 đang dùng: Vite báo lỗi thay vì tự chuyển cổng. Dừng phiên frontend cũ bằng Ctrl+C. Nếu 3001 đang dùng, dừng đúng tiến trình của mình hoặc đổi PORT và API_PROXY_TARGET; không tắt tùy tiện tiến trình khác.
- Frontend báo lỗi kết nối: xem terminal backend, kiểm tra health trực tiếp, hai giá trị cổng và khởi động lại sau khi đổi `.env`.
- Lệnh không có script/workspace: kiểm tra terminal đang ở gốc UniHub và đã lấy đúng nhánh.
- Không commit `.env`, node_modules, dist, coverage, khóa hoặc dữ liệu cục bộ. `.env.example` chỉ chứa cấu hình mẫu an toàn.

Migration và Prisma runtime được kiểm tra trên MySQL 8.4 dùng một lần ở Codex/Linux; không kết nối database máy thành viên. Điều đó không chứng minh cấu hình Windows, mọi trình duyệt, NFR hiệu năng hoặc tải 100 người đã đạt. Shared UI/list/detail được kiểm tra trực quan theo ảnh handoff và fixture mock; bố cục ở 1920 px là lựa chọn triển khai, không phải số đo trực tiếp Figma, và mock không xác nhận API/MySQL thật. Auth API và Admin review API đã có trên `main`; giao diện Admin review đang được hoàn thiện trên nhánh riêng và phụ thuộc frontend auth chưa merge.
