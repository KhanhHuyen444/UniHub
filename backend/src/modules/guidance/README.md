# API đọc lộ trình kỹ năng công khai

Bảo Quyên phụ trách module này. Triển khai tuân theo
[hợp đồng Guidance](../../../../docs/guidance-api-contract.md) đã duyệt, dùng các quan hệ
cơ hội/danh mục hiện có, không thay đổi schema hay ghi dữ liệu.

- `GET /api/guidance`: chỉ nhận `majorId` tùy chọn; chọn Major Active,
  bài viết định hướng Approved và nhóm theo năm học 1–4. Thứ tự giai đoạn là
  năm tăng dần; thứ tự mục là ID tăng dần. Bỏ qua bài viết không có năm học.
- `GET /api/guidance/:id`: chi tiết bài định hướng Approved, bao gồm các liên kết
  Major/Skill Closed hiện có và mảng năm rỗng khi không liên kết năm nào. Các trường văn bản
  là văn bản thuần, không phải HTML đáng tin cậy. Chỉ tuần tự hóa các trường trong hợp đồng.
- Cả hai thao tác đọc chọn `opportunity_type` đã lưu và áp dụng phép so sánh bằng nghiêm ngặt của JavaScript
  với `Bài viết định hướng` trước khi tuần tự hóa. Điều kiện chuỗi MySQL của Prisma
  vẫn là bộ lọc sơ bộ; quy tắc đối chiếu của cơ sở dữ liệu không thể đưa các biến thể về hoa thường,
  dấu, chuẩn hóa hoặc khoảng trắng cuối chuỗi vào phản hồi của cả hai API.
  Trường loại nội bộ không được đưa vào phản hồi.
- Cả hai route đều công khai. Access token Student hợp lệ và phiên đang hoạt động cho phép
  danh sách mặc định dùng Major Active của hồ sơ khi không có truy vấn.
  Khi Major của hồ sơ bị thiếu/Closed, hoặc người dùng là Guest và Admin, dùng Major Active đầu tiên
  (`name ASC, category_id ASC`). Lựa chọn Major Active tường minh được ưu tiên.
- Middleware xác thực dùng chung được bọc cục bộ: chỉ 401 `UNAUTHORIZED` mới chuyển
  về Guest. Lỗi cơ sở dữ liệu, lỗi cấu hình Auth và lỗi ngoài dự kiến
  được truyền tiếp; không bao giờ biến thành phản hồi thành công rỗng.
- Truy vấn/ID/bộ lọc không hợp lệ: 400 `INVALID_QUERY` / `INVALID_ID` / `INVALID_FILTER`;
  chi tiết không khả dụng/riêng tư/sai loại: 404 `NOT_FOUND`; lỗi dịch vụ dùng
  cơ chế xử lý chung 503 `SERVICE_UNAVAILABLE` và 500 `INTERNAL_ERROR`.
- Body GET bị từ chối với 400 `INVALID_REQUEST` (JSON sai định dạng vẫn
  do middleware JSON dùng chung xử lý). Không có tìm kiếm, phân trang hoặc API ghi.

## Kiểm tra trên Windows PowerShell

Chạy từ thư mục gốc repository trên `feat/guidance-public-read`, dùng các
phiên bản Node/npm đã cố định. Giữ nguyên các tệp `.env` cục bộ. Không dùng cơ sở dữ liệu của nhóm.

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
node --test backend/test/guidance.test.mjs backend/test/categories.test.mjs backend/test/auth-middleware.test.mjs backend/test/http.test.mjs
npm.cmd run format:check
git diff --check
```

Các kiểm thử Guidance dùng JWT kiểm thử được ký thực sự và middleware dùng chung với các
đối tượng thay thế thao tác đọc Prisma/phiên. Chúng xác nhận điều kiện/thứ tự truy vấn, cách nhóm, bộ tuần tự hóa, lựa chọn
Major mặc định, kiểm tra dữ liệu và xử lý lỗi. Chúng không chứng minh quy tắc đối chiếu MySQL thực tế,
đăng nhập Google, mức sẵn sàng của môi trường chạy Windows hay các NFR về hiệu năng. Các kiểm thử
Categories hiện có một ca MySQL cần bật riêng; không có cấu hình cơ sở dữ liệu kiểm thử
chuyên dụng thì ca đó bị bỏ qua. Guidance có ca tích hợp cần bật riêng:
`TEST_GUIDANCE_DATABASE_URL` phải trỏ đến cơ sở dữ liệu `unihub_guidance_test*` chỉ
truy cập qua loopback, đã áp dụng các migration hiện có và có categories/opportunities rỗng.
Ca này chèn bài viết hợp lệ và sai loại, kiểm chứng danh sách/chi tiết qua HTTP,
rồi rollback transaction riêng; không bao giờ xóa dữ liệu có sẵn. Không có
biến đó, ca tích hợp là SKIP, không phải PASS.

## Kiểm tra HTTP cục bộ

Với cơ sở dữ liệu phát triển riêng đã áp dụng các migration hiện có của repository,
khởi động backend từ thư mục gốc:

```powershell
npm.cmd run dev:backend
```

Trong terminal thứ hai:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3001/api/guidance'
```

Dùng ID thực sự do cơ sở dữ liệu riêng trả về cho `majorId` tường minh và
`/api/guidance/:id`. Không có Major Active trả về chính xác
`{"selectedMajor":null,"stages":[]}`; Major đã chọn không có bài viết vẫn giữ
`selectedMajor` với `stages` rỗng. Không seed dữ liệu nhóm để tạo bản demo.
Mặc định cho Student yêu cầu cấu hình Auth hiện có của nhóm và token/phiên
UniHub Student thực sự hợp lệ trên cùng cơ sở dữ liệu đó. Không đưa thông tin xác thực/token vào
log. Các route và UI frontend nằm ngoài thay đổi backend này.
