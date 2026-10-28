# Hợp đồng API lộ trình kỹ năng và bài định hướng

> **Trạng thái: draft chờ leader review.** Chương 3 UC-03/BR-03.1–03.3 xác nhận Guest/Student có thể xem và đổi chuyên ngành mà không cần đăng nhập; API lộ trình chưa có trên main. Nhóm đã duyệt cách xử lý bài không có năm; không tạo bảng hoặc mô hình stage mới.

## Tài nguyên và endpoint đề xuất

GET /api/guidance?majorId={id} trả các bài định hướng được nhóm theo opportunity_years; GET /api/guidance/:id trả chi tiết một bài định hướng public. Hai route public Guest/Student, không cần đăng nhập. Bài viết lấy từ opportunities với opportunity_type='Bài viết định hướng', status='Approved'; target majors/years/skills lấy từ các bảng nối hiện có. Không gọi HTTP nội bộ từ guidance sang opportunities/categories; truy vấn dùng chung Prisma services/repositories trong backend.

### Chọn chuyên ngành

### Chọn chuyên ngành mặc định

Chương 3 UC-03 Basic Flow bước 2–4 và BR-03.2–03.3 làm rõ quy tắc sản phẩm: lấy Major Active; nếu Student đã có hồ sơ và Major trong hồ sơ còn Active thì chọn Major đó; nếu không, chọn Major Active đầu tiên. Guest không cần đăng nhập và dùng Major Active đầu tiên. Các lựa chọn luôn chỉ gồm Active Major. **Đã duyệt:** thứ tự Major là `name ASC, category_id ASC`, dùng để xác định Major đầu tiên; thứ tự stage `academic_year ASC` và item `item_id ASC`. UC-03 không nêu cá nhân hóa theo year, skill, career goal hoặc lịch sử xem; không thêm các yếu tố đó.

Mọi người gọi `GET /api/guidance` không cần đăng nhập; `majorId` tùy chọn, positive integer, một lần. Nếu truyền ID, backend xác nhận Major Active; sai/Closed → 400 `INVALID_FILTER`. Nếu không truyền và request có Bearer token hợp lệ mang role Student, API có thể đọc duy nhất `users.major_id` để áp dụng quy tắc trên. Không đọc năm học, skill, career goal hoặc trường profile khác. Guest dùng fallback đầu tiên. Admin/role khác không dùng hồ sơ Student và dùng fallback public.

**Đã duyệt:** nếu không có Major Active, trả HTTP 200 với `{"selectedMajor":null,"stages":[]}`; không tạo option giả. Nếu có `majorId`, query lạ/lặp/sai hoặc ID Closed → 400 theo quy ước hợp đồng.

Các route `GET` guidance là public dù client có gửi token. **Đã duyệt:** token tùy chọn sai/hết hạn không làm route public trả 401; với `GET /api/guidance`, xử lý như Guest và tuyệt đối không đọc hồ sơ. Route chi tiết `GET /api/guidance/:id` không đọc hồ sơ. Quy tắc này chỉ áp dụng các route public guidance; route được bảo vệ vẫn từ chối token sai/hết hạn bằng 401 theo auth contract. Nếu token hợp lệ xác định Student, list API có thể đọc duy nhất `users.major_id`; lỗi database/service khi đọc hồ sơ hoặc danh mục trả lỗi dịch vụ phù hợp (`503 SERVICE_UNAVAILABLE` khi database không sẵn sàng, `500 INTERNAL_ERROR` với lỗi bất ngờ), không fallback sang Guest và không giả làm danh sách rỗng.

### List response

    {"selectedMajor":{"id":4,"name":"Khoa học dữ liệu","type":"Major"},"stages":[{"academicYear":2,"items":[{"id":81,"title":"Nền tảng dữ liệu","requiredSkills":[{"id":31,"name":"SQL"}],"createdAt":"2026-10-01T00:00:00Z"}]}]}

Ví dụ hư cấu. Stage chỉ lấy `opportunity_years` trong miền 1–4; không thêm entity stage. Thứ tự item trong stage chưa được Chương 3–4 quy định; đề xuất `item_id ASC` để ổn định. Nếu Major được chọn chưa có bài Approved, giữ empty state “Lộ trình cho chuyên ngành này đang được biên soạn”. **Nhóm đã duyệt:** bài định hướng không có `opportunity_years` bị bỏ khỏi nhóm năm; route chi tiết public vẫn có thể truy cập từ liên kết public khác. `[]` không có nghĩa “mọi năm”.

### Chi tiết

GET /api/guidance/:id: valid positive ID, no query. 200 returns item with id, title, safe plain-text descriptionText, requirementsText, nullable publisher, target majors, skills, academicYears, createdAt. 404 same for missing/non-approved/not-guidance item. Do not return reviewer, reviewed_by, account info, internal logs. Major/Skill labels are read from linked categories, including already-linked Closed labels; chooser only supplies Active Major. Text remains text; frontend must not treat stored content as trusted HTML.

Errors: malformed ID 400 INVALID_ID; not public 404 NOT_FOUND; DB/service unavailable 503 SERVICE_UNAVAILABLE; unexpected 500 INTERNAL_ERROR. Frontend supports loading, retry/error distinct from 200 empty.

Tables: opportunities, opportunity_majors, opportunity_years, opportunity_skills, categories, optional users. DB enforces FKs/unique link pairs; backend enforces Approved/type/Active filter and public fields. No writes or transaction beyond a consistent read. No-years behavior and default Major rules are approved.

**Ma trận kiểm thử đã chốt:** Guest không token dùng Major đầu tiên; Student token hợp lệ dùng profile Major Active; profile thiếu hoặc Major Closed fallback về Major đầu tiên; Admin dùng fallback public; Major explicit Active được chọn, ID thiếu/sai/Closed trả lỗi theo query contract; không có Major Active trả 200 với `selectedMajor:null,stages:[]`; token tùy chọn sai/hết hạn trên route public list/detail không trả 401, list không truy vấn profile; token sai/hết hạn trên một route protected khác vẫn 401; lỗi đọc DB/service trả 503/500 và không đổi thành Guest/rỗng; kết quả lọc Approved/type/major, thứ tự năm và item ổn định, bài không năm bị bỏ khỏi stage, detail 404 và empty response được phân biệt với lỗi.
