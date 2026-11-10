# Danh mục

Bảo Quyên phụ trách `backend/src/modules/categories` cho danh mục dùng chung, lộ trình kỹ năng và
quản trị danh mục. Endpoint đọc chuyên ngành công khai đã được triển khai
trên `main` sau PR #13.

## Endpoint tùy chọn chuyên ngành

`GET /api/categories?type=Major` là endpoint công khai, không yêu cầu đăng nhập. Endpoint chỉ trả về
các bản ghi Major có trạng thái Active, sắp xếp theo quy tắc đối chiếu MySQL của `name`, sau đó theo
`category_id`. Phản hồi chỉ chứa `id`, `name` và `type`. Kết quả rỗng
là HTTP 200 với `{ "items": [] }`; tham số truy vấn không được hỗ trợ, bị thiếu hoặc lặp
trả về 400/`INVALID_QUERY`. Khi cơ sở dữ liệu không khả dụng, endpoint trả về
503/`SERVICE_UNAVAILABLE` qua cơ chế ánh xạ lỗi dùng chung.

Triển khai:

- `categories.routes.ts` kiểm tra chính xác truy vấn được hỗ trợ và gắn
  route đọc công khai.
- `categories.service.ts` chọn và sắp xếp các trường trong MySQL thông qua
  Prisma Client dùng chung. Không tạo client hay pool kết nối riêng cho mỗi
  yêu cầu.
- `backend/test/categories.test.mjs` bao phủ kiểm tra yêu cầu, cấu trúc
  phản hồi, lỗi an toàn và một ca kiểm thử tích hợp MySQL cần bật riêng.

Phần Hub của Khánh Huyền gửi `type=Major` và phân tích `{ items: [...] }` với
`id`, `name` và `type`. Phần sử dụng API trong Hub công khai và endpoint đã được kiểm chứng
từ đầu đến cuối; xem [categories-api-contract.md](../../../../docs/categories-api-contract.md).

## Windows PowerShell

Chạy các lệnh sau từ thư mục gốc repository. Cấu hình `backend/.env` với
tài khoản chạy ứng dụng và cơ sở dữ liệu phát triển đã áp dụng các
migration của repository. Không dùng tài khoản migration hay root cho ứng dụng và
không chia sẻ tệp `.env` cục bộ.

```powershell
npm.cmd ci
npm.cmd run dev:backend
```

Sau đó, trong một cửa sổ PowerShell khác, gửi yêu cầu tới endpoint:

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/api/categories?type=Major"
```

Bảng danh mục rỗng trả về mảng `items` rỗng là đúng. Sự cố kết nối/cấu hình
cơ sở dữ liệu trả về phản hồi 503 an toàn. Dừng máy chủ
bằng `Ctrl+C`.

Chạy các kiểm tra repository từ thư mục gốc bằng `npm.cmd run typecheck`,
`npm.cmd run build`, `npm.cmd test` và `npm.cmd run format:check`. Kiểm thử
tích hợp MySQL tùy chọn chỉ dùng `TEST_CATEGORIES_DATABASE_URL` khi biến này trỏ
đến cơ sở dữ liệu chỉ truy cập qua loopback, có tên `unihub_categories_test*` và chưa có
danh mục. Kiểm thử từ chối bảng danh mục đã có dữ liệu và không bao giờ
xóa các bản ghi có sẵn. Dùng cơ sở dữ liệu dùng một lần với các
migration hiện tại; tuyệt đối không trỏ đến cơ sở dữ liệu của nhóm.

## Endpoint tùy chọn kỹ năng

`GET /api/categories?type=Skill` yêu cầu access JWT UniHub hợp lệ và phiên
đang hoạt động thông qua `requireAuth` dùng chung, sau đó là `requireRole('Student')`.
Guest hoặc token không hợp lệ/hết hạn nhận 401 `UNAUTHORIZED`; Admin nhận 403
`FORBIDDEN`. Major vẫn công khai, kể cả khi có header Authorization.
Kiểm tra truy vấn diễn ra trước xác thực: chỉ chấp nhận đúng một `type=Major` hoặc
`type=Skill`; trường truy vấn không được hỗ trợ, bị lặp hoặc thiếu trả về
400 `INVALID_QUERY` trước mọi truy cập cơ sở dữ liệu. Yêu cầu Skill có body trả về
400 `INVALID_REQUEST` trước xác thực hoặc mọi truy cập Prisma. Tìm kiếm và
phân trang không thuộc hợp đồng API tùy chọn.

Cả hai loại dùng lại cùng truy vấn/bộ tuần tự hóa Prisma: chỉ lấy Active, sắp xếp theo
`name ASC, category_id ASC`, chỉ chọn `id`, `name`, `type` cho phản hồi.
Danh sách Skill rỗng trả về 200 với `{ "items": [] }`. Lỗi cơ sở dữ liệu trả về
503 `SERVICE_UNAVAILABLE`; lỗi ngoài dự kiến trả về 500 `INTERNAL_ERROR`.
Các liên kết Closed trên hồ sơ hiện có nằm ngoài phạm vi endpoint này.

### Thử Skill cục bộ (PowerShell, thư mục gốc repository)

Dùng Node 24.19.0 và npm 11.9.0. Chạy `npm.cmd ci`. Cấu hình môi trường
cục bộ backend hiện có theo README của module auth (cấu hình ký JWT,
Google client ID và các origin được phép) cùng cơ sở dữ liệu MySQL phát triển riêng
có các migration hiện tại và quyền chạy ứng dụng. Giữ nguyên các tệp `.env` hiện có;
không bao giờ chia sẻ thông tin xác thực hoặc dùng cơ sở dữ liệu của nhóm để kiểm thử.

```powershell
npm.cmd run dev:backend
```

Trong terminal thứ hai, lấy access token Student hợp lệ qua luồng đăng nhập
Google hiện có, với phiên đang hoạt động trong chính cơ sở dữ liệu phát triển đó. Giữ token
trong biến cục bộ `$studentAccessToken`; không dán vào log hoặc commit.

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/api/categories?type=Skill" -Headers @{ Authorization = "Bearer $studentAccessToken" }
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/api/categories?type=Major"
```

Không có header, Skill phải trả về 401. Lặp lại với token Admin hợp lệ để nhận 403. PowerShell báo các phản hồi ngoài 2xx là lỗi. Bảng danh mục phát triển
rỗng tạo ra `items: []`, không phải lỗi xác thực.

### Kiểm thử và giới hạn

Sau `npm.cmd run build`, chạy
`node --test backend/test/categories.test.mjs backend/test/auth-middleware.test.mjs`.
Các kiểm thử HTTP Categories dùng JWT được ký thực sự và middleware xác thực dùng chung với
các đối tượng thay thế Prisma/phiên. Chúng kiểm chứng điều kiện truy vấn, trường chọn/thứ tự, phân quyền,
lỗi an toàn và hồi quy Major công khai. Ca MySQL cần bật riêng kiểm tra việc lọc danh mục
thực tế, tách biệt loại, sắp xếp và kết quả rỗng cho cả hai loại; phiên xác thực Skill
của ca này là đối tượng thay thế trong kiểm thử. Không có `TEST_CATEGORIES_DATABASE_URL`, ca đó
bị bỏ qua. Các xác nhận truy vấn mô phỏng không chứng minh hành vi đối chiếu thực tế của MySQL.

## Ngoài phạm vi endpoint này

Tùy chọn Skill được triển khai dưới dạng endpoint đọc chỉ dành cho Student như mô tả trên.
Quản lý Admin được triển khai riêng bên dưới. Quy tắc hồ sơ về giữ lại
các liên kết danh mục Closed hiện có vẫn nằm ngoài module này; hợp đồng đã duyệt nằm trong
[categories-api-contract.md](../../../../docs/categories-api-contract.md).
Endpoint tùy chọn dùng lại middleware Auth và các phiên đang hoạt động hiện có.
Endpoint không triển khai đăng nhập Google, chỉnh sửa hồ sơ hoặc phần frontend
sử dụng API hồ sơ; các tích hợp đó phụ thuộc vào module Auth/Profile. Admin phải dùng
API quản lý danh mục riêng, không dùng tùy chọn Skill.

## Quản lý danh mục cho Admin

Được triển khai dưới `/api/admin/categories`, dùng `requireAuth`
rồi `requireRole('Admin')` dùng chung hiện có. Guest/thông tin xác thực không hợp lệ trả về 401;
Student trả về 403. Các route tùy chọn Major công khai và Skill dành cho Student không thay đổi.

- `GET ?type=Major|Skill`: truy vấn chính xác, bắt buộc; trả về các bản ghi Active và Closed
  sắp xếp theo `name ASC, category_id ASC`, với `id/name/type/status/createdAt`.
- `POST /`: `{type,name,reason?}` tạo danh mục Active (201).
- `PATCH /:id`: `{name,reason?}` đổi tên danh mục Active hoặc Closed.
- `PATCH /:id/status`: `{status,reason?}` đóng/mở lại danh mục.
- Không có route DELETE, đổi loại, thay thế tham chiếu, tìm kiếm hoặc phân trang.
  ID hiện có và mọi tham chiếu hồ sơ/cơ hội/kỹ năng được giữ nguyên.

Mọi phản hồi danh mục Admin (danh sách, tạo, đổi tên, trạng thái và thao tác không làm thay đổi dữ liệu) đều có
`createdAt`, được tuần tự hóa từ `created_at` bằng `Date.toISOString()` theo UTC.
Thao tác đổi tên/trạng thái giữ nguyên dấu thời gian ban đầu. Trường chỉ đọc này
không được chấp nhận trong yêu cầu và không được thêm vào tùy chọn Major công khai/Skill dành cho Student.
Frontend Admin hiển thị `dd/MM/yyyy` theo `Asia/Ho_Chi_Minh`; siêu dữ liệu ngày
không hợp lệ hoặc bị thiếu hiển thị dự phòng `—` mà không loại bỏ danh sách.

Tên được cắt khoảng trắng ở hai đầu, không được rỗng và tối đa 100 điểm mã Unicode. Lý do
là tùy chọn/null hoặc chuỗi tối đa 500 điểm mã, được lưu riêng.
Trường JSON không xác định/trùng lặp, trường truy vấn không được hỗ trợ/bị lặp, body GET và
ID không hợp lệ đều bị từ chối. Router dùng bộ phân tích JSON riêng trước bộ phân tích
dùng chung của ứng dụng để phát hiện khóa trùng lặp; lỗi kích thước/mã hóa/cú pháp vẫn dùng
trình xử lý lỗi chung. Ràng buộc UNIQUE `(type,name)` của cơ sở dữ liệu áp dụng quy tắc đối chiếu MySQL
hiện có, bao gồm tính duy nhất của tên không phân biệt hoa thường nhưng phân biệt dấu; P2002
được ánh xạ thành 409 `DUPLICATE_CATEGORY`. Không thay đổi schema hay migration.

Mỗi thao tác thay đổi dùng transaction tương tác RepeatableRead với
`SELECT ... FOR UPDATE` có thứ tự trên các bản ghi danh mục trước khi đọc trạng thái vòng đời. Mọi
thao tác thay đổi danh mục Admin đều lấy cùng các khóa này, tuần tự hóa thay đổi trạng thái và
kiểm tra lại rằng loại đích còn ít nhất một Active. Cách này chủ đích
tuần tự hóa thao tác ghi trên cả hai loại cho tập danh mục nhỏ không phân trang.
Deadlock InnoDB khiến toàn bộ transaction đã rollback được thử lại, tối đa ba lần thử;
hết số lần thử trả về 503 an toàn. Đóng Active cuối cùng trả về 409
`LAST_ACTIVE_CATEGORY`. Không tìm thấy đối tượng đích trả về 404 `NOT_FOUND`.

`writeActivityLog` dùng chung ghi đúng một mục CREATE/RENAME/CLOSE/REOPEN_CATEGORY
với người thực hiện đã xác thực và các trường cũ/mới cô đọng trong cùng
transaction đó. Lỗi chèn/kiểm tra log khiến thao tác thay đổi danh mục được rollback;
giá trị đã tuần tự hóa không bao giờ bị cắt ngắn. Lỗi kiểm tra từ bộ ghi dùng chung trả về
400 `VALIDATION_ERROR`. Thao tác đổi tên/trạng thái giữ nguyên chính xác giá trị hiện có trả về `changed:false` và
không ghi log. Các lỗi khác dùng cơ chế ánh xạ 503/500 an toàn dùng chung.

Sau khi build, chạy từ thư mục gốc repository:

```powershell
node --test backend/test/admin-categories.test.mjs backend/test/categories.test.mjs backend/test/auth-middleware.test.mjs backend/test/activity-log-writer.test.mjs
node --test backend/test/admin-categories-mysql.test.mjs
```

Các kiểm thử HTTP dùng JWT được ký thực sự/Auth dùng chung và bộ ghi nhật ký kiểm toán với
các đối tượng thay thế Prisma hỗ trợ transaction. Chúng không chứng minh cơ chế khóa hay đối chiếu MySQL. Kiểm thử MySQL
cần bật riêng qua `TEST_ADMIN_CATEGORIES_DATABASE_URL`: chỉ chấp nhận cơ sở dữ liệu
`unihub_admin_categories_test*` dùng một lần, truy cập qua loopback, đã áp dụng các migration hiện có và
có users/categories/activity_logs rỗng. Kiểm thử kiểm tra tính duy nhất thực tế,
các thao tác đóng Active cuối cùng đồng thời, bảo toàn tham chiếu và rollback nhật ký kiểm toán. Kiểm thử không bao giờ
xóa dữ liệu có sẵn hoặc xóa mục nhật ký kiểm toán; dữ liệu kiểm thử vẫn nằm trong cơ sở dữ liệu
kiểm thử riêng này, chủ sở hữu phải hủy cơ sở dữ liệu sau khi chạy. Không bao giờ dùng cơ sở dữ liệu chung
hoặc của nhóm. Không có biến đó, kiểm thử MySQL báo SKIP.
