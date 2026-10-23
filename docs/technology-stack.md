# Công nghệ UniHub

Ngày đối chiếu: **23/10/2026**. Trạng thái: quyết định kiến trúc và kế hoạch phiên bản, **chưa khởi tạo ứng dụng**.

## 1. Phạm vi và căn cứ

UniHub là nền tảng hỗ trợ học tập và định hướng nghề nghiệp cho sinh viên. Đợt này chỉ tạo `docs/technology-stack.md` và [docs/architecture.md](architecture.md). Chưa có `package.json`, lockfile, `schema.prisma`, migration, dữ liệu mẫu, API hoặc giao diện chạy được; chưa cài dependency, tạo database hay triển khai hosting.

Các tài liệu thực sự đã đọc, với số trang tính theo thứ tự trong PDF:

| Tài liệu | Nội dung dùng làm căn cứ | Đường dẫn tệp đã đọc trong phiên làm việc |
| --- | --- | --- |
| `CHƯƠNG 3.pdf` — 65 trang | Chức năng, use case, quy tắc nghiệp vụ; NFR về xác thực, trình duyệt và desktop | `/workspace/attachments/8eaba411-7586-4eae-aa59-4464586214e5/CHƯƠNG 3.pdf` |
| `CHƯƠNG 4.pdf` — 30 trang | Sitemap, quan hệ và đặc tả đủ 12 bảng; đặc biệt mục 4.2 và 4.3 | `/workspace/attachments/c9e7867e-3c02-4ed7-8528-e2fd832c6079/CHƯƠNG 4.pdf` |
| `PCCV-UNIHUB - Trang tính4.pdf` — 2 trang | Phân công, các giai đoạn phân tích, thiết kế và UI/UX | `/workspace/attachments/fdb579f1-d6a6-4906-9ce6-0f522e5be612/PCCV-UNIHUB - Trang tính4.pdf` |

Các đường dẫn trên chỉ ghi nguồn đã đọc trong môi trường làm việc, không phải tệp được đưa vào repository. PCCV là căn cứ phân công, không tự thay thế quy tắc nghiệp vụ trong Chương 3–4. Chương 2 chưa chốt và sẽ cập nhật theo công nghệ thực tế. Tài liệu nhóm khác không được coi là yêu cầu bắt buộc.

Figma đúng do nhóm cung cấp: [UniHub — node 318-2](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=318-2&t=PFFCH76hu4tSNTHK-0). Yêu cầu truy cập bị proxy mạng trả `403 Forbidden`; **chưa đọc được thiết kế Figma**, không suy diễn màu sắc, typography hoặc component từ liên kết. Liên kết này thay cho node `24-2` trước đó. Việc viết tài liệu thành phần và dữ liệu không phụ thuộc việc đọc Figma.

Khi có khác biệt, quyết định chính thức mới của nhóm được ghi rõ và ưu tiên; không tự sửa mô hình dữ liệu để giải quyết khác biệt.

## 2. Những lựa chọn nhóm đã xác nhận

| Thành phần | Công nghệ / quy ước | Mục đích |
| --- | --- | --- |
| Frontend | React + TypeScript, Vite | Một ứng dụng với các khu vực Public, Student, Admin |
| CSS | Tailwind CSS | Xây dựng giao diện theo Figma; chưa chọn thêm UI kit |
| Backend | Node.js + Express + TypeScript | REST API; xác thực, phân quyền, kiểm tra dữ liệu và thực hiện nghiệp vụ tại server |
| Database | MySQL dòng 8.4 LTS | Lưu mô hình quan hệ 12 bảng trong Chương 4 |
| Truy cập dữ liệu | Prisma ORM + Prisma Migrate | Truy vấn có kiểu và quản lý thay đổi schema; giữ các ràng buộc SQL của thiết kế |
| Dependency | npm workspaces | Một repository, hai workspace ứng dụng và một lockfile ở gốc khi scaffold |
| Mã nguồn | Git / GitHub | Nhánh công việc, commit, pull request; không tự merge vào `main` |
| Xác thực | Google Identity Services → backend xác minh Google ID token → JWT UniHub | Tách chứng thực danh tính Google khỏi phiên làm việc và quyền trong UniHub |
| Phân quyền | Guest / Student / Admin | Guest là trạng thái chưa đăng nhập; `users.role` chỉ chứa `Student` hoặc `Admin` |
| Giao diện | Desktop 1280–1920 px | Không mở rộng nhiệm vụ hiện tại sang mobile/tablet |

Frontend chỉ gọi API backend. Chỉ backend kết nối MySQL. Route guard frontend phục vụ điều hướng, không thay thế kiểm tra quyền tại backend.

**Giới hạn môi trường môn học chưa được xác nhận.** Node.js 24 LTS và MySQL 8.4 LTS là lựa chọn của nhóm, không phải bằng chứng máy phòng học hoặc hệ thống chấm bài đã hỗ trợ. Cần đối chiếu trước khi scaffold/cài đặt; nếu có xung đột, báo nhóm để quyết định, không âm thầm đổi công nghệ.

## 3. Bộ phiên bản được chọn cho bước scaffold

Đây là các phiên bản cụ thể được chọn sau đối chiếu tài liệu chính thức và metadata gói đã xuất bản. Chưa có lockfile nên đây chưa phải bộ dependency đã được cài hay kiểm thử tích hợp. Bước scaffold cần khai báo phiên bản cụ thể, tạo và commit một `package-lock.json` ở gốc; không dùng `latest` để thay thế bảng này mà không đánh giá lại.

| Công cụ / gói | Phiên bản chọn | Kết quả đối chiếu |
| --- | --- | --- |
| Node.js | **24.19.0**, dòng 24 LTS | Bản phát hành chính thức có nhãn LTS `Krypton`; môi trường đang có phiên bản này [S1] |
| npm | **11.9.0** | `engines.node`: `^20.17.0 \|\| >=22.9.0`; tương thích Node 24.19.0; môi trường đang có phiên bản này [S2] |
| MySQL Server | **8.4.13**, dòng 8.4 LTS | Tag chính thức `mysql-8.4.13` có `MYSQL_VERSION_MATURITY="LTS"`; Prisma hỗ trợ MySQL 5.6+ [S3, S6] |
| `react`, `react-dom` | **19.3.1** cho cả hai | `react-dom` yêu cầu React `^19.3.1` [S2] |
| `@types/react`, `@types/react-dom` | **19.3.0** cho cả hai | Cặp typings cùng dòng 19; peer của `@types/react-dom` là `@types/react: ^19.3.0` [S2] |
| `vite` | **8.3.5** | Node `^20.19.0 \|\| >=22.12.0` [S2, S4] |
| `@vitejs/plugin-react` | **6.1.2** | Peer Vite `^8.0.0`; Node giống yêu cầu của Vite [S2] |
| `typescript` | **5.9.3** | Đáp ứng Prisma yêu cầu TypeScript 5.4+; chọn bản ổn định này, không tự nâng major [S2, S6] |
| `express` / `@types/express` | **5.3.0** / **5.0.6** | Express 5 yêu cầu Node >=18; typings theo major 5 [S2, S5] |
| `prisma`, `@prisma/client`, `@prisma/adapter-mariadb` | **7.10.1** cho cả ba | CLI/Client hỗ trợ Node `^20.19 \|\| ^22.12 \|\| >=24.0`; TypeScript >=5.4 [S2, S6] |
| `mariadb` — driver dưới adapter | **3.5.4** | Dependency của adapter 7.10.1; Node >=20. Đây là driver kết nối MySQL, **không phải đổi database sang MariaDB** [S2, S6] |
| `tailwindcss` | **3.4.19** | Node >=14; chọn dòng 3.4 để giữ yêu cầu trình duyệt Chương 3 [S2, S7] |
| `postcss` / `autoprefixer` | **8.5.31** / **10.6.1** | Autoprefixer yêu cầu PostCSS `^8.1.0`; Vite hỗ trợ PostCSS [S2, S4] |

Google Identity Services là SDK web do Google cung cấp, không coi như một gói npm có phiên bản cố định trong bảng. Thư viện xác minh Google token, ký JWT, kiểm tra input, routing frontend và công cụ kiểm thử sẽ được đánh giá ở nhiệm vụ triển khai liên quan; chưa tự thêm vào dependency.

### 3.1. Vì sao dùng Tailwind 3.4 thay vì 4

Chương 3 trang 7, NFR-04.2, yêu cầu Chrome/Edge >=110, Firefox >=110 và Safari >=16. Tài liệu Tailwind 4 yêu cầu Chrome >=111, Firefox >=128 và Safari >=16.4, đồng thời khuyến nghị giữ dòng 3.4 nếu cần trình duyệt cũ hơn [S7]. Vì thế **Tailwind 3.4.19 là lựa chọn tương thích với yêu cầu hiện có**, không dùng `@tailwindcss/vite` dành cho Tailwind 4.

Khi scaffold, tích hợp Tailwind 3 bằng PostCSS/Autoprefixer. Cấu hình build Vite phải chỉ rõ đích Chrome 110, Edge 110, Firefox 110 và Safari 16 thay vì dựa vào mặc định của Vite 8. Cấu hình CSS/Browserslist phải cùng yêu cầu. Đây là kế hoạch cấu hình; chưa chứng minh tất cả API trình duyệt hoặc giao diện hoạt động trên các phiên bản đó. Vite không tự polyfill mọi Web API. Máy phát triển nên dùng trình duyệt hiện hành; kiểm thử trình duyệt tối thiểu áp dụng cho bản build ứng dụng.

### 3.2. Những điều phải giữ khi dùng Prisma 7

- Dùng backend theo ES modules; không sao chép cấu hình CommonJS hoặc ví dụ Prisma phiên bản khác mà chưa đối chiếu.
- Dùng provider `mysql`, generator `prisma-client`, đường dẫn output rõ ràng và driver adapter `@prisma/adapter-mariadb` theo hướng dẫn MySQL chính thức [S6]. Không thêm dịch vụ database bên ngoài.
- CLI/Client/adapter cùng phiên bản **7.10.1**. Registry hiện trả nhãn `latest` của CLI trỏ tới bản `8.0.0-rc.27`, nên không lấy nhãn này làm phiên bản dự án.
- Cấu hình URL kết nối cho CLI nằm trong `prisma.config.ts`; client runtime được cấp adapter. Không giả định Prisma 7 tự đọc `.env` hoặc dùng cấu hình URL theo mẫu Prisma 6.
- `schema.prisma` chỉ biểu diễn được một phần ràng buộc database. Giữ `CHECK` và hành vi SQL đặc thù trong migration SQL được review; không bỏ chúng vì Prisma không biểu diễn trực tiếp.
- `@updatedAt` là hành vi của Prisma Client, không tương đương hoàn toàn với `ON UPDATE CURRENT_TIMESTAMP` tại MySQL. `events.updated_at` phải giữ hành vi database mô tả trong Chương 4; xem [đối chiếu dữ liệu](architecture.md#5-đối-chiếu-prisma-với-12-bảng-chương-4).

### 3.3. Kết quả kiểm tra và giới hạn

Đã đọc metadata **đúng phiên bản** của 17 gói trong bảng; kiểm tra bằng semver có sẵn cho ra **19 điều kiện engines/peer dependency đạt, 0 lỗi**. Các peer tùy chọn không được coi là dependency phải cài. Đây không phải kiểm tra toàn bộ dependency bắc cầu. Node 24.19.0 và npm 11.9.0 được xác nhận bằng lệnh đọc phiên bản trong môi trường; MySQL chưa cài hoặc khởi động.

Đã đọc tài liệu chính thức qua Node.js, mã nguồn/tài liệu trong repository do nhà phát triển quản lý và npm registry. Các website như `vite.dev`, `expressjs.com`, `www.prisma.io`, `tailwindcss.com`, `dev.mysql.com`, `docs.npmjs.com` và `developers.google.com` bị proxy chặn khi truy cập trực tiếp; các nguồn GitHub chính thức đọc được được dẫn bên dưới. Không coi lỗi mạng này là lỗi tương thích thư viện.

**Chưa chạy** `npm install`, build, typecheck, `prisma validate`, `prisma generate`, migration hoặc thử kết nối MySQL. Vì vậy kết luận hiện tại là **phù hợp yêu cầu phiên bản được công bố**, không phải môi trường/ứng dụng đã hoạt động.

## 4. Quy tắc cấu hình và công việc tiếp theo

- Sau khi scaffold: root package `private`, workspace `frontend` và `backend`, một lockfile ở gốc. Dependency ứng dụng khai báo trong workspace sử dụng nó; Prisma Client chỉ thuộc backend. Không tạo workspace ứng dụng thứ ba cho `database/`.
- Bí mật database và khóa ký JWT chỉ cấp cho backend qua cấu hình cục bộ/bí mật môi trường. Biến có tiền tố `VITE_` có thể bị đóng gói vào frontend nên không được chứa bí mật. Google client ID là định danh công khai; Google client secret không được đưa vào frontend hoặc Git và không cần cho luồng xác minh ID token đã chọn.
- `.env.example`, `.gitignore`, README gốc và tài liệu cộng tác đầy đủ sẽ tạo ở bước scaffold, không thuộc hai file của đợt này. Chỉ dùng tên biến và giá trị mẫu an toàn, không tạo tài khoản mẫu hoặc dữ liệu cá nhân.
- Nhánh hiện tại: `docs/technology-architecture`, trên commit nền rỗng của `main` đã được nhóm cho phép. Đưa hai tài liệu qua pull request; không tự merge. Các công việc sau dùng nhánh riêng và commit có tiền tố như `docs:`, `chore:`, `feat:`, `fix:`.
- Bước tiếp theo là đối chiếu hạn chế môi trường môn học, rồi khởi tạo frontend/backend tối thiểu theo các phiên bản này, kiểm tra build và khởi động. Migration 12 bảng, xác thực và nghiệp vụ là các công việc riêng; không chạy trong đợt tài liệu.

## 5. Nguồn kỹ thuật đã đối chiếu

- **[S1] Node.js:** [lịch các dòng phát hành](https://nodejs.org/en/about/previous-releases), [danh mục bản phát hành JSON](https://nodejs.org/dist/index.json), mục `v24.19.0` có nhãn `Krypton`.
- **[S2] Metadata do nhà phát hành công bố trên npm registry:** [React](https://registry.npmjs.org/react/19.3.1), [React DOM](https://registry.npmjs.org/react-dom/19.3.1), [types React](https://registry.npmjs.org/@types%2freact/19.3.0), [types React DOM](https://registry.npmjs.org/@types%2freact-dom/19.3.0), [Vite](https://registry.npmjs.org/vite/8.3.5), [plugin React](https://registry.npmjs.org/@vitejs%2fplugin-react/6.1.2), [TypeScript](https://registry.npmjs.org/typescript/5.9.3), [Express](https://registry.npmjs.org/express/5.3.0), [types Express](https://registry.npmjs.org/@types%2fexpress/5.0.6), [Prisma CLI](https://registry.npmjs.org/prisma/7.10.1), [Prisma Client](https://registry.npmjs.org/@prisma%2fclient/7.10.1), [adapter](https://registry.npmjs.org/@prisma%2fadapter-mariadb/7.10.1), [driver](https://registry.npmjs.org/mariadb/3.5.4), [Tailwind](https://registry.npmjs.org/tailwindcss/3.4.19), [PostCSS](https://registry.npmjs.org/postcss/8.5.31), [Autoprefixer](https://registry.npmjs.org/autoprefixer/10.6.1), [npm](https://registry.npmjs.org/npm/11.9.0).
- **[S3] MySQL:** [tệp phiên bản tại tag mysql-8.4.13](https://github.com/mysql/mysql-server/blob/mysql-8.4.13/MYSQL_VERSION); [kiểm thử CHECK chính thức dòng 8.4](https://github.com/mysql/mysql-server/blob/mysql-8.4.7/mysql-test/t/check_constraints.test). Đây là mã nguồn tham khảo đã đọc, không phải kiểm thử đã chạy trong UniHub.
- **[S4] Vite:** [Getting Started](https://github.com/vitejs/vite/blob/main/docs/guide/index.md), [build target tại 8.3.5](https://github.com/vitejs/vite/blob/v8.3.5/docs/guide/build.md), [hỗ trợ PostCSS](https://github.com/vitejs/vite/blob/v8.3.5/docs/guide/features.md).
- **[S5] Express:** [README chính thức tại v5.3.0](https://github.com/expressjs/express/blob/v5.3.0/Readme.md).
- **[S6] Prisma, nguồn tài liệu tại commit `4651e4f165e02b756a5d627034a017b77fbf07fe`:** [yêu cầu hệ thống v7](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/reference/system-requirements.mdx), [MySQL connector và adapter](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/core-concepts/supported-databases/mysql.mdx), [Prisma Config](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/reference/prisma-config-reference.mdx), [custom migration](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/prisma-migrate/workflows/customizing-migrations.mdx), [referential actions](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/prisma-schema/data-model/relations/referential-actions.mdx).
- **[S7] Tailwind, nguồn tại commit `7f92c2213315c195dae583d68752da4042da3ade`:** [giới hạn trình duyệt v4](https://github.com/tailwindlabs/tailwindcss.com/blob/7f92c2213315c195dae583d68752da4042da3ade/src/docs/compatibility.mdx), [hướng dẫn giữ v3.4 khi cần trình duyệt cũ](https://github.com/tailwindlabs/tailwindcss.com/blob/7f92c2213315c195dae583d68752da4042da3ade/src/docs/upgrade-guide.mdx).
- **[S8] npm:** [hướng dẫn workspaces của npm 11.9.0](https://github.com/npm/cli/blob/v11.9.0/docs/lib/content/using-npm/workspaces.md).
- **[S9] Google:** [mã nguồn OAuth2Client của thư viện chính thức](https://github.com/googleapis/google-cloud-node-core/blob/main/packages/google-auth-library-nodejs/src/auth/oauth2client.ts), gồm kiểm tra chữ ký, hạn token, issuer và audience. Chưa tích hợp thư viện này vào UniHub.
