# UniHub

UniHub là nền tảng hỗ trợ học tập và định hướng nghề nghiệp cho sinh viên. Repository hiện ở **giai đoạn bộ khung phát triển chung**: React hiển thị màn hình kỹ thuật tạm thời và gọi Express qua `GET /api/health`.

Health chỉ kiểm tra HTTP server. Chưa có database, schema/migration, đăng nhập Google, JWT, tài khoản mẫu, chức năng nghiệp vụ hoặc UI chính thức theo Figma. MySQL/Prisma vẫn là công nghệ đã chốt cho giai đoạn sau; hiện **không cần MySQL, Docker hoặc khóa Google để chạy bộ khung**.

## 1. Công nghệ và điều kiện môi trường

| Thành phần       | Phiên bản / vai trò                                              |
| ---------------- | ---------------------------------------------------------------- |
| Node.js          | 24.19.0 thuộc dòng 24 LTS; chạy JavaScript và công cụ phát triển |
| npm              | Khuyến nghị 11.9.0; dùng npm 11 từ 11.9.0, một lockfile ở gốc    |
| Git              | Cài Git for Windows; quản lý commit, nhánh và đồng bộ GitHub     |
| Frontend         | React 19.3.1, TypeScript 5.9.3, Vite 8.3.5, Tailwind CSS 3.4.19  |
| Backend          | Express 5.3.0 + TypeScript; ES modules                           |
| Database sau này | MySQL 8.4 LTS + Prisma 7.10.1; chưa cài vào ứng dụng             |

Antigravity là IDE (trình soạn thảo và chạy terminal), không thay thế Node.js/Git. Những công cụ có sẵn ở Codex **không có nghĩa máy Windows của bạn đã cài**. Cài Git từ [git-scm.com](https://git-scm.com/downloads/win) và Node.js từ [nodejs.org](https://nodejs.org/en/download), chọn đúng dòng/phiên bản trên, rồi mở lại terminal/IDE. `.nvmrc` chỉ ghi phiên bản, không tự cài Node.

Giới hạn phần mềm của môn học vẫn cần đối chiếu; chưa có bằng chứng máy phòng học hỗ trợ phiên bản đã chọn. Không tự đổi major nếu gặp xung đột. Tailwind 3.4 giữ yêu cầu trình duyệt cũ trong Chương 3; chưa kiểm thử đủ mọi trình duyệt tối thiểu.

## 2. Lấy bộ khung về máy Windows

Nhánh scaffold: **`chore/project-scaffold`**. Khi tạo nhánh này, tài liệu kiến trúc đã được merge vào `main` qua PR #1. Không mặc định scaffold đã được merge.

Mở PowerShell trong Antigravity hoặc Windows. Ví dụ dưới đây dùng thư mục Documents; có thể chọn nơi khác nhưng phải điều chỉnh đường dẫn ở các lệnh sau.

**Thư mục chạy: thư mục cha nơi muốn lưu dự án, ví dụ Documents.**

```powershell
Set-Location "$HOME\Documents"
git clone --branch chore/project-scaffold --single-branch https://github.com/KhanhHuyen444/UniHub.git
Set-Location .\UniHub
git status
```

`clone` tải một bản repository về máy; `--branch` chọn đúng nhánh có bộ khung. Sau đó mở **cả thư mục UniHub** trong Antigravity, không chỉ frontend hoặc backend.

Nếu đã clone trước đó, không clone đè lên thư mục có sẵn. **Tại gốc repository hiện có**, chạy `git status`; nếu có thay đổi của bạn thì commit hoặc lưu chúng an toàn trước khi chuyển nhánh. Khi working tree sạch:

```powershell
git fetch origin refs/heads/chore/project-scaffold:refs/remotes/origin/chore/project-scaffold
git switch chore/project-scaffold
```

Nếu nhánh local chưa tồn tại và Git không tự tạo tracking branch, dùng `git switch --track origin/chore/project-scaffold`. Không dùng reset/clean để xử lý thay đổi chưa commit.

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

Không ghi đè `.env` đã có. `backend/.env` dùng `PORT=3001`; `frontend/.env` dùng `API_PROXY_TARGET=http://127.0.0.1:3001`. Nếu đổi cổng backend, đổi cả đích proxy rồi khởi động lại hai tiến trình. `API_PROXY_TARGET` do Vite dev server đọc, không phải bí mật; biến `VITE_` không được chứa mật khẩu hoặc khóa backend. Hiện không cần `.env` ở gốc.

## 4. Chạy bằng hai terminal

**Terminal 1 — tại gốc UniHub, chạy backend:**

```powershell
Set-Location "$HOME\Documents\UniHub"
npm.cmd run dev:backend
```

Giữ terminal mở. Backend mặc định nghe tại `http://127.0.0.1:3001`; tự khởi động lại khi sửa mã nguồn. Node nạp `.env` trong workspace backend nếu tệp tồn tại; không có tệp vẫn dùng cổng mặc định.

**Terminal 2 — cũng tại gốc UniHub, chạy frontend:**

```powershell
Set-Location "$HOME\Documents\UniHub"
npm.cmd run dev:frontend
```

Mở trình duyệt tại **`http://127.0.0.1:5173`**. Trang hiển thị "Đang kiểm tra kết nối…", sau đó "Backend hoạt động" nếu nhận đúng health JSON. Nếu backend chưa chạy, trang báo "Không kết nối được backend"; chạy backend rồi bấm **Thử lại**. Mỗi lần kiểm tra có timeout 5 giây. Yêu cầu bị hủy/bỏ qua khi component được tháo khỏi trang hoặc lần kiểm tra đã hết hiệu lực.

Frontend gọi đường dẫn tương đối `/api/health`; Vite **dev proxy** chuyển `/api` tới backend. Proxy là cơ chế chuyển tiếp yêu cầu khi phát triển, **chưa phải cấu hình production**. Build frontend không tự tạo proxy hoặc hosting. Cả hai server hiện chỉ nghe loopback trên máy đang chạy, không mở ra Internet.

**Terminal thứ ba, ở bất kỳ thư mục nào**, kiểm tra trực tiếp API:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

Kết quả tương ứng JSON `{"status":"ok","service":"unihub-api"}`. Không có kiểm tra MySQL trong endpoint này. Nhấn **Ctrl+C** ở mỗi terminal để dừng server.

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
- `test`: build backend rồi chạy 7 kiểm thử HTTP/config bằng `node:test` có sẵn trong Node.js. Chưa có bộ test nghiệp vụ/frontend trong repository; không hiểu lệnh này là đã test toàn bộ UI.
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
│   ├── app/                 # màn hình kiểm tra tạm thời
│   ├── components/          # README cho thành phần chung
│   ├── layouts/             # README cho layout dùng chung
│   ├── features/            # README theo chức năng, chưa có nghiệp vụ
│   ├── lib/                 # fetch health
│   └── styles/              # Tailwind CSS
├── backend/
│   ├── src/
│   │   ├── app.ts           # cấu hình Express, không mở cổng
│   │   ├── server.ts        # mở cổng và dừng server
│   │   ├── config/          # kiểm tra PORT
│   │   ├── middleware/      # lỗi JSON và 404
│   │   ├── lib/             # README cho hạ tầng dùng chung
│   │   └── modules/         # health đã chạy; các module khác chỉ README
│   └── test/                # Node.js built-in test runner
├── database/README.md       # schema/migration tương lai ở backend/prisma/
├── docs/                    # kiến trúc, workflow, roadmap, quy ước API
├── AGENTS.md
├── package.json             # npm workspaces
└── package-lock.json        # lockfile duy nhất
```

Mỗi người tải bộ khung và tự chạy kiểm tra trên máy mình. Phân công **dự kiến**, chưa gán tên/deadline:

| Thành viên | Phần frontend và backend                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------- |
| TV1        | Nền tảng, layout chung, tài khoản/hồ sơ/xác thực, Admin tài khoản; điều phối schema và tích hợp |
| TV2        | Trang chủ/Hub cơ hội, tìm kiếm/chi tiết; Admin thẩm định cơ hội                                 |
| TV3        | Định hướng, gợi ý; Admin chuyên ngành/kỹ năng                                                   |
| TV4        | Lịch, thông báo; Dashboard Admin, phối hợp thống kê với các TV khác                             |
| TV5        | Diễn đàn, bình luận; Admin kiểm duyệt, xóa mềm/log/thông báo theo transaction                   |

Đọc [quy trình cộng tác](docs/team-workflow.md), xác nhận tên và khối lượng, rồi làm theo [lộ trình](docs/development-roadmap.md). Không chia toàn bộ Admin cho một người. Mỗi người tự kiểm thử phần mình; TV1 không thay thế trách nhiệm đó.

## 7. Lỗi thường gặp và giới hạn

- `node`/`git` không được nhận diện: cài công cụ và mở lại terminal. IDE không tự bảo đảm chúng tồn tại.
- Cổng 5173 đang dùng: Vite báo lỗi thay vì tự chuyển cổng. Dừng phiên frontend cũ bằng Ctrl+C. Nếu 3001 đang dùng, dừng đúng tiến trình của mình hoặc đổi PORT và API_PROXY_TARGET; không tắt tùy tiện tiến trình khác.
- Frontend báo lỗi kết nối: xem terminal backend, kiểm tra health trực tiếp, hai giá trị cổng và khởi động lại sau khi đổi `.env`.
- Lệnh không có script/workspace: kiểm tra terminal đang ở gốc UniHub và đã lấy đúng nhánh.
- Không commit `.env`, node_modules, dist, coverage, khóa hoặc dữ liệu cục bộ. `.env.example` chỉ chứa cấu hình mẫu an toàn.

Kết quả kiểm tra ở Codex/Linux không chứng minh đã kiểm tra Windows, tất cả trình duyệt, NFR hiệu năng hoặc tải 100 người dùng. UI tạm thời không dựa trên Figma chưa đọc được. Đăng nhập, JWT, Prisma Client, MySQL, migration, cron và mọi chức năng nghiệp vụ vẫn chưa triển khai.
