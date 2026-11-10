# Gợi ý cơ hội cá nhân hóa — Bảo Quyên / PR #27

Backend `GET /api/recommendations` đã được triển khai trên nhánh này theo
[hợp đồng](../../../../docs/recommendations-api-contract.md) đã duyệt. Bản cập nhật
frontend này không thay đổi hành vi backend, định nghĩa schema/cơ sở dữ liệu,
Auth/Profile, router dùng chung, Guidance hay Categories.

## Tích hợp Auth/Profile — PR #36

`/recommendations` được router dùng chung gắn bên trong `RequireRole Student` và
StudentLayout. Guest được chuyển đến đăng nhập với returnTo an toàn; Admin được chuyển đến /403.
`PROFILE_INCOMPLETE` cung cấp `/profile`. Theo UC-05, lưu thành công và để sau đều chuyển về trang chủ `/`; để sau không gọi PUT; gợi ý rỗng vẫn được phân biệt với
hồ sơ chưa hoàn thiện hoặc lỗi dịch vụ.

RecommendationsPage giữ các prop token/role để kiểm soát tính khả dụng và hiển thị.
Hook đăng ký theo dõi cùng trạng thái Auth đáng tin cậy mà AuthProvider sử dụng và xác định
chủ sở hữu yêu cầu bằng ID người dùng đã xác thực và vai trò, không dùng nội dung token. Prop token không được chuyển tới API:
module Auth dùng chung cung cấp Bearer token hiện tại và quản lý refresh/thử lại.
Các callback vẫn là tùy chọn cho thành phần sử dụng độc lập và môi trường kiểm thử.

## API, kiểm tra dữ liệu và hook

- `getRecommendations(signal?)` dùng `protectedApiRequest` cho đúng endpoint GET
  mà không có truy vấn/body. Khi gặp 401, hàm dùng refresh/thử lại chung, đọc token
  mới và xóa Auth khi 401 là kết quả cuối cùng. Lỗi dịch vụ refresh chuyển thành trạng thái
  không khả dụng; guard hiện có cho phép thử khôi phục lại. Không có cơ chế xác thực mới.
- Giữ nguyên trạng thái/mã lỗi, lỗi mạng và AbortError.
- `parseRecommendations(unknown)` kiểm tra items/meta/evaluatedAt, các ID MySQL INT
  dương không trùng, các loại cơ hội công khai chính xác, các trường, matchScore hữu hạn trong
  [0.5,1] với độ chính xác đầu ra tối đa bốn chữ số thập phân và hạn chót xác định còn mở.
  Các giá trị lịch trong ngày/thời điểm ISO được kiểm tra. Hạn chót NULL đủ điều kiện;
  dữ liệu phản hồi không xác định/hết hạn là không hợp lệ, không bị âm thầm lọc hoặc hiển thị thành rỗng.
- Kiểm tra hạn chót dùng mốc evaluatedAt cố định của máy chủ: thời điểm của hạn chỉ có ngày
  phải muộn hơn mốc đó; ngày giờ được phép bằng nhau. Không dùng
  đồng hồ hiện tại của trình duyệt để tính lại điều kiện hợp lệ.
- Chỉ lấy các trường công khai trong hợp đồng; title/publisher/location vẫn là văn bản.
  Không hiển thị trường người duyệt/admin/hồ sơ. Giữ nguyên thứ tự backend:
  điểm làm tròn bằng nhau có thể che giấu điểm chưa làm tròn khác nhau, vì vậy frontend không được
  sắp xếp hoặc tính lại điểm. Backend quản lý 40% Major/30% năm học/30% Skill, ngưỡng/xếp hạng
  theo điểm chưa làm tròn và so khớp ID Closed.
- `useRecommendations(token, role)` cung cấp unauthenticated/forbidden/loading/
  success/empty/error và thử lại. Lần gắn Student đầu tiên chỉ tải một lần. Đổi token
  của cùng người dùng giữ nguyên công việc đang chờ/kết quả mà không tự động gửi thêm yêu cầu.
  Thử lại tường minh luôn tải qua Auth dùng chung bằng token hiện tại.
  Đăng xuất, Auth không khả dụng/đang khôi phục, đổi tài khoản hoặc mất vai trò Student
  làm mất hiệu lực phạm vi, hủy các yêu cầu đang chờ và xóa kết quả trước đó.
  Phiên bản phạm vi cũng từ chối phản hồi đến muộn và ngăn kết quả cũ xuất hiện lại
  sau khi cùng người dùng đăng xuất/đăng nhập, kể cả khi các cập nhật được xử lý theo lô. Khi gỡ thành phần,
  các yêu cầu bị hủy. Không thêm cache giữa các người dùng hay cơ chế giải mã JWT riêng.
  Prop Guest/Admin không tải dữ liệu, trong khi Auth/RBAC phía máy chủ vẫn là nguồn quyết định quyền.

## Các trạng thái UI

Trang dùng phần đầu hiển thị số kết quả, danh sách thẻ một cột và thanh bên
với thao tác Profile cùng giải thích cách tính điểm 40/30/30 đã duyệt. Màn hình nhỏ
xếp các phần này theo chiều dọc. Thao tác thanh bên dùng lại callback Profile hiện có.
Thẻ dùng kiểu Card/Badge/Button hiện có, hiển thị title/type/publisher công khai,
hình thức làm việc/địa điểm nếu có, Verified, ngày hạn chót hoặc thông báo không có hạn,
phần trăm phù hợp và liên kết tới các route chi tiết `/opportunities/:id` hiện có.
Phần trăm hiển thị điểm đã làm tròn của API (tối đa hai chữ số thập phân cho phần trăm),
không đổi thứ tự máy chủ. Không kèm dữ liệu kiểm thử/dữ liệu mô phỏng trong production.
UI chưa được kiểm chứng theo Figma và chưa được khẳng định là khung giao diện Student cuối cùng.

Hạn chót chỉ có ngày giữ nguyên ngày theo lịch nguồn của API. Hạn chót ngày giờ
định dạng cả ngày theo lịch và giờ theo sourceTimeZone, đồng thời ghi rõ múi giờ.
Nếu Intl không hỗ trợ múi giờ nguồn, cả ngày lẫn giờ chuyển sang UTC,
với nhãn UTC rõ ràng; không bao giờ ghép ngày nguồn với giờ UTC.
Hạn chót NULL giữ nhãn không có hạn. Điều kiện hợp lệ vẫn dùng evaluatedAt của máy chủ,
không phải phép tính mới của trình duyệt.

- 401 cuối cùng: Auth dùng chung xóa phiên và guard của sản phẩm chuyển Guest đến đăng nhập; nội dung độc lập giữ callback đăng nhập lại.
- 403: giải thích quyền chỉ dành cho Student; không có dữ liệu gợi ý.
- 409 `PROFILE_INCOMPLETE`: phân biệt với rỗng/lỗi; hướng dẫn bổ sung Major, năm học 1–4
  và ít nhất một Skill, callback Profile tùy chọn, thử lại sau khi hoàn thiện.
- 200 rỗng: thông báo không có kết quả phù hợp theo UC-06, thao tác cập nhật hồ sơ tùy chọn và thử lại.
- Đang tải, lỗi dịch vụ/mạng/phản hồi không hợp lệ, thử lại và danh sách thành công là
  các trạng thái riêng. 409 không xác định không được coi là PROFILE_INCOMPLETE.

## Kiểm chứng

Từ thư mục gốc repository sau khi sinh client/build backend:

```powershell
node --test frontend/test/recommendations-api.test.mjs frontend/test/recommendations-page.test.mjs frontend/test/recommendations-card.test.mjs
node --test backend/test/recommendations.test.mjs backend/test/auth-middleware.test.mjs backend/test/http.test.mjs
node --test backend/test/recommendations-mysql.test.mjs
node --test frontend/test/recommendations-integration.test.mjs
npm.cmd run typecheck
npm.cmd run build
```

Các kiểm thử API dùng đối tượng thay thế fetch. Kiểm thử thành phần gắn trang thực tế trong môi trường
Vite/React Router tạm với phản hồi API được chặn để kiểm thử: thông tin tải/thẻ,
điểm phần trăm, thứ tự, an toàn văn bản/href chi tiết, callback 409, rỗng, thử lại,
401/403/kiểm soát vai trò, thay đổi phiên và hủy/phản hồi đến muộn. Playwright/Chromium
được môi trường kiểm thử cung cấp, không phải dependency ứng dụng mới; thiếu trình chạy
sẽ báo SKIP. Helper nằm ngoài phạm vi tự động phát hiện kiểm thử trong test-support và
dùng cache optimizer riêng cho mỗi môi trường kiểm thử để cô lập các máy chủ Vite đồng thời.

Tích hợp FR–BK cần bật riêng dùng Chromium không mô phỏng -> proxy Vite thực -> Express/
Auth dùng chung -> Prisma/MySQL, JWT kiểm thử được ký thực sự/phiên hoạt động và hồ sơ/cơ hội
liên kết thực tế. Kiểm thử kiểm tra điểm/thứ tự ID Closed trên thẻ, hạn chót và
lọc Pending, từ chối Guest/Admin, callback hồ sơ chưa hoàn thiện, thành công rỗng
và UI token không hợp lệ. Yêu cầu `TEST_RECOMMENDATIONS_FRONTEND_DATABASE_URL` trỏ đến
cơ sở dữ liệu `unihub_recommendations_frontend_test*` riêng qua loopback, có các migration hiện tại
và users/categories/opportunities rỗng. Dữ liệu do kiểm thử tạo nằm trong transaction
RepeatableRead do bộ dữ liệu kiểm thử quản lý và được rollback; không dùng cơ sở dữ liệu nhóm hay dữ liệu có sẵn.
Kiểm thử không chứng minh tính cô lập transaction của các yêu cầu độc lập hay chỉnh sửa
Profile đồng thời. Các kiểm thử MySQL backend hiện có kiểm chứng thêm các trường hợp tính điểm/SQL.
Thiếu cấu hình báo SKIP, không phải PASS.

Ghi chú lịch sử về môi trường Cloud: Prisma CLI trả về HTTP 403 khi tải checksum schema-engine
từ binaries.prisma.sh. Các gói chính thức cùng phiên bản `@prisma/internals` và
`@prisma/client-generator-ts` 7.10.1 có thể sinh client thực tế trong tiến trình bằng
WASM bên ngoài checkout. Sau khi sinh tường minh, dùng
`npm --ignore-scripts run typecheck` và `npm --ignore-scripts run build` để chỉ bỏ qua
bước sinh bằng mã máy gốc trong vòng đời bị chặn, đồng thời thực hiện các kiểm tra
được yêu cầu. Không thay đổi kiểm tra TLS/checksum, schema, manifest hay lockfile.

Đặc tả API, công thức tính điểm và hợp đồng phản hồi: [recommendations-api-contract.md](../../../../docs/recommendations-api-contract.md).
Phạm vi kiểm thử fetch/SSR khác với định tuyến trình duyệt, đăng nhập Google thực, tích hợp
MySQL, quyền production, NFR/hiệu năng, triển khai và kiểm chứng Figma.

## Kiểm chứng worktree Recommendations hiện tại

Trên Windows / Node 24.19.0, các kiểm tra Recommendations hiện tại đạt: frontend
22 PASS / 0 FAIL / 1 SKIP và backend Recommendations 11 PASS / 0 FAIL / 1 SKIP.
Typecheck, build, Prettier trong phạm vi thay đổi và git diff --check đều đạt. Với
Prisma Client hiện có, --ignore-scripts bỏ qua hook sinh client, không bỏ qua kiểm tra TypeScript/Vite.
Hai ca bị bỏ qua là tích hợp MySQL thực; chúng CHƯA đạt trong lần
review này. Các kiểm thử này không dùng cơ sở dữ liệu production hay cá nhân.

Các kiểm thử refresh API hiện có từ main được giữ nguyên, bao gồm refresh thành công,
bị từ chối, 401 lần thứ hai là kết quả cuối cùng, dịch vụ refresh gián đoạn/khôi phục và vai trò Admin sau
refresh. Kiểm thử hồi quy trình duyệt bao phủ đổi token của cùng người dùng, thử lại thủ công, đổi
tài khoản/đăng xuất, thu hồi vai trò, hủy/phản hồi đến muộn và cùng người dùng
đăng xuất/đăng nhập theo lô cập nhật. Kiểm thử thẻ SSR tự động bao phủ múi giờ nguồn và dự phòng UTC bắt buộc
qua ranh giới ngày theo lịch, hạn chỉ có ngày và hạn null. SSR không phải kiểm thử
khả năng tương thích múi giờ trên trình duyệt thực.

Kiểm tra localhost cho thấy health/ready ở cổng 3001 truy cập được, trong khi cổng 5173
phục vụ checkout gốc, không phải worktree này. Router được phục vụ thiếu Profile;
HTTP 200 cho /profile chỉ là fallback SPA của Vite, không chứng minh route tồn tại.
Một yêu cầu readiness qua proxy trả về 502 trong khi readiness trực tiếp của backend trả về
200; kiểm tra lặp lại cũng trả về 200 qua proxy. Kiểm chứng proxy phát triển/môi trường chạy
trước khi nghiệm thu thủ công. Các máy chủ hiện có không bị
dừng/khởi động lại và không tệp env nào được sao chép hoặc chỉnh sửa.

Một kiểm tra chỉ đọc localhost:3306/unihub_dev cho thấy 0 Student, 0 hồ sơ Student
hoàn thiện và 0 cơ hội công khai Approved. Chỉ 34 mục danh mục không thể
tạo gợi ý. Luồng Student đăng nhập Google thực -> Profile -> Recommendations
và phản hồi API thực có dữ liệu/rỗng vẫn chưa được kiểm chứng.

Để nghiệm thu thủ công, thống nhất với người vận hành để có cổng 5173 trống, chạy lệnh
phát triển frontend hiện có từ worktree này và cung cấp thiết lập môi trường chạy/Google đã duyệt
mà không đưa bí mật vào Git. Xác nhận /profile và /recommendations từ
router thực sự đang được phục vụ. Không tự động thêm dữ liệu kiểm thử vào cơ sở dữ liệu cá nhân. Môi trường
kiểm thử cần bật riêng phải dùng tên schema kiểm thử loopback được bảo vệ như trên,
các migration hiện tại và các bảng rỗng ban đầu. Chỉ cấp phát tường minh cơ sở dữ liệu
dùng một lần đó, rồi tạo tại đó dữ liệu kiểm thử Student/phiên/hồ sơ/danh mục và
cơ hội Approved/liên kết do kiểm thử quản lý; các kiểm thử tích hợp hiện có xử lý
transaction dữ liệu kiểm thử của chúng. Bao gồm Profile chưa hoàn thiện (409), hoàn thiện/không khớp (200
rỗng), khớp đủ điều kiện, loại trừ hết hạn/Pending, quyền và vòng đời.
Không thực hiện migration, seed hay cấp phát dữ liệu kiểm thử trong lần review này.
