# activity-logs

Writer dùng chung nằm trong `activity-log.writer.ts` và đã có trên `main` sau PR #22; chưa có API đọc log. API Admin duyệt cơ hội hiện đang được thêm trên nhánh `feat/admin-opportunities`. TV1–TV5 gọi writer trong transaction của thao tác quản trị họ sở hữu. Quy tắc: [activity-logs-contract.md](../../../../docs/activity-logs-contract.md).

Phụ trách dự kiến: **TV5; phối hợp TV1**. Chưa gán tên người hoặc deadline.

Gọi `writeActivityLog(transaction, input)` bằng transaction client nhận từ `prisma.$transaction`; không truyền Prisma root client, không tự mở transaction trong writer. Với Prisma 7.10.1, writer phân biệt interactive transaction qua transaction-scope marker (transaction client vẫn có method `$transaction`) và từ chối root client trước INSERT. Nếu writer ném lỗi, để lỗi thoát khỏi callback để Prisma rollback thao tác nghiệp vụ.

Ví dụ đổi role cùng log:

```ts
await prisma.$transaction(async (transaction) => {
  const target = await transaction.user.findUnique({
    where: { user_id: targetUserId },
    select: { role: true },
  });
  if (!target) throw new Error('Không tìm thấy tài khoản.');
  if (target.role !== 'Student' && target.role !== 'Admin') {
    throw new Error('Role hiện tại không hợp lệ.');
  }
  const oldRole = target.role;
  const newRole = requestedRole; // Role đã được validate từ request/admin policy.
  if (oldRole === newRole) throw new Error('Role không thay đổi.');

  await transaction.user.update({
    where: { user_id: targetUserId },
    data: { role: newRole },
  });
  await writeActivityLog(transaction, {
    adminId: adminIdentity.userId,
    actionType: 'CHANGE_ROLE',
    targetType: 'User',
    targetId: targetUserId,
    oldValue: { role: oldRole },
    newValue: { role: newRole },
  });
});
```

`adminIdentity` phải đến từ middleware đã xác thực, không từ request body. Chỉ truyền payload action tối thiểu theo contract; writer kiểm tra action/target, ID, reason, giới hạn 500 ký tự và từ chối credential-like reason. Không cắt JSON. Chỉ backend truy cập MySQL. Theo [quy trình nhóm](../../../../docs/team-workflow.md) và [quy ước API](../../../../docs/api-conventions.md).
