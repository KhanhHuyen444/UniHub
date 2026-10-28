# Hợp đồng API gợi ý cơ hội cá nhân hóa

> **Trạng thái: draft chờ leader review; chưa triển khai.** Chỉ Student, không phải Guest; không ghi dữ liệu. Nhóm đã duyệt loại deadline legacy unknown, `Year=0` cho `opportunity_years=[]` và vẫn xét score.

## GET /api/recommendations (đường dẫn đề xuất)

Role Student + valid access JWT/session. Guest → 401; Admin → 403. No client-supplied userId, Major, year, skills, role or score. No query params in this minimal version; unknown/repeated params → 400 INVALID_QUERY.

Read current user’s major_id, academic_year, user_skills; profile requires all three: Major, year 1–4, ≥1 Skill. Incomplete → proposed 409 PROFILE_INCOMPLETE, with error envelope and Chương 3 message “Vui lòng hoàn thiện hồ sơ để nhận gợi ý cơ hội phù hợp.” Frontend links to profile and does not render as empty result.

Candidate set: only opportunities.status=Approved, type in Thực tập, Việc làm, Học bổng; exclude expired. For known datetime, compare current instant; for date-only, compare now against cutoff 00:00 next day Asia/Ho_Chi_Minh; exclude expired. NULL deadline is eligible. Major/Year/Skills scores follow Chương 3 exactly:

score = 0.4 × majorMatch + 0.3 × yearMatch + 0.3 × skillMatch where each binary match is 0/1 except skillMatch = matched required skills / required skills count; when no required skills, skillMatch=1. Chương 3 defines Year=1 when the student's year belongs to `target_years`, otherwise 0. **Nhóm đã duyệt:** if `opportunity_years` is empty, set `Year=0` and still evaluate the total score; never infer “all years.” Exclude score <0.5. Sort score DESC, known deadline instant ASC, null last, item_id ASC. Response carries score; proposed numeric precision is 4 decimals.

### Legacy deadline unknown — quyết định đã được duyệt

The existing deadline contract distinguishes unknown from NULL; unknown means a legacy timestamp exists but its source precision/timezone cannot be proven. UC-06 only says deadline >= current time OR no deadline. **Nhóm đã duyệt loại unknown** until source metadata is verified; timestamp retained in DB is not enough evidence that an application deadline is still open. NULL remains eligible. No inference/backfill from timestamps. Actual recommendation API is still unimplemented.

Response example, fabricated item:

    {"items":[{"id":41,"title":"Thực tập phân tích dữ liệu","opportunityType":"Thực tập","publisher":"Đơn vị minh họa","isVerified":false,"matchScore":0.76,"deadline":{"precision":"date","date":"2026-11-05","instant":"2026-11-05T17:00:00Z","state":"open"}}]}

The item envelope should reuse public opportunity response fields; do not include admin metadata. Empty match set → 200 {"items": []} and the Chương 3 no-fit message. DB outage → 503, not empty. Errors include 401/403, 409 incomplete, 500/503. Backend performs scoring/filter/sort in database or bounded server query; it must not call public HTTP APIs internally. No writes/transaction. Tables: users, user_skills, categories, opportunities, opportunity_majors/skills/years. DB protects FK/link uniqueness; backend handles score, status/type/deadline, ownership and threshold.

Test matrix: Guest/Admin/Student, incomplete profile, no candidates, all three eligible types, guidance exclusion, each score component and threshold 0.4999/0.5, no required skills, empty `opportunity_years` sets `Year=0` and still evaluates the score, Major/Skill Closed links, date-only around cutoff, datetime exact equality per source, NULL eligible, legacy unknown excluded even if stored timestamp is future, stable ties, no writes, DB error distinct from empty. Source of score/order: Chương 3 UC-06/BR-06.1–06.5; empty-year and unknown-deadline rules are group decisions recorded in this session.
