# Hợp đồng API gợi ý cơ hội cá nhân hóa

> **Contract status: chờ leader chốt cách tính Major/Skill Closed.** Các quyết định khác đã duyệt; implementation chưa có trên `main`. Chỉ Student nhận gợi ý; không ghi dữ liệu. Không tự áp dụng quy tắc status từ options vào phép tính UC-06.

## GET /api/recommendations

- **Quyền:** access JWT/session hợp lệ với role Student. Guest hoặc token thiếu/sai/hết hạn → 401 UNAUTHORIZED; Admin → 403 FORBIDDEN.
- **Request:** không body; không nhận query parameter. User ID, role, profile, Major, năm, Skill và score lấy từ session/DB; không chấp nhận giá trị do client gửi. Query lạ hoặc lặp → 400 INVALID_QUERY.
- **Hồ sơ:** đọc major_id, academic_year và user_skills của chính Student. Nếu thiếu Major, năm 1–4 hoặc ít nhất một Skill, trả 409 PROFILE_INCOMPLETE; không trả danh sách rỗng giả. Frontend hiển thị thông báo UC-06 và liên kết tới hồ sơ.
- **Tập ứng viên:** chỉ Approved và opportunity_type thuộc Thực tập, Việc làm, Học bổng; loại bài định hướng, Pending, Rejected. Known deadline chỉ được nhận nếu chưa hết hạn tại một evaluatedAt. NULL deadline được nhận. Legacy unknown bị loại, không suy ra từ timestamp; date-only hết hạn khi evaluatedAt >= cutoff, datetime hết hạn khi deadline instant < evaluatedAt. Mỗi response dùng một evaluatedAt UTC.
- **Điểm:** score = 0.4 × majorMatch + 0.3 × yearMatch + 0.3 × skillMatch; Major/Year binary 0/1; skillMatch là tỷ lệ skill yêu cầu được match, bằng 1 nếu cơ hội không yêu cầu Skill. **Chờ leader chốt:** UC-06 không nêu category status trong scoring; quyết định giữ link Closed cho profile/opportunities chưa tự xác định việc Major/Skill Closed có còn được tính match hay không. Đề xuất so sánh ID của liên kết hiện có bất kể status, không thêm predicate Active; cần thống nhất trước code recommendations. Nếu opportunity_years rỗng, Year=0 và vẫn tính tổng điểm. Loại score < 0.5.
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

Test matrix: role/invalid token; incomplete profile vs empty match; only the three approved types; score raw precision around 0.5 and near-equal ordering where 4-decimal rounded values tie; output rounding only; each component and no-required-skills; no-year gives Year=0 but still scores; Major/Skill Active/Closed scoring cases after leader decision; date-only cutoff exact boundary; datetime equality (equal remains open); NULL eligible; legacy unknown excluded even if stored instant is future; stable deadline/ID tie; no writes; DB error 503 differs from empty 200. **Phần kỹ thuật đã duyệt, nhưng contract Recommendations chưa hoàn tất cho đến khi leader chốt scoring với category Closed; API chưa triển khai trên main.**
