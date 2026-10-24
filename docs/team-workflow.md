# Quy trình cộng tác UniHub

## Phân công dự kiến cho 5 thành viên

Các mã TV1–TV5 chưa gắn tên người, không có deadline. Nhóm cần xác nhận khối lượng, người nhận và điều chỉnh cùng nhau. Mỗi người làm cả frontend/backend của phần mình, viết/kiểm tra test phù hợp và cập nhật tài liệu liên quan.

| Thành viên | Phạm vi                                                                                                                                          | Thư mục chính                                                                                                                      | Admin do chính thành viên phụ trách                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| TV1        | Bộ khung, cấu hình, layout/navbar/footer, component chung, Google login/hồ sơ, xác thực/quyền, tài khoản; điều phối schema/migration và tích hợp | frontend: app, components, layouts, features/auth, features/profile; backend: config, middleware, lib, modules/auth, modules/users | frontend/features/admin/users; backend/modules/users                           |
| TV2        | Trang chủ, danh sách/tìm kiếm/lọc/phân trang/chi tiết cơ hội; API và truy vấn tương ứng                                                          | frontend/features/opportunities; backend/modules/opportunities                                                                     | frontend/features/admin/opportunities; backend/modules/opportunities           |
| TV3        | Lộ trình kỹ năng, bài định hướng, cơ hội dành cho bạn; thuật toán theo Chương 3                                                                  | frontend/features/guidance, features/recommendations; backend/modules/guidance, modules/recommendations, modules/categories        | frontend/features/admin/categories; backend/modules/categories                 |
| TV4        | CRUD sự kiện/deadline, hoàn thành/nhắc hạn, thông báo/đánh dấu đọc; dashboard                                                                    | frontend/features/calendar, features/notifications; backend/modules/events, modules/notifications, modules/dashboard               | frontend/features/admin/dashboard; TV khác cung cấp dữ liệu thống kê phần mình |
| TV5        | Diễn đàn/bình luận, kiểm duyệt, xóa mềm và transaction log/thông báo vi phạm                                                                     | frontend/features/forum; backend/modules/forum, modules/activity-logs                                                              | frontend/features/admin/forum; backend/modules/forum                           |

Các thư mục Admin con là ranh giới sở hữu **khi triển khai**, chưa cần tạo một loạt file trống. Sitemap `/admin/moderation` có hai tab: TV2 phụ trách thẩm định cơ hội, TV5 phụ trách kiểm duyệt diễn đàn. TV1 điều phối shell/menu/route dùng chung; tránh cả nhóm chỉnh một `AdminPage.tsx` lớn. Quyền trên server nằm trong module nghiệp vụ tương ứng.

`activity-logs` là cơ chế chung: TV5 phối hợp TV1 về giao diện ghi log; TV1/TV2/TV3 tự tích hợp log vào transaction quản trị của mình. TV4 phụ trách cơ chế thông báo; TV5 phối hợp để Violation và xóa mềm/log dùng cùng transaction, không gọi API nội bộ riêng khiến thao tác mất tính nguyên tử.

## Nhánh nền và pull request

Branch (nhánh) là một dòng thay đổi riêng. Commit là điểm lưu thay đổi có mô tả. Pull request (PR) là đề nghị đưa nhánh vào nhánh nền để người khác review; push không đồng nghĩa đã merge.

Khi khởi tạo scaffold ngày 24/10/2026, `main` đã có tài liệu qua merge commit `eff7ba2` của PR #1. Nhánh `chore/project-scaffold` kế thừa main này; PR scaffold có base là **main** và không còn phụ thuộc PR tài liệu chưa merge. Không mặc định scaffold đã được review/merge chỉ vì nhánh đã push.

- Sau khi scaffold được merge: cả nhóm tạo nhánh chức năng từ `origin/main` mới nhất.
- Nếu cần làm trước khi scaffold merge: tạo nhánh từ `origin/chore/project-scaffold`, mở PR với base `chore/project-scaffold` và ghi rõ phụ thuộc PR scaffold. Sau khi scaffold merge, phối hợp đổi base về main; không force-push hoặc reset lịch sử để "làm sạch" PR.
- Tên gợi ý: `feat/tv2-opportunities-list`, `feat/tv3-guidance`, `fix/health-timeout`, `docs/tv4-notifications-contract`.

## Một vòng làm việc

Các lệnh PowerShell sau chạy **tại gốc UniHub**. Trước tiên `git status`; nếu có thay đổi thì commit/lưu an toàn, không ghi đè. Ví dụ sau áp dụng **sau khi scaffold đã merge**:

```powershell
git status
git fetch origin refs/heads/main:refs/remotes/origin/main
git switch -c feat/tv2-opportunities-list origin/main
```

`fetch` lấy lịch sử mới về nhưng không sửa mã đang làm. Khi cần cập nhật nhánh đang làm từ main, lưu thay đổi hiện tại rồi chạy `git fetch origin refs/heads/main:refs/remotes/origin/main` và `git merge origin/main`; nếu có conflict, đọc cả hai thay đổi, trao đổi người phụ trách và kiểm tra lại. Không chạy lệnh này khi chưa hiểu thay đổi sẽ tích hợp.

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

Chỉ cần `npm ci` khi mới clone hoặc lockfile đã thay đổi. Kiểm tra riêng chức năng/UI mình sửa ngoài các kiểm tra chung. Test hiện tại chỉ bao phủ scaffold HTTP/config; không dùng nó để khẳng định nghiệp vụ mới đã đúng.

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

- **Component/layout/app config:** trao đổi TV1 trước khi thay giao diện sử dụng chung. Người làm feature tự chịu trách nhiệm code/test; TV1 hỗ trợ điều phối, không làm thay toàn bộ.
- **Dependency:** chỉ thêm khi có nhu cầu hiện tại, kiểm tra phiên bản; tại gốc dùng `npm.cmd install ten-goi@phien-ban --workspace @unihub/frontend` hoặc backend phù hợp. Đây là mẫu cú pháp, thay tên/phiên bản thật đã thống nhất. Commit manifest workspace và lockfile gốc cùng nhau. Không tạo lockfile con, không sửa lockfile bằng tay.
- **Root scripts/TypeScript/Tailwind/PORT:** giải thích tác động đến máy của cả nhóm, có TV1 review. Mã mới phải chạy trên Windows, không dùng `rm`, `cp`, `PORT=... command` hoặc shell Unix trong npm scripts dùng chung.
- **Schema/migration:** nguồn duy nhất sau này là `backend/prisma/schema.prisma` và `backend/prisma/migrations/`. TV1 điều phối thứ tự; thành viên đề xuất thay đổi của module mình qua PR. Không chạy `prisma db push`, reset database chung, hoặc sửa migration đã được dùng để né conflict. Mọi thay đổi mô hình 12 bảng phải được nhóm duyệt.
- **Cấu hình cá nhân:** `.env` thật chỉ nằm trên máy người dùng, không qua Git/PR. Chia sẻ tên biến và mẫu an toàn bằng `.env.example`; frontend không nhận bí mật backend.
- **Nghiệp vụ:** Chương 3–4 là nguồn chính; giữ stack và phạm vi desktop. Tài liệu nhóm khác chỉ tham khảo. Nếu mâu thuẫn ảnh hưởng dữ liệu/quyền, ghi lại để nhóm quyết định, không âm thầm đổi.

## Phối hợp khi phụ thuộc module khác

Thống nhất payload, kiểu ngày giờ, phân trang, quyền và lỗi trước khi nối frontend/backend; ghi rõ endpoint dự kiến và endpoint đã chạy. Khi cần dữ liệu từ TV khác, mô tả dữ liệu cần, thống nhất contract rồi làm nhánh nhỏ. Chưa có API thì ghi trạng thái chờ; không đưa endpoint giả hoặc thông tin cá nhân vào scaffold.

TV2 cung cấp thống kê cơ hội cho TV4; TV5 cung cấp thống kê diễn đàn; TV1 cung cấp thống kê người dùng; TV3 thống nhất danh mục dùng trong hồ sơ/tìm kiếm/gợi ý với TV1/TV2. Các transaction liên quan log/notification phải có reviewer của những phần bị tác động.
