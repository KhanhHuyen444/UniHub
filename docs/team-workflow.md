# Quy trình cộng tác UniHub

## Phân công đã chốt cho 5 thành viên

Bảng dưới theo yêu cầu phân công mới nhất của nhóm và thay thế các mô tả cũ trong PCCV. TV1 là người điều phối; mã TV1–TV5 chưa gắn tên người hoặc deadline. Mỗi người làm frontend/backend của phần mình, viết/kiểm tra test phù hợp và cập nhật tài liệu liên quan.

| Thành viên   | Phạm vi                                                                                                                                    | Thư mục chính                                                                                                                 | Admin do thành viên phụ trách                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| TV1 / leader | Nền tảng chung; Hub cơ hội; Admin duyệt cơ hội; điều phối tích hợp; làm trước nền backend xác thực/RBAC dùng chung để Admin cơ hội sử dụng | frontend: app, lib, features/opportunities; backend: config, middleware, lib, modules/opportunities và nền modules/auth       | tab cơ hội trong frontend/features/admin và backend/modules/opportunities; dùng chung auth middleware |
| TV2          | Tiếp quản nền xác thực/RBAC dùng chung; hoàn thiện đăng nhập/đăng xuất UI, hồ sơ và quản lý tài khoản; không tạo cơ chế auth thứ hai       | frontend: features/auth, features/profile; backend: modules/auth, modules/users, middleware                                   | frontend/features/admin/users; backend/modules/users                                                  |
| TV3          | Lộ trình kỹ năng, cơ hội dành cho bạn, danh mục/chuyên ngành/kỹ năng                                                                       | frontend: features/guidance, features/recommendations; backend: modules/guidance, modules/recommendations, modules/categories | frontend/features/admin/categories; backend/modules/categories                                        |
| TV4          | Lịch, deadline, nhắc hạn, thông báo, dashboard                                                                                             | frontend: features/calendar, features/notifications; backend: modules/events, modules/notifications, modules/dashboard        | frontend/features/admin/dashboard; TV khác cung cấp dữ liệu thống kê phần mình                        |
| TV5          | Diễn đàn, bình luận, kiểm duyệt; xóa mềm, activity log và thông báo vi phạm                                                                | frontend: features/forum; backend: modules/forum, modules/activity-logs                                                       | tab forum trong frontend/features/admin và backend/modules/forum                                      |

Các thư mục Admin con là ranh giới sở hữu **khi triển khai**, chưa cần tạo một loạt file trống. Sitemap `/admin/moderation` có hai tab: TV1 phụ trách duyệt cơ hội, TV5 phụ trách kiểm duyệt diễn đàn. TV1 điều phối route, shell dùng chung và tích hợp. Shell có thể xem trong `/_dev/ui?area=admin`; route preview không xác thực và không thay Admin nghiệp vụ. Tránh cả nhóm chỉnh một `AdminPage.tsx` lớn. Quyền trên server nằm trong module nghiệp vụ tương ứng.

### Nền xác thực backend dùng chung

Leader triển khai nền xác thực backend/RBAC trước phần Admin duyệt cơ hội; khi bàn giao, TV2 tiếp quản cùng module/middleware và mở rộng cho login/logout UI, hồ sơ và tài khoản. Đây là một cơ chế chung: `backend/src/modules/auth/` quản lý luồng phiên; `backend/src/middleware/` cung cấp `requireAuth` và `requireRole('Admin')`; `frontend/src/lib/api.ts` là API client chung, UI auth thuộc `frontend/src/features/auth/`. Hợp đồng endpoint/error/session đang ở [auth-api-contract.md](auth-api-contract.md); chưa có auth code trong scaffold.

Admin cơ hội TV1 và mọi API Admin của TV2–TV5 phải dùng middleware chung ở backend, không tự kiểm tra role từ frontend. API public tiếp tục public; API Student-only và resource ownership do module tương ứng kiểm tra. Trước khi code, cần review dependency schema identity/status/session trong hợp đồng; không tạo migration hoặc cấp Admin chỉ để unblock UI.

`activity-logs` là cơ chế chung: TV5 phối hợp TV1, TV2 và TV3 về thao tác quản trị có ghi log; TV4 phụ trách cơ chế thông báo; TV5 phối hợp để Violation và xóa mềm/log dùng cùng transaction, không gọi API nội bộ riêng khiến thao tác mất tính nguyên tử.

## Nhánh nền và pull request

Branch (nhánh) là một dòng thay đổi riêng. Commit là điểm lưu thay đổi có mô tả. Pull request (PR) là đề nghị đưa nhánh vào nhánh nền để người khác review; push không đồng nghĩa đã merge.

`main` hiện đã có scaffold, schema/migration ban đầu và Prisma runtime. Tạo nhánh mới từ `origin/main` mới nhất; không dựa vào nhánh runtime cũ hoặc PR đã merge.

- Tên gợi ý: `feat/tv1-opportunities-list`, `feat/tv2-google-auth`, `feat/tv3-guidance`, `fix/health-timeout`, `docs/tv4-notifications-contract`.

## Một vòng làm việc

Các lệnh PowerShell sau chạy **tại gốc UniHub**. Trước tiên `git status`; nếu có thay đổi thì commit/lưu an toàn, không ghi đè:

```powershell
git status
git fetch origin
git switch -c feat/tv1-opportunities-list origin/main
```

`fetch` lấy lịch sử mới về nhưng không sửa mã đang làm. Khi cần cập nhật nhánh đang làm từ main, lưu thay đổi hiện tại rồi chạy `git fetch origin` và `git merge origin/main`; nếu có conflict, đọc cả hai thay đổi, trao đổi người phụ trách và kiểm tra lại. Không chạy lệnh này khi chưa hiểu thay đổi sẽ tích hợp.

Sau khi code, tại **gốc UniHub**:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run format:check
git diff
git status
```

Chỉ cần `npm ci` khi mới clone hoặc lockfile đã thay đổi. Kiểm tra riêng chức năng/UI mình sửa ngoài các kiểm tra chung. Test hiện tại bao phủ API client và scaffold HTTP/config; không dùng nó để khẳng định nghiệp vụ mới đã đúng.

Thêm đúng đường dẫn thực sự đã sửa vào staging, xem lại rồi commit. Ví dụ minh họa cho TV2 (chỉ dùng khi đã có thay đổi tại các đường dẫn đó):

```powershell
git add frontend/src/features/opportunities backend/src/modules/opportunities
git diff --cached
git commit -m "feat(opportunities): add paginated opportunity list"
git push -u origin feat/tv2-opportunities-list
```

Mở GitHub → Compare & pull request, chọn đúng base theo tình trạng ở trên. PR mô tả vấn đề, thay đổi, cách kiểm tra, phần chưa làm và PR phụ thuộc; nhờ ít nhất một thành viên khác review. Người được nhóm giao quyền tích hợp quyết định merge. Agent không tự merge/deploy. Nếu GitHub CLI không truy cập được API, dùng compare trên web; không sửa quyền để vượt lỗi.

Commit dùng tiền tố `feat`, `fix`, `docs`, `chore`, `test`, `refactor`; scope chức năng có thể thêm trong ngoặc. Ví dụ `fix(forum): reject comments on deleted posts`. Mỗi PR nên phục vụ một mục tiêu dễ review.

## Quy tắc chạm phần dùng chung

- **Route/app config:** trao đổi TV1 trước khi thay route chung; khai báo route tại `frontend/src/app/router.tsx`. Chưa tạo route giả hoặc feature page rỗng. Người làm feature tự chịu trách nhiệm code/test; TV1 hỗ trợ điều phối, không làm thay toàn bộ.
- **Layout/design tokens:** nguồn là [handoff Figma Page 3](shared-ui-design/README.md) và [implementation notes](shared-ui-design/implementation.md). Phân biệt thông số đọc trực tiếp với token/width suy ra. Font chưa bundle; các frame 1920, breakpoint và collapse behavior chưa được xác nhận. Thay đổi shell/token dùng chung cần TV1 review.
- **Dependency:** chỉ thêm khi có nhu cầu hiện tại, kiểm tra phiên bản; tại gốc dùng `npm.cmd install ten-goi@phien-ban --workspace @unihub/frontend` hoặc backend phù hợp. Đây là mẫu cú pháp, thay tên/phiên bản thật đã thống nhất. Commit manifest workspace và lockfile gốc cùng nhau. Không tạo lockfile con, không sửa lockfile bằng tay.
- **Root scripts/TypeScript/Tailwind/PORT:** giải thích tác động đến máy của cả nhóm, có TV1 review. Mã mới phải chạy trên Windows, không dùng `rm`, `cp`, `PORT=... command` hoặc shell Unix trong npm scripts dùng chung.
- **Schema/migration:** nguồn duy nhất sau này là `backend/prisma/schema.prisma` và `backend/prisma/migrations/`. TV1 điều phối thứ tự; thành viên đề xuất thay đổi của module mình qua PR. Không chạy `prisma db push`, reset database chung, hoặc sửa migration đã được dùng để né conflict. Mọi thay đổi mô hình 12 bảng phải được nhóm duyệt.
- **Cấu hình cá nhân:** `.env` thật chỉ nằm trên máy người dùng, không qua Git/PR. Chia sẻ tên biến và mẫu an toàn bằng `.env.example`; frontend không nhận bí mật backend.
- **Nghiệp vụ:** Chương 3–4 là nguồn chính; giữ stack và phạm vi desktop. Tài liệu nhóm khác chỉ tham khảo. Nếu mâu thuẫn ảnh hưởng dữ liệu/quyền, ghi lại để nhóm quyết định, không âm thầm đổi.

## Phối hợp khi phụ thuộc module khác

Thống nhất payload, kiểu ngày giờ, phân trang, quyền và lỗi trước khi nối frontend/backend; ghi rõ endpoint dự kiến và endpoint đã chạy. Khi cần dữ liệu từ TV khác, mô tả dữ liệu cần, thống nhất contract rồi làm nhánh nhỏ. Chưa có API thì ghi trạng thái chờ; không đưa endpoint giả hoặc thông tin cá nhân vào scaffold.

TV1 cung cấp thống kê cơ hội cho TV4; TV5 cung cấp thống kê diễn đàn; TV2 cung cấp thống kê người dùng; TV3 thống nhất danh mục dùng trong hồ sơ/tìm kiếm/gợi ý với TV1/TV2. Các transaction liên quan log/notification phải có reviewer của những phần bị tác động.
