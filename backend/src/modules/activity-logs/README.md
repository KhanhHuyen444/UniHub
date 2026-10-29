# activity-logs

Writer dùng chung nằm trong `activity-log.writer.ts` trên nhánh `feat/shared-activity-logs`; chưa có API đọc log hoặc endpoint Admin dùng writer trên `main`. TV1–TV5 gọi writer trong transaction của thao tác quản trị họ sở hữu. Quy tắc: [activity-logs-contract.md](../../../../docs/activity-logs-contract.md).

Phụ trách dự kiến: **TV5; phối hợp TV1**. Chưa gán tên người hoặc deadline.

Gọi `writeActivityLog(transaction, input)` bằng transaction client nhận từ `prisma.$transaction`; không truyền Prisma root client, không tự mở transaction trong writer. Nếu writer ném lỗi, để lỗi thoát khỏi callback để Prisma rollback thao tác nghiệp vụ.

Ví dụ đổi role cùng log:

```ts
await prisma.$transaction(async (transaction) => {
  await transaction.user.update({
    where: { user_id: targetUserId },
    data: { role: 'Admin' },
  });
  await writeActivityLog(transaction, {
    adminId: adminIdentity.userId,
    actionType: 'CHANGE_ROLE',
    targetType: 'User',
    targetId: targetUserId,
    oldValue: { role: 'Student' },
    newValue: { role: 'Admin' },
  });
});
```

`adminIdentity` phải đến từ middleware đã xác thực, không từ request body. Chỉ truyền payload action tối thiểu theo contract; writer kiểm tra action/target, ID, reason, giới hạn 500 ký tự và từ chối credential-like reason. Không cắt JSON. Chỉ backend truy cập MySQL. Theo [quy trình nhóm](../../../../docs/team-workflow.md) và [quy ước API](../../../../docs/api-conventions.md).
