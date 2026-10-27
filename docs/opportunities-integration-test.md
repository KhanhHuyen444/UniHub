# Kiểm thử tích hợp Public Hub cơ hội

Ngày chạy: **27/10/2026** · Nhánh bắt đầu từ `origin/main` tại `54e28c76d8986e4439abe8a7c89a36248d2e8fb0` (sau PR #13).

## Môi trường và dữ liệu

- MySQL **8.4.13** chạy tạm trong Docker, chỉ bind vào loopback; ba schema thử nghiệm riêng được áp dụng migration initial và migration deadline metadata hiện có. Backend Express dùng Prisma runtime của repository; frontend Vite gọi API qua proxy. Không dùng database nhóm, `.env` thật hay mock API trong ca tích hợp được liệt kê dưới đây.
- Fixtures hư cấu chỉ tồn tại trong database thử nghiệm: Major Active/Closed, Skill Active/Closed; 25 cơ hội Approved thuộc ba loại để kiểm tra phân trang; Pending, Rejected và bài viết định hướng bị ẩn; deadline date-only, datetime, null và legacy unknown; liên kết Major/Skill Closed và trường hợp không có năm học. Không nhập gói 90 nguồn thật và không thêm seed vào repository.
- Khi kiểm tra trạng thái Major rỗng, hai Major fixture Active được chuyển Closed tạm thời rồi khôi phục. API trả HTTP 200 với `items: []`, select bị khóa và giao diện báo chưa có chuyên ngành; danh sách cơ hội vẫn tải. Ca offline riêng làm API request thất bại và giao diện hiện lỗi/thử lại, phân biệt với kết quả rỗng.

## Kết quả

| Hạng mục                 | Kết quả                                                                                                                                                       | Phạm vi bằng chứng                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/ready`         | Pass — `status=ready`, database available                                                                                                                     | Express kết nối MySQL thử nghiệm thật.                                                                                                                                      |
| Major options            | Pass — chỉ Major Active, không có Major Closed hoặc Skill                                                                                                     | `GET /api/categories?type=Major` qua Express/MySQL; consumer Hub tải đúng query và response.                                                                                |
| Opportunities            | Pass — 25 cơ hội Approved; Pending/Rejected/định hướng không được liệt kê hoặc đọc trực tiếp                                                                  | API list/detail thật với database fixture. ID ẩn trả cùng trạng thái 404.                                                                                                   |
| Bộ lọc và điều hướng     | Pass — từ khóa, Major, type, work format, xóa lọc, phân trang, URL, reload, Back/Forward và list → detail → quay lại giữ toàn bộ bộ lọc                       | Chromium gọi backend thật, không route-intercept/mock.                                                                                                                      |
| Chi tiết                 | Pass — Thực tập, Việc làm, Học bổng; Major/Skill Closed giữ tên; năm học rỗng không tạo mục; Verified, source URL và ngày lấy theo API                        | Chromium và response Express thật. Ngày nguồn date-only/datetime giữ đúng; null/unknown không hiện ngày/nhãn hạn. URL `javascript:` bị API loại và UI không tạo link nguồn. |
| Loading, lỗi và thử lại  | Pass — loading dùng độ trễ mạng 1,5 giây; offline cho thấy lỗi API/danh mục và retry phục hồi                                                                 | Playwright/CDP Chromium; request thật, không mock response.                                                                                                                 |
| Font, viewport, bàn phím | Pass — Inter variable font được tải (`InterVariable.woff2`, face `loaded`), computed font là Inter; không tràn ngang; Tab đưa focus tới link với outline 2 px | Chromium headless, zoom mặc định 100%, viewport 1280×1000 và 1920×1000.                                                                                                     |
| Tự động                  | Pass — frontend **25**, backend **28**, tổng **53**; fail **0**, skip **0**                                                                                   | `npm test` từ gốc với `TEST_DATABASE_URL` và `TEST_CATEGORIES_DATABASE_URL` trỏ tới MySQL thử nghiệm loopback riêng. Bao gồm MySQL integration tests của hai module.        |
| Trình duyệt              | Pass — **78**, fail **0**, skip **0**                                                                                                                         | Danh sách, chi tiết ba loại, trạng thái 404, lỗi/retry và hành vi ở cả hai viewport.                                                                                        |

Ảnh chụp do Chromium tạo (dữ liệu nhận diện bằng tiền tố fixture `UHINT-20261027`) nằm tạm trong `/tmp/unihub-integration/`: `hub-list-1280.png`, `hub-list-1920.png`, `detail-Thực-tập.png`, `detail-Việc-làm.png`, `detail-Học-bổng.png`. Đây là ảnh môi trường kiểm thử, không phải screenshot thiết kế Figma và không được đưa vào bundle.

## Giới hạn còn lại

- Chỉ xác nhận trên Chromium/Linux trong môi trường Codex. Chưa kiểm tra trình duyệt Windows hoặc database phát triển trên máy thành viên.
- Dữ liệu là fixture hư cấu; chưa xác minh với gói 90 nguồn, dữ liệu production hoặc nội dung do đơn vị đăng thực tế. Kiểm tra này không đo NFR hiệu năng, tải đồng thời hoặc độ sẵn sàng.
- Không xác minh xác thực/role vì Public Hub hiện công khai; Admin quản lý/duyệt cơ hội, API Skill, seed và các module TV khác vẫn ngoài phạm vi. Vì vậy không kết luận toàn bộ nhiệm vụ TV1 hoàn tất.
- Chưa thay đổi API, schema, migration, GRANT hoặc dependency. Contract Major và deadline hiện hành được giữ nguyên.
