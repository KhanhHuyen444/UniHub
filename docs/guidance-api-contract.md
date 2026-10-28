# Hợp đồng API lộ trình kỹ năng và bài định hướng

> **Trạng thái: draft chờ leader review.** Chương 3 UC-03/BR-03.1–03.3 xác nhận Guest/Student có thể xem và đổi chuyên ngành mà không cần đăng nhập; API lộ trình chưa có trên main. Nhóm đã duyệt cách xử lý bài không có năm; không tạo bảng hoặc mô hình stage mới.

## Tài nguyên và endpoint đề xuất

GET /api/guidance?majorId={id} trả các bài định hướng được nhóm theo opportunity_years; GET /api/guidance/:id trả chi tiết một bài định hướng public. Hai route public Guest/Student, không cần đăng nhập. Bài viết lấy từ opportunities với opportunity_type='Bài viết định hướng', status='Approved'; target majors/years/skills lấy từ các bảng nối hiện có. Không gọi HTTP nội bộ từ guidance sang opportunities/categories; truy vấn dùng chung Prisma services/repositories trong backend.

### Chọn chuyên ngành

### Chọn chuyên ngành mặc định

Chương 3 UC-03 Basic Flow bước 2–4 và BR-03.2–03.3 làm rõ quy tắc sản phẩm: lấy Major Active; nếu Student đã có hồ sơ và Major trong hồ sơ còn Active thì chọn Major đó; nếu không, chọn Major Active đầu tiên. Guest không cần đăng nhập và dùng Major Active đầu tiên. Các lựa chọn luôn chỉ gồm Active Major. Hợp đồng Major đã duyệt sort `name ASC, category_id ASC`, vì vậy đây là thứ tự xác định đề xuất dùng cho “đầu tiên”. UC-03 không nêu cá nhân hóa theo year, skill, career goal hoặc lịch sử xem; không thêm các yếu tố đó.

Mọi người gọi `GET /api/guidance` không cần đăng nhập; `majorId` tùy chọn, positive integer, một lần. Nếu truyền ID, backend xác nhận Major Active; sai/Closed → 400 `INVALID_FILTER`. Nếu không truyền và request có Bearer token hợp lệ mang role Student, API có thể đọc duy nhất `users.major_id` để áp dụng quy tắc trên. Không đọc năm học, skill, career goal hoặc trường profile khác. Guest dùng fallback đầu tiên. Admin/role khác không dùng hồ sơ Student và dùng fallback public.

Nếu không có Major Active, UC-03 không quy định response; phương án chờ leader review là `selectedMajor: null, stages: []`, trả thành công không có bài và không tạo option giả. Nếu có `majorId`, query lạ/lặp/sai hoặc ID Closed → 400 theo quy ước hợp đồng.

Endpoint vẫn public kể cả khi client gửi token tùy chọn. Phương án kỹ thuật chờ leader review: token hợp lệ Student cho phép dùng Major hồ sơ; token không hợp lệ/hết hạn bị bỏ qua và request chạy theo Guest, không trả 401. Cách này giữ chức năng xem/đổi Major công khai của UC-03/BR-03.2; `selectedMajor` trong response cho client biết kết quả thực tế. Nếu leader muốn token sai trả 401 thì cần chốt riêng vì khi đó header tùy chọn có thể chặn luồng public.

### List response

    {"selectedMajor":{"id":4,"name":"Khoa học dữ liệu","type":"Major"},"stages":[{"academicYear":2,"items":[{"id":81,"title":"Nền tảng dữ liệu","requiredSkills":[{"id":31,"name":"SQL"}],"createdAt":"2026-10-01T00:00:00Z"}]}]}

Ví dụ hư cấu. Stage chỉ lấy `opportunity_years` trong miền 1–4; không thêm entity stage. Thứ tự item trong stage chưa được Chương 3–4 quy định; đề xuất `item_id ASC` để ổn định. Nếu Major được chọn chưa có bài Approved, giữ empty state “Lộ trình cho chuyên ngành này đang được biên soạn”. **Nhóm đã duyệt:** bài định hướng không có `opportunity_years` bị bỏ khỏi nhóm năm; route chi tiết public vẫn có thể truy cập từ liên kết public khác. `[]` không có nghĩa “mọi năm”.

### Chi tiết

GET /api/guidance/:id: valid positive ID, no query. 200 returns item with id, title, safe plain-text descriptionText, requirementsText, nullable publisher, target majors, skills, academicYears, createdAt. 404 same for missing/non-approved/not-guidance item. Do not return reviewer, reviewed_by, account info, internal logs. Major/Skill labels are read from linked categories, including already-linked Closed labels; chooser only supplies Active Major. Text remains text; frontend must not treat stored content as trusted HTML.

Errors: malformed ID 400 INVALID_ID; not public 404 NOT_FOUND; DB unavailable 503; unexpected 500. Frontend supports loading, retry/error distinct from 200 empty. Tests cover Guest/Student, article type/status filtering, active default selection and no-Active-Major empty response, closed explicit filter, years grouping/no years, closed linked names, detail 404, empty-vs-error.

Tables: opportunities, opportunity_majors, opportunity_years, opportunity_skills, categories, optional users. DB enforces FKs/unique link pairs; backend enforces Approved/type/Active filter and public fields. No writes or transaction beyond a consistent read. No-years behavior is approved; deterministic stage/item ordering and optional-auth behavior await leader review.
