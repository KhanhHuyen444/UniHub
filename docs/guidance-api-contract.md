# Hợp đồng API lộ trình kỹ năng và bài định hướng

> **Contract: leader đã duyệt các quyết định và endpoint dưới đây. Implementation: chưa có trên main.** Nguồn nghiệp vụ là Chương 3 UC-03/BR-03.1–03.3; dùng opportunities hiện có, không tạo stage model/bảng mới.

## Quyền và chọn Major

GET routes public: Guest và Student đều đọc; Admin cũng chỉ nhận nội dung public. Không cần token. Nếu có Bearer token hợp lệ Student, list có thể dùng đúng users.major_id; không đọc year, skills, careerGoal hoặc lịch sử. Token tùy chọn sai/hết hạn trên các public guidance routes được xử lý như Guest và không dùng hồ sơ. Quy tắc này không áp dụng protected routes; route protected với token sai/hết hạn trả 401.

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

No selected Major response is exactly {"selectedMajor":null,"stages":[]}. Stage sort academic_year ASC; items item_id ASC. A Major with no approved article returns selectedMajor and stages:[] (not a service error).

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

Description fields are nullable plain text, never HTML. Major/Skill labels include already-linked Closed values and retain API relation order; chooser options remain Active only. academicYears is always an array; empty means no year target. Response excludes reviewed_by, reviewer identity, internal logs and account/session fields. Missing, non-Approved, or non-guidance item all return the same 404 NOT_FOUND.

## Errors, data and tests

Path `:id` sai định dạng/ngoài giới hạn → 400 `INVALID_ID`; list query lạ/lặp/ID sai định dạng → 400 `INVALID_QUERY`; `majorId` hợp lệ nhưng không trỏ tới Major Active → 400 `INVALID_FILTER`; nonpublic detail → 404 NOT_FOUND; DB unavailable → 503 SERVICE_UNAVAILABLE; unexpected → 500 INTERNAL_ERROR. Error envelope is shared. No writes; list reads categories, opportunities, opportunity_majors, opportunity_years, opportunity_skills and optionally users.major_id for valid Student; detail reads public item and relations. Database/service errors never become Guest fallback or an empty successful response.

Tests: Guest/default; valid Student profile Major; missing/Closed Student Major fallback; Admin public fallback; invalid/Closed explicit major; no active Major exact empty response; no-year article omitted from stages but direct detail public; no approved article empty stage; invalid token behaves Guest only on public route; DB error 503/500; approved/type filter, stable stage/item order, closed linked names, plain text and no reviewer fields. **Contract đã duyệt; API chưa triển khai trên main.**
