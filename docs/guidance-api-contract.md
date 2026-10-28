# Hợp đồng API lộ trình kỹ năng và bài định hướng

> **Trạng thái: dự thảo contract cho TV3.** Chương 3 UC-03/BR-03.1–03.3 xác nhận luồng Guest/Student chỉ đọc. Nhóm đã duyệt cách xử lý bài không có năm; API lộ trình chưa có trên main. Không tạo bảng hoặc mô hình stage mới.

## Tài nguyên và endpoint đề xuất

GET /api/guidance?majorId={id} trả các bài định hướng được nhóm theo opportunity_years; GET /api/guidance/:id trả chi tiết một bài định hướng public. Hai route public Guest/Student, không cần đăng nhập. Bài viết lấy từ opportunities với opportunity_type='Bài viết định hướng', status='Approved'; target majors/years/skills lấy từ các bảng nối hiện có. Không gọi HTTP nội bộ từ guidance sang opportunities/categories; truy vấn dùng chung Prisma services/repositories trong backend.

### Chọn chuyên ngành

majorId optional, positive integer, một lần; query lạ/lặp/sai → 400 INVALID_QUERY. Nếu truyền ID, backend xác nhận Major Active; sai/Closed → 400 INVALID_FILTER. Không truyền: Student có users.major_id Active thì dùng Major đó; Guest, hồ sơ thiếu hoặc Major trong profile đã Closed thì dùng Major Active đầu tiên theo thứ tự đề xuất name ASC, category_id ASC, khớp Major options đã duyệt. Response luôn trả selectedMajor để UI biết điều kiện. Chương 3 không nêu thứ tự “đầu tiên”; tie sort là chi tiết kỹ thuật cần review.

### List response

    {"selectedMajor":{"id":4,"name":"Khoa học dữ liệu","type":"Major"},"stages":[{"academicYear":2,"items":[{"id":81,"title":"Nền tảng dữ liệu","requiredSkills":[{"id":31,"name":"SQL"}],"createdAt":"2026-10-01T00:00:00Z"}]}]}

Ví dụ hư cấu. Stage derives only from opportunity_years values 1–4; no extra stage entity. Which display order for items within a stage is not set in Chương 3–4; proposal is item_id ASC for deterministic order. If the selected Major has no approved articles, preserve documented empty state “Lộ trình cho chuyên ngành này đang được biên soạn”. **Nhóm đã duyệt:** an approved article with no opportunity_years is omitted from year-grouped stages; its public detail route may still be available when reached through another public link. Empty years do not mean “all years”.

### Chi tiết

GET /api/guidance/:id: valid positive ID, no query. 200 returns item with id, title, safe plain-text descriptionText, requirementsText, nullable publisher, target majors, skills, academicYears, createdAt. 404 same for missing/non-approved/not-guidance item. Do not return reviewer, reviewed_by, account info, internal logs. Major/Skill labels are read from linked categories, including already-linked Closed labels; chooser only supplies Active Major. Text remains text; frontend must not treat stored content as trusted HTML.

Errors: malformed ID 400 INVALID_ID; not public 404 NOT_FOUND; DB unavailable 503; unexpected 500. Frontend supports loading, retry/error distinct from 200 empty. Tests cover Guest/Student, article type/status filtering, active default selection, closed explicit filter, years grouping/no years, closed linked names, detail 404, empty-vs-error.

Tables: opportunities, opportunity_majors, opportunity_years, opportunity_skills, categories, optional users. DB enforces FKs/unique link pairs; backend enforces Approved/type/Active filter and public fields. No writes or transaction beyond a consistent read. **Review needed:** deterministic order within a stage; no-years behavior is approved.
