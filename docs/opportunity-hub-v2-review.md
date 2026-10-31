# Hub cơ hội V2 — review 31/10/2026

Nhánh `fix/opportunity-hub-ui`; giữ phần sửa local của Antigravity trong OpportunityHubPage. Không đổi nhánh, stage, commit, push/merge; không sửa Login, PR #41, schema/migration/seed, dependency hoặc lockfile. Yêu cầu bổ sung Skills tiếp theo cho phép sửa backend list API và contract. Bản nguồn Antigravity trước review đã được sao lưu ở artifact `hub-v2-review/OpportunityHubPage.antigravity.tsx`.

## Căn cứ và thay đổi

Đã đối chiếu AGENTS, README, technology-stack, architecture, team-workflow, Opportunity API contract và ảnh người dùng cung cấp `Hub cơ hội-V2 (2).png` (1280 × 1644). Đây là nguồn hình thức tham chiếu, không phải chỉ thị thực thi hoặc dữ liệu sản phẩm.

- Sửa countdown: không lấy `ceil((cutoff - now)/24h)` vì date-only instant là cutoff ngày kế tiếp, dễ báo hôm nay thành còn 1 ngày. Date-only đếm ngày lịch tại Asia/Ho_Chi_Minh từ ngày nguồn; datetime đếm ngày lịch tại sourceTimeZone. Dùng meta.evaluatedAt của server, không dùng đồng hồ/timezone máy người dùng. Hôm nay hiển thị riêng; warning 0–7 ngày. Đây là quy tắc trình bày UI, không đổi backend expiry.
- `state=expired` từ server luôn có ưu tiên; null/legacy unknown không suy đoán ngày hoặc nhãn hết hạn. Ngày/instant không hợp lệ không sinh NaN; timezone không hợp lệ không làm trang crash hoặc tạo countdown. Parser hiện có tiếp tục biến payload sai thành error thay vì danh sách rỗng giả.
- Sửa tóm tắt kết quả dùng filter đã áp dụng trong URL, không dùng draft đang nhập khi chưa Tìm kiếm.
- Browser xác nhận body chung có min-width 1280px khiến mọi viewport nhỏ tràn ngang. Chỉ Hub gắn class body trong thời gian route mount; CSS của feature override min-width, header/nav/footer dưới breakpoint. Cleanup khi rời Hub; không thay stylesheet hoặc component dùng chung, Login hay route khác. Tác động shell chỉ trong Hub; TV1 review điểm tích hợp này.
- Giữ phần filter/card/pagination V2 có sẵn, sửa badge deadline thành góc bo nhẹ như ảnh. Không dựng lại trang hoặc thay quy tắc tìm kiếm/phân trang của API.

## Đối chiếu hình thức và contract gap

Desktop giữ hero, card bốn filter, kết quả, grid ba cột, Verified, warning deadline, CTA, pagination và footer. 1440px dùng content max-width 1280px nên lề ngoài lớn hơn ảnh tham chiếu rộng 1280px. Không tuyên bố pixel-perfect: typography, khoảng trắng/card height và shell/footer còn khác; dữ liệu/độ dài nội dung thực cũng ảnh hưởng chiều cao.

**Skills đã được bổ sung theo yêu cầu tiếp theo:** list API trả `skills: {id,name}[]`, lấy một batch cho ID sau pagination, giữ count/filter/order. Bao gồm Skills Closed đã liên kết; không có liên kết trả `[]`. Frontend dùng list type riêng để không đổi Recommendations, chấp nhận response cũ thiếu trường, kiểm tra dữ liệu sai và hiển thị tên bằng text có xuống dòng. Không hardcode hoặc gọi detail cho từng card. Không cố định sáu card/28 kết quả hoặc năm trang trong production; đó chỉ là fixture, UI thật theo meta/pageSize API.

Ảnh chỉ mô tả desktop. 1024/390/375 là kiểm tra khả dụng theo yêu cầu người dùng, chưa phải thiết kế mobile/tablet được nhóm chốt. Grid chọn 2/1/1 cột; nav và pagination wrap để không tràn ngang. Thông tin tên/đơn vị/type/Verified/work format và link detail vẫn đến từ API, không thêm trường chưa có.

## Browser và ảnh

Edge headless qua Playwright bundled; actual AppRouter/main CSS/Tailwind/font của repository, API responses được intercept bằng fixture. Harness không đọc .env và không kết nối MySQL/Google thật. Browser timezone America/Los_Angeles, evaluatedAt fixture cố định để chứng minh kết quả không phụ thuộc ngày trên máy.

| Viewport | Trước sửa responsive: scrollWidth | Sau sửa: scrollWidth | Grid  |
| -------- | --------------------------------- | -------------------- | ----- |
| 1440     | 1440                              | 1440                 | 3 cột |
| 1024     | 1280                              | 1024                 | 2 cột |
| 390      | 1280                              | 390                  | 1 cột |
| 375      | 1280                              | 375                  | 1 cột |

Ảnh/metrics/log nằm trong artifact `hub-v2-review/screenshots`: `hub-v2-1440.png`, `hub-v2-1024.png`, `hub-v2-390.png`, `hub-v2-375.png`, `metrics.json`. Đã xem trực tiếp screenshot desktop/mobile; không chỉ dựa vào DOM assertions. Đo layout dùng CSS thật; harness ban đầu thiếu utilities do cấu hình Tailwind đã được sửa trước khi lấy số đo ở bảng trên.

## Kiểm tra

- Windows PowerShell, Node 24.22.1/npm 11.19.1; không nâng phiên bản.
- `npm.cmd run typecheck`, `npm.cmd run build`: PASS cả hai workspace.
- `npm.cmd test` sau bổ sung Skills: frontend **134 pass, 0 fail, 48 skip**; backend **200 pass, 0 fail, 22 skip**. Không tính skip thành pass. Backend có bốn test mới với transaction/HTTP fixture; thêm một test MySQL opt-in nhưng chưa chạy vì không cấu hình TEST_DATABASE_URL.
- Deadline unit regression: **6 pass**, bao gồm timezone ngày VN/source, hôm nay, cutoff/expired, 7/8 ngày, năm nhuận/chuyển năm và null/unknown/invalid.
- Browser regression riêng: **6 pass, 0 fail, 0 skip** trên Edge headless; sáu test này nằm trong 48 skip của lượt npm test mặc định và đã được chạy riêng thành công. Bao phủ bốn viewport, filters/pagination/detail/back, loading/empty/error/retry, Major error/Closed, deadline, Skills rỗng/legacy/Closed/tên dài/plain text và không detail fan-out. Ảnh mới có Skills nằm ở artifact `hub-v2-skills/screenshots`.
- `npm.cmd run format:check` và `git diff --check`: PASS.

Lượt browser trước có lỗi test do chụp số request trước khi request Xóa bộ lọc hoàn tất; đã sửa test chờ response tương ứng, không sửa production để né assertion. Không tuyên bố backend/MySQL E2E, production data, NFR hiệu năng, Safari/Firefox hoặc thiết kế mobile đã pass.

## Files và giới hạn còn lại

Ngoài các file Hub/deadline/browser có sẵn từ lượt review, bổ sung sửa opportunities.service.ts, contracts.ts, API contract, feature README, contract tests, backend regression mới và test MySQL opt-in. Các thay đổi Antigravity còn được giữ, không thay bằng bản HEAD. Chưa xác minh Skills trên MySQL thật hoặc hiệu năng production; truy vấn batch được xác minh qua fixture, không phải đo NFR.

Danh sách dùng snapshot evaluatedAt: nếu giữ trang mở qua ngày mới, cần tải lại dữ liệu để nhận thời điểm/state mới. Trang detail và các route khác vẫn giữ desktop contract hiện tại; CSS responsive Hub không mở rộng phạm vi sang các trang đó. Shared shell mới được kiểm tra trên Guest trong browser fixture, chưa nghiệm thu đầy đủ header Student/Admin ở các chiều rộng nhỏ.
