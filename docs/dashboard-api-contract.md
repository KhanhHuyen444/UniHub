# Hợp đồng API Admin Dashboard

> **Contract: leader đã duyệt. Implementation: chưa có trên main.** Chỉ trả đúng số liệu Chương 3 UC-12; không thêm KPI/biểu đồ.

## Quyền và endpoints

Mỗi endpoint yêu cầu access JWT hợp lệ và role Admin qua backend. Guest → 401 UNAUTHORIZED; Student → 403 FORBIDDEN. Không nhận body/query; GET mỗi metric độc lập để lỗi chỉ ảnh hưởng card tương ứng. Mỗi response có evaluatedAt UTC tại thời điểm query; các endpoint không hứa snapshot đồng bộ với nhau.

| Method/path                            | Data predicate                                                                                                                                          | 200 response                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| GET /api/admin/dashboard/accounts      | COUNT mọi users rows.                                                                                                                                   | {"totalAccounts":28,"evaluatedAt":"2026-10-28T00:00:00Z"}                                  |
| GET /api/admin/dashboard/opportunities | COUNT opportunities thuộc Thực tập/Việc làm/Học bổng, theo đúng các status Pending, Approved, Rejected; bài định hướng bị loại. Các count 0 vẫn có mặt. | {"byStatus":{"Pending":2,"Approved":12,"Rejected":1},"evaluatedAt":"2026-10-28T00:00:00Z"} |
| GET /api/admin/dashboard/forum         | posts count chỉ forum_posts.is_deleted=false; comments count is_deleted=false và parent post còn public (is_deleted=false).                             | {"posts":5,"comments":14,"evaluatedAt":"2026-10-28T00:00:00Z"}                             |

Examples are fictional. No user details, post/comment content, or account PII. Each is a read-only query, no activity log and no cross-module transaction. Frontend requests all three in parallel; each card owns its loading/error/retry state. A failed metric is never represented as zero; successful cards may still render.

Errors per endpoint: Guest 401 UNAUTHORIZED; Student 403 FORBIDDEN; DB unavailable 503 SERVICE_UNAVAILABLE; unexpected 500 INTERNAL_ERROR. Error body uses shared envelope, no partial count or database details. No parameters are supported; adding any query is 400 INVALID_QUERY.

Data sources: users; opportunities; forum_posts/comments. Count uses DB at evaluation time; not a synchronized snapshot. DB constraints do not implement these predicates; backend query must. Tests: permission matrix; account count; all three opportunity types/statuses including zero statuses and exclude guidance; hide deleted posts/comments and comments of deleted parent; each endpoint fails independently and does not display error as zero; no writes/log; no extra metric. NFR target from UC-12 (Dashboard ≤2s, API aggregation ≤500ms under normal load) remains a measured performance requirement, not implied by contract approval.
