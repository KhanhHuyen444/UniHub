# Hợp đồng API gợi ý cơ hội cá nhân hóa

> **Contract status: leader đã duyệt. Implementation: route/service `/api/recommendations` và frontend `/recommendations` đã có trên `main` và nhánh tài liệu hiện tại.** Source nằm trong `backend/src/modules/recommendations` và `frontend/src/features/recommendations`, dùng auth/RBAC chung. Chỉ Student nhận gợi ý; không ghi dữ liệu.

## GET /api/recommendations

- **Quyền:** access JWT/session hợp lệ với role Student. Guest hoặc token thiếu/sai/hết hạn → 401 UNAUTHORIZED; Admin → 403 FORBIDDEN.
- **Request:** không body; không nhận query parameter. User ID, role, profile, Major, năm, Skill và score lấy từ session/DB; không chấp nhận giá trị do client gửi. Query lạ hoặc lặp → 400 INVALID_QUERY.
- **Hồ sơ:** đọc major_id, academic_year và user_skills của chính Student. Nếu thiếu Major, năm 1–4 hoặc ít nhất một Skill, trả 409 PROFILE_INCOMPLETE; không trả danh sách rỗng giả. Frontend hiển thị thông báo UC-06 và liên kết tới hồ sơ.
- **Tập ứng viên:** chỉ Approved và opportunity_type thuộc Thực tập, Việc làm, Học bổng; loại bài định hướng, Pending, Rejected. Known deadline chỉ được nhận nếu chưa hết hạn tại một evaluatedAt. NULL deadline được nhận. Legacy unknown bị loại, không suy ra từ timestamp; date-only hết hạn khi evaluatedAt >= cutoff, datetime hết hạn khi deadline instant < evaluatedAt. Mỗi response dùng một evaluatedAt UTC.
- **Điểm:** `score = 0.4 × majorMatch + 0.3 × yearMatch + 0.3 × skillMatch`; `majorMatch` và `yearMatch` là binary 0/1.
  - **Major Eligibility Gate:** Nếu cơ hội có chuyên ngành cụ thể (`opportunity_majors` không rỗng), bắt buộc `users.major_id` của Student phải nằm trong các `opportunity_majors.major_id` của cơ hội đó để đủ điều kiện xét; nếu không khớp, cơ hội bị loại bỏ ngay tại Gate trước khi xếp hạng. Cơ hội mở cho mọi ngành (`opportunity_majors` rỗng) và có kỹ năng hợp lệ được phép đi qua Gate với `majorMatch = 0`. Cơ hội thiếu cả Major lẫn Skill bị coi là thiếu mapping và bị loại bỏ.
  - **MajorMatch:** `majorMatch = 1` khi `users.major_id` của Student nằm trong các `opportunity_majors.major_id` của cơ hội đó; so khớp theo ID, không lọc theo `categories.status`. Với cơ hội mở cho mọi ngành, `majorMatch = 0`.
  - **YearMatch:** Cơ hội không giới hạn năm học (`opportunity_years` rỗng) được tính `yearMatch = 1` cho cả ba loại cơ hội (Thực tập, Việc làm, Học bổng). Cơ hội có quy định năm học cụ thể thì `yearMatch = 1` khi `users.academic_year` nằm trong `opportunity_years.academic_year`, ngược lại bằng 0.
  - **SkillMatch:** `skillMatch` là số ID kỹ năng yêu cầu có trong `user_skills` của Student chia cho tổng số ID kỹ năng yêu cầu trong `opportunity_skills`; tính cả ID liên kết tới Category Active và Closed ở cả tử số lẫn mẫu số, không lọc theo `categories.status`. Không có skill yêu cầu thì `skillMatch = 1`. Chỉ dùng ID liên kết, không so khớp theo tên. Vì vậy, chỉ đổi trạng thái Category từ Active sang Closed mà không đổi các liên kết không làm thay đổi điểm. Quy tắc này không cho phép chọn/gắn mới Closed trong options hoặc hồ sơ; các quy tắc đó vẫn theo [categories](categories-api-contract.md) và [profile](profile-api-contract.md).
  - **Ngưỡng hiển thị:** Loại score < 0.5.
- **Precision/sort đã duyệt:** threshold và sort dùng giá trị score chưa làm tròn. Sắp score giảm dần theo raw value; hòa thì known deadline instant tăng dần, NULL xếp sau known, cuối cùng item_id tăng dần. Chỉ field matchScore trong response mới được round đến 4 chữ số thập phân. Không round trước so ngưỡng hoặc sort.

### HTTP 200 response

Không phân trang. Items dùng cùng public list fields/serializer như GET /api/opportunities, cộng matchScore; không trả admin/reviewer data. deadline:null giữ nghĩa “không có hạn”; response này không chứa legacy unknown hoặc deadline đã hết hạn.

```json
{
  "items": [
    {
      "id": 41,
      "type": "Thực tập",
      "title": "Cơ hội minh họa",
      "publisher": "Đơn vị minh họa",
      "workFormat": "Hybrid",
      "location": "Thành phố Hồ Chí Minh",
      "deadline": {
        "precision": "date",
        "date": "2026-11-05",
        "sourceTimeZone": null,
        "instant": "2026-11-05T17:00:00Z",
        "state": "open"
      },
      "isVerified": false,
      "matchScore": 0.7632
    }
  ],
  "meta": { "evaluatedAt": "2026-10-28T00:00:00Z" }
}
```

Example data is fictional. Empty match → HTTP 200 {"items":[],"meta":{"evaluatedAt":"2026-10-28T00:00:00Z"}}; UI shows the UC-06 no-fit message. A database/service error is not empty.

## Errors, data boundary and tests

| HTTP/code               | Condition                                                           |
| ----------------------- | ------------------------------------------------------------------- |
| 400 INVALID_QUERY       | Query/body unsupported or repeated; endpoint accepts no query/body. |
| 401 UNAUTHORIZED        | Guest, absent/invalid/expired access token or inactive session.     |
| 403 FORBIDDEN           | Valid Admin token; Admin cannot call Student-only recommendation.   |
| 409 PROFILE_INCOMPLETE  | Required profile fields are missing.                                |
| 503 SERVICE_UNAVAILABLE | Database/service unavailable.                                       |
| 500 INTERNAL_ERROR      | Unexpected failure.                                                 |

All errors use shared envelope; never expose SQL, stack, user token, or DB URL. Reads users/user_skills/categories/opportunities and opportunity_majors/skills/years; no writes or activity log. Backend calculates without calling public HTTP APIs, avoids duplicate items from many-to-many links, and applies candidate predicates/threshold/sort. DB constraints enforce FK/unique structure only; backend enforces ownership, state, matching, deadline, threshold and precision.

Test matrix: role/invalid token; incomplete profile vs empty match; only the three approved types; score raw precision around 0.5 and near-equal ordering where 4-decimal rounded values tie; output rounding only; each score component and no-required-skills; Major Eligibility Gate excludes mismatched specific majors before ranking; open-to-all majors (empty majors with skills) passes gate with Major=0; unmapped items (empty majors and empty skills) excluded; no-year gives Year=1 for all types; a Closed Major ID linked to the opportunity still yields `majorMatch = 1`; with two required Skills (one Closed) and one matching Student Skill ID that is Closed, `skillMatch = 1/2`, proving Closed IDs count in numerator and denominator; changing only a linked Major/Skill status Active→Closed leaves the score unchanged; date-only cutoff exact boundary; datetime equality (equal remains open); NULL eligible; legacy unknown excluded even if stored instant is future; stable deadline/ID tie; no writes; DB error 503 differs from empty 200. **Contract đã được leader duyệt; API/service và các file test `backend/test/recommendations.test.mjs`, `backend/test/recommendations-mysql.test.mjs` đã có trên main. Ma trận trên không phải kết quả chạy test của lượt đối chiếu tài liệu.**
