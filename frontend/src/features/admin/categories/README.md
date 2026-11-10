# Frontend danh mục Admin — Bảo Quyên

`AdminCategoriesPage` là nội dung có thể tái sử dụng cho Admin Categories API
hiện có. Response Admin gồm ngày tạo; cập nhật module này không thay đổi
Auth/schema/migration. Tài liệu mô tả checkout hiện tại, bao gồm các thay đổi
tích hợp chưa commit, và không khẳng định chúng đã được merge.

## Dependency đã xác minh và bàn giao

`AdminCategoriesRoute` kết nối trang với Auth hiện có, `RequireRole('Admin')`
và `AdminLayout` tại `/admin/categories`. Người dùng đã xác nhận CRUD,
validation, authorization, audit và ngày tạo của Major, Skill trên localhost.
Test trang tự động dùng harness, không xác minh toàn bộ product router hoặc
Google login thật. Review này không chỉnh sửa Auth/router/layout dùng chung.

```tsx
<AdminCategoriesPage accessToken={accessToken} role={role} />
```

Trang đăng ký theo dõi trạng thái Auth hiện có. Auth quản lý refresh/đăng nhập
lại/đăng xuất; module này không tự giải mã JWT, tạo luồng đăng nhập hoặc dùng bộ
nhớ bền vững riêng.

## API và hành vi

- `getAdminCategories`: GET `/api/admin/categories?type=Major|Skill`; Active and
  Closed items in server order, no pagination/search/body.
- `createAdminCategory`: POST `/api/admin/categories` with type/name/reason;
  new status is always Active.
- `renameAdminCategory`: PATCH `/api/admin/categories/:id` with name/reason.
- `setAdminCategoryStatus`: PATCH `/api/admin/categories/:id/status` with
  status/reason. No DELETE, type change or reference replacement.

Mọi lời gọi đều tái sử dụng `protectedApiRequest` dùng chung với Bearer token
hiện tại của Auth và vòng đời refresh. Prop token chỉ kiểm tra khả năng sử dụng,
không phải nguồn thông tin xác thực độc lập. Parser runtime kiểm tra envelope,
enum chính xác, ID INT dương không trùng, tên và tính nhất quán giữa mục tiêu/
kết quả mutation. Request xác thực tên đã trim (1–100 code point Unicode),
reason tùy chọn/null (tối đa 500 code point), ID và giá trị enum. Dữ liệu không
hợp lệ không bao giờ bị coi là thành công với kết quả rỗng. Ngữ nghĩa HTTP
code/status, network và abort được giữ nguyên; Backend vẫn là nơi có thẩm quyền
về authorization và quy tắc nghiệp vụ.

Mỗi danh mục Admin có `createdAt`, được serialize từ `created_at` thành ISO 8601
UTC chuẩn, kể cả response mutation/không thay đổi dữ liệu. Parser chuyển metadata
ngày sai hoặc thiếu thành null; chỉ ô ngày dùng giá trị dự phòng `—`.
Ngày hợp lệ hiển thị theo `dd/MM/yyyy` trong `Asia/Ho_Chi_Minh`. Response public
Major/Student Skill Options không thay đổi.

Tìm kiếm Skill lọc toàn bộ danh sách đã tải trước khi phân trang phía client,
mỗi trang tám dòng. Query được trim, không phân biệt chữ hoa/thường và giữ dấu.
Chức năng không chuẩn hóa dạng kết hợp Unicode hoặc tìm kiếm gần đúng. Thay đổi
tìm kiếm/tab đưa về trang đầu; khi tải lại thành công, trang hiện tại được giới
hạn nếu số kết quả giảm. Trong lúc tải vẫn giữ nguyên trang. Phần tóm tắt hiển
thị khoảng kết quả đang xem và tổng số mục khớp.
Major hiển thị toàn bộ danh sách, không tìm kiếm hoặc phân trang. Không thêm
tham số q/page vào API.

Trang cung cấp lựa chọn Major/Skill, trạng thái, biểu mẫu tạo/đổi tên, xác nhận
đổi trạng thái, reason tùy chọn, cùng trạng thái loading/error/empty/retry/
saving và thông báo khi không có thay đổi. Prop Guest/Student không hiển thị
điều khiển Admin và không gửi API request. Response 401/403 thực tế sẽ ẩn điều
khiển Admin và yêu cầu xác thực lại. Prop vai trò phía client không bao giờ thay
thế Auth/RBAC của Backend.

Khóa mutation ngăn gửi trùng và vô hiệu hóa biểu mẫu/thao tác/thay đổi bộ lọc.
Khi lỗi, nội dung đã nhập được giữ lại và thông báo nêu rõ tên bị trùng,
validation, mục Active cuối cùng, không tìm thấy mục tiêu hoặc lỗi dịch vụ. Khi
thành công, danh sách được tải lại để giữ thứ tự/trạng thái hiện tại từ database.
Thành công khi lưu và lỗi tải lại danh sách sau đó được phân biệt. Lỗi mạng sau
mutation có thể chưa rõ kết quả: hãy tải lại để kiểm tra trạng thái trước khi gửi
lại thủ công. Mutation không tự động được retry.

Request đọc bị hủy khi đổi type/token, tải lại hoặc unmount; kết quả cũ bị bỏ qua.
Token rotation giữ lại nội dung nháp trong modal; đổi người dùng hoặc đăng xuất
sẽ đặt lại workspace. Abort không đảm bảo hủy được mutation mà server đã commit.

## Kiểm chứng

Tại thư mục gốc repository, sau khi tạo Prisma Client và build Backend:

```powershell
node --test frontend/test/admin-categories-api.test.mjs frontend/test/admin-categories-page.test.mjs
node --test backend/test/admin-categories.test.mjs backend/test/categories.test.mjs backend/test/auth-middleware.test.mjs backend/test/activity-log-writer.test.mjs
node --test backend/test/admin-categories-mysql.test.mjs
node --test frontend/test/admin-categories-integration.test.mjs
npm.cmd run typecheck
npm.cmd run build
```

API test dùng fetch double. Browser test mount trang thực với API response được
intercept, bao phủ biểu mẫu, enum/status, khóa khi đang chờ, validation, tạo/
đổi tên/đóng/mở lại/không thay đổi dữ liệu, lỗi nghiệp vụ, auth gate và hủy
request cũ. Môi trường test cần có Playwright/Chromium; đây không phải dependency
của ứng dụng. Nếu thiếu runner, kết quả là SKIP. Helper nằm trong
`frontend/test-support`, ngoài cơ chế tự tìm test của Node, và cấp cho mỗi Vite
harness một optimizer cache tạm riêng để tránh ảnh hưởng các browser test chạy
đồng thời.

Backend test xác minh Auth hiện có, mutation/audit payload và rollback. Backend
MySQL test kiểm tra riêng concurrency transaction thực tế, collation, bất biến
Active cuối cùng và việc giữ nguyên các tham chiếu.

Tích hợp FR–BK dùng Chromium không mock → Vite proxy → Express/Auth dùng chung/
audit → Prisma/MySQL. `TEST_ADMIN_CATEGORIES_FRONTEND_DATABASE_URL` chỉ được trỏ
tới database loopback riêng `unihub_admin_categories_frontend_test*` có migration
hiện tại và categories/users/activity_logs rỗng. JWT test được ký thật, session
và fixture cùng dùng transaction do test quản lý rồi rollback. Bộ test kiểm tra
CRUD, từ chối Guest/Student, lỗi trùng tên/mục Active cuối cùng, audit action,
giữ tham chiếu profile và UI với token không hợp lệ. Bộ này không xác lập mức độ
cô lập transaction giữa các request độc lập; Backend MySQL test kiểm tra ranh
giới transaction thực tế. Không xóa hàng có sẵn. Không dùng database nhóm. Thiếu
cấu hình database sẽ báo SKIP, không phải PASS.

Lệnh `prisma:generate` native trên Cloud từng trả HTTP 403 khi tải checksum của
schema-engine từ `binaries.prisma.sh`. Có thể tạo client thực bằng generator WASM
in-process chính thức cùng phiên bản `@prisma/internals` và
`@prisma/client-generator-ts` 7.10.1 ở ngoài checkout. Sau đó chạy riêng
`npm --ignore-scripts run typecheck` và `npm --ignore-scripts run build`: các lệnh
này thực hiện kiểm tra mà không đi qua lifecycle tạo native đang bị chặn. Không
tắt xác minh TLS/checksum hoặc thay dependency/schema/lockfile.

Đã xác minh bằng kiểm tra tự động trên Windows với Node 24: TypeScript/Vite, API
test và Chromium page test, bao gồm múi giờ/giá trị dự phòng ngày tháng và phân
trang Skill. Xác nhận localhost của người dùng là minh chứng riêng, không nằm
trong phạm vi tự động.
Các nội dung chưa được kiểm chứng bằng những test này: Google login thật, định
tuyến/bố cục toàn sản phẩm, dữ liệu/grant production, NFR hiệu năng, deployment
hoặc độ trung thực với Figma. Profile, Guidance, Recommendations và các module
Admin khác nằm ngoài cập nhật này.
