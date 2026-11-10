# Hợp đồng API lộ trình kỹ năng và bài định hướng

> **Contract: leader đã duyệt các quyết định và endpoint dưới đây. Implementation: API `/api/guidance` và frontend `/roadmaps`, `/roadmaps/:id` đã có trên `main` và nhánh tài liệu hiện tại**, qua `guidance.routes.ts`, `GuidanceRoadmapPage` và `GuidanceDetailPage`. Nguồn nghiệp vụ là Chương 3 UC-03/BR-03.1–03.3; dùng opportunities hiện có, không tạo stage model/bảng mới.

## Quyền và chọn Major

Các route GET là public: Guest và Student đều đọc được; Admin cũng chỉ nhận nội dung public. Không cần token. Nếu có Bearer token Student hợp lệ, list có thể dùng users.major_id tương ứng; không đọc year, skills, careerGoal hoặc lịch sử. Token tùy chọn sai/hết hạn trên route guidance public được xử lý như Guest và không dùng hồ sơ. Quy tắc này không áp dụng cho protected route; token sai/hết hạn trên route được bảo vệ trả 401.

Chọn Major:

- Query majorId nếu có phải là số nguyên dương, xuất hiện một lần và trỏ tới Major Active; ID sai/Closed → 400 INVALID_FILTER.
- Nếu không có query: Guest dùng Major Active đầu tiên; Student dùng profile major nếu vẫn Active, còn thiếu/Closed thì fallback Major Active đầu tiên; Admin dùng public fallback.
- Thứ tự Major name ASC, category_id ASC. Không cá nhân hóa bằng academic year, skills, career goal hay lịch sử.
- Không có Major Active → 200 với selectedMajor:null, stages:[].
- Nếu Student token hợp lệ nhưng DB/profile lookup lỗi, trả 503/500; không hạ xuống Guest hoặc [].

## GET /api/guidance

Query tùy chọn duy nhất majorId; không body. Query lạ/lặp hoặc `majorId` sai định dạng/ngoài giới hạn → 400 `INVALID_QUERY`; `majorId` là số nguyên dương hợp lệ nhưng không tồn tại, không phải Major hoặc đang Closed → 400 `INVALID_FILTER`. Response chỉ gồm Approved opportunities có opportunity_type=Bài viết định hướng, được nhóm bởi các hàng opportunity_years trong khoảng 1–4. Không có năm không có nghĩa mọi năm: bài đó không nằm trong stages, nhưng detail public vẫn có thể truy cập qua liên kết public khác.

Response 200:

```json
{
  "selectedMajor": { "id": 4, "name": "Khoa học dữ liệu", "type": "Major" },
  "stages": [
    {
      "academicYear": 2,
      "items": [
        {
          "id": 81,
          "title": "Nền tảng dữ liệu",
          "requiredSkills": [{ "id": 31, "name": "SQL" }],
          "createdAt": "2026-10-01T00:00:00Z"
        }
      ]
    }
  ]
}
```

Khi không có Major được chọn, response chính xác là {"selectedMajor":null,"stages":[]}. Stage được sắp xếp theo academic_year ASC; item theo item_id ASC. Major không có bài đã duyệt trả về selectedMajor và stages:[] (không phải lỗi dịch vụ).

## GET /api/guidance/:id

Path id positive integer; no query/body. Response 200:

```json
{
  "item": {
    "id": 81,
    "title": "Bài định hướng minh họa",
    "publisher": "Đơn vị minh họa",
    "descriptionText": "Nội dung văn bản",
    "requirementsText": null,
    "majors": [{ "id": 4, "name": "Khoa học dữ liệu", "status": "Active" }],
    "skills": [{ "id": 31, "name": "SQL", "status": "Active" }],
    "academicYears": [2],
    "createdAt": "2026-10-01T00:00:00Z"
  }
}
```

Các field mô tả là plain text có thể null, không bao giờ là HTML. Nhãn Major/Skill bao gồm cả giá trị Closed đã liên kết và giữ thứ tự quan hệ từ API; danh sách lựa chọn chỉ gồm Active. academicYears luôn là mảng; mảng rỗng nghĩa là không nhắm tới năm học nào. Response không gồm reviewed_by, danh tính reviewer, log nội bộ hoặc field tài khoản/session. Mục không tồn tại, chưa Approved hoặc không phải guidance đều trả cùng lỗi 404 NOT_FOUND.

## Errors, data and tests

`:id` sai định dạng/vượt giới hạn → 400 `INVALID_ID`; list query lạ/bị lặp/ID sai định dạng → 400 `INVALID_QUERY`; `majorId` hợp lệ nhưng không trỏ tới Major Active → 400 `INVALID_FILTER`; detail không public → 404 NOT_FOUND; DB không khả dụng → 503 SERVICE_UNAVAILABLE; lỗi ngoài dự kiến → 500 INTERNAL_ERROR. Dùng error envelope chung. Không ghi dữ liệu; list đọc categories, opportunities, opportunity_majors, opportunity_years, opportunity_skills và có thể đọc users.major_id nếu Student hợp lệ; detail đọc item public và quan hệ. Lỗi database/dịch vụ không được biến thành fallback Guest hoặc response thành công rỗng.

Test bao gồm: Guest/default; Major trong profile Student hợp lệ; fallback khi Major Student thiếu/Closed; fallback public cho Admin; Major chỉ định không hợp lệ/Closed; response rỗng chính xác khi không có Major Active; bài không gắn năm bị bỏ khỏi stages nhưng detail trực tiếp vẫn public; stage rỗng khi không có bài đã duyệt; token sai được xử lý như Guest chỉ trên route public; lỗi DB 503/500; lọc Approved/type, thứ tự stage/item ổn định, tên liên kết Closed, plain text và không có field reviewer.
