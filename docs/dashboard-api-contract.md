# Hợp đồng API Admin Dashboard

> **Trạng thái: draft chờ leader review theo UC-12; chưa triển khai.** Chỉ các số liệu Chương 3 yêu cầu, không thêm KPI/biểu đồ.

## Endpoint proposal

Chương 3 nêu ba truy vấn song song và yêu cầu lỗi chỉ đánh dấu các thẻ bị lỗi. Phương án chờ leader review là ba Admin-only endpoint thay vì một response nguyên khối:

| Method/path                            | Dữ liệu và success shape                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/admin/dashboard/accounts      | `{ "totalAccounts": 28, "evaluatedAt": "2026-10-28T00:00:00Z" }`; count users rows.                                                                     |
| GET /api/admin/dashboard/opportunities | `{ "byStatus": {"Pending":2,"Approved":12,"Rejected":1}, "evaluatedAt":"..." }`; count only types Thực tập/Việc làm/Học bổng, exactly these 3 statuses. |
| GET /api/admin/dashboard/forum         | `{ "posts":5,"comments":14,"evaluatedAt":"..." }`; posts nondeleted; comments nondeleted under nondeleted posts.                                        |

All require Admin token server-side. Guest 401, Student 403, DB failure 503 or `500` generic depending on error; no partial count presented as zero. Each is read-only, no activity log. Client loads in parallel, associates error/retry with the affected card; if one fails, render other successful cards; refresh only failed card or all is UI proposal.

Data source tables: users; opportunities; forum_posts/comments. No writes or transaction across modules; each count reflects DB at query time, not a synchronized snapshot across three endpoints. If a single `/api/admin/dashboard` is chosen, Chương 3 partial-card retry requires either per-section results/errors or separate endpoints; this is an open implementation choice.

Examples are fabricated and only shape examples. Error envelope remains common. Tests: role matrix, exact predicates/counts, excluded guidance and other types, deleted parent excludes its comments, no log/write, errors remain per metric, time-of-query and refresh, no added KPI. NFR target from UC-12: full Dashboard ≤2s; API aggregation ≤500ms under normal load; performance needs measured test, not contract review.
