# Gợi ý cơ hội cá nhân hóa — Bảo Quyên

Triển khai [hợp đồng](../../../../docs/recommendations-api-contract.md) đã duyệt
thành `GET /api/recommendations`. Chỉ có backend; không có UI, thao tác ghi, nhật ký kiểm toán, thay đổi schema
hay lệnh gọi HTTP đến các API UniHub khác.

## Phân quyền và dữ liệu

Dùng `requireAuth` và `requireRole('Student')` dùng chung: JWT thiếu/không hợp lệ/hết hạn
hoặc phiên không hoạt động trả về 401 `UNAUTHORIZED`; Admin trả về 403 `FORBIDDEN`.
Không hỗ trợ truy vấn hay body GET (400 `INVALID_QUERY`). JSON sai định dạng và lỗi kích thước/
mã hóa tiếp tục được xử lý qua trình xử lý lỗi JSON dùng chung hiện có.

Chỉ đọc ID người dùng đã xác thực. Các trường hồ sơ bắt buộc là `major_id`,
`academic_year` 1–4 và ít nhất một liên kết `user_skills` hiện có. Thiếu dữ liệu hoặc
người dùng trả về 409 `PROFILE_INCOMPLETE`, phân biệt với kết quả rỗng thành công.
Không đưa ra email, thông tin xác nhận Google, token, vai trò, mục tiêu nghề nghiệp, DTO hồ sơ hay dữ liệu
người duyệt. API/UI Profile do Thái Bình phụ trách; không thêm endpoint Profile tại đây.

Hồ sơ và các ứng viên được đọc trong một transaction RepeatableRead thông qua
Prisma Client dùng chung, dùng một `evaluatedAt` UTC cho mỗi phản hồi. Truy vấn ứng viên
giới hạn các bản ghi Approved trong ba loại cơ hội công khai và siêu dữ liệu
hạn chót đủ điều kiện. So sánh trạng thái/loại chính xác và tuần tự hóa hạn chót dùng chung cung cấp
các kiểm tra điều kiện cuối cùng độc lập với quy tắc đối chiếu không phân biệt hoa thường của MySQL.

## Điều kiện hợp lệ, điểm và thứ tự ổn định

- Chỉ `Thực tập`, `Việc làm`, `Học bổng` với trạng thái `Approved`.
- Hạn chót NULL đủ điều kiện. Dữ liệu cũ không xác định bị loại ngay cả khi thời điểm nằm trong tương lai.
  Chỉ có ngày thì hết hạn tại `evaluatedAt >= cutoff`; ngày giờ chỉ hết hạn khi
  `instant < evaluatedAt` (bằng nhau vẫn đủ điều kiện).
- `score = 0.4 * majorMatch + 0.3 * yearMatch + 0.3 * skillMatch`.
  Major/năm học là so khớp liên kết nhị phân. Không có liên kết năm học thì bằng không; không có liên kết
  Skill bắt buộc thì bằng một. Các trường hợp khác, mức khớp Skill là số ID bắt buộc khớp chia
  cho tổng số ID bắt buộc. Trạng thái Active/Closed và tên danh mục không bao giờ ảnh hưởng đến
  so khớp ID Major hay Skill; các liên kết Closed hiện có được tính ở cả tử số và
  mẫu số. Điều này không cho phép chọn ID Closed mới trong Profile.
- Lọc điểm chưa làm tròn `< 0.5`; sắp xếp điểm chưa làm tròn DESC, thời điểm hạn chót xác định ASC,
  hạn chót NULL cuối cùng, rồi ID mục ASC. Không có phân trang hay bản ghi trùng do phép nối.
- Dùng lại phép chọn/bộ tuần tự hóa danh sách công khai Opportunities hiện có (chỉ thêm export
  mới, không thay đổi hành vi tại đó), chỉ bổ sung `matchScore` làm tròn đến bốn chữ số
  thập phân. Phản hồi là `{items,meta:{evaluatedAt}}`, kể cả khi `items` rỗng.

Lỗi cơ sở dữ liệu/ngoài dự kiến dùng ánh xạ lỗi 503/500 chung, không bao giờ trả về
thành công rỗng. `backend/src/app.ts` gắn route mới và cần Khánh Huyền/leader review.
Thay đổi Admin Categories, Guidance hay frontend không thuộc tính năng này.

## Kiểm tra

Từ thư mục gốc repository với Node 24.19.0 / npm 11.9.0:

```powershell
npm.cmd run typecheck
npm.cmd run build
node --test backend/test/recommendations.test.mjs backend/test/auth-middleware.test.mjs backend/test/opportunities.test.mjs backend/test/http.test.mjs
node --test backend/test/recommendations-mysql.test.mjs
```

Các kiểm thử HTTP dùng JWT được ký thực sự/Auth dùng chung và các đối tượng thay thế Prisma chỉ đọc. Chúng
bao phủ quyền sở hữu, lỗi xác thực/phiên/vai trò, yêu cầu không được hỗ trợ, hồ sơ chưa hoàn thiện so với
rỗng, các thành phần điểm, độ chính xác chưa làm tròn quanh ngưỡng và các điểm
làm tròn bằng nhau, ID Closed, loại chính xác, hạn chót, cấu trúc phản hồi và lỗi an toàn.

Tích hợp MySQL cần bật riêng qua `TEST_RECOMMENDATIONS_DATABASE_URL`, giới hạn
ở cơ sở dữ liệu `unihub_recommendations_test*` riêng qua loopback, đã có
các migration hiện có và users/categories/opportunities rỗng. Kiểm thử chạy HTTP/Auth,
Prisma và phép nối thực tế trong transaction RepeatableRead do bộ dữ liệu kiểm thử quản lý, kiểm chứng
điểm, thứ tự, hết hạn, dữ liệu không thay đổi và tính bất biến khi thay đổi trạng thái Closed. Dữ liệu kiểm thử
rollback khi hoàn tất/thất bại; không xóa bản ghi hiện có. Kiểm thử không kiểm tra
chỉnh sửa hồ sơ đồng thời hay tính cô lập transaction của các yêu cầu độc lập. Không có
biến đó, kiểm thử tích hợp báo SKIP, không phải PASS. Không bao giờ dùng cơ sở dữ liệu của nhóm.

`prisma:generate` dùng mã máy gốc trong Cloud có thể thất bại với HTTP 403 từ `binaries.prisma.sh`.
Bộ sinh WASM chạy trong tiến trình từ các gói chính thức cùng phiên bản `@prisma/internals` và `@prisma/client-generator-ts`
có thể sinh client thực tế mà không cần schema engine
mã máy gốc. Sau bước sinh tường minh đó, `npm --ignore-scripts run typecheck`,
`npm --ignore-scripts run build` và `npm --ignore-scripts test --workspace
@unihub/backend` chỉ bỏ qua bước generate trong vòng đời bị chặn, đồng thời thực hiện
các kiểm tra được yêu cầu. Không tắt kiểm tra TLS/checksum hoặc thay đổi lockfile.

Các kiểm thử này chưa kiểm chứng: đăng nhập Google, tích hợp UI/API Student Profile,
cấu hình Windows, dữ liệu/quyền production, NFR hiệu năng hoặc triển khai.
