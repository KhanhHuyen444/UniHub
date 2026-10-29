import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ActivityLogTransactionRequiredError,
  ActivityLogValidationError,
  writeActivityLog,
} from '../dist/modules/activity-logs/activity-log.writer.js';

function transaction({ error } = {}) {
  const entries = [];
  return {
    entries,
    activityLog: {
      create: async ({ data }) => {
        if (error) throw error;
        entries.push(data);
        return { log_id: entries.length };
      },
    },
  };
}

const common = { adminId: 9, targetId: 42 };
const validEntries = [
  {
    ...common,
    actionType: 'APPROVE_OPPORTUNITY',
    targetType: 'Opportunity',
    oldValue: { status: 'Pending', is_verified: false },
    newValue: { status: 'Approved', is_verified: true },
  },
  {
    ...common,
    actionType: 'REJECT_OPPORTUNITY',
    targetType: 'Opportunity',
    oldValue: { status: 'Pending', is_verified: false },
    newValue: { status: 'Rejected', is_verified: false },
    reason: 'Không đủ thông tin nguồn.',
  },
  {
    ...common,
    actionType: 'DELETE_POST',
    targetType: 'ForumPost',
    oldValue: { is_deleted: false },
    newValue: { is_deleted: true },
    reason: 'Vi phạm quy tắc diễn đàn.',
  },
  {
    ...common,
    actionType: 'DELETE_COMMENT',
    targetType: 'Comment',
    oldValue: { is_deleted: false },
    newValue: { is_deleted: true },
    reason: 'Nội dung không phù hợp.',
  },
  {
    ...common,
    actionType: 'CREATE_CATEGORY',
    targetType: 'Category',
    oldValue: null,
    newValue: { type: 'Major', name: 'Kỹ thuật phần mềm', status: 'Active' },
  },
  {
    ...common,
    actionType: 'RENAME_CATEGORY',
    targetType: 'Category',
    oldValue: { name: 'Tên cũ' },
    newValue: { name: 'Tên mới' },
    reason: 'Chuẩn hóa tên hiển thị.',
  },
  {
    ...common,
    actionType: 'CLOSE_CATEGORY',
    targetType: 'Category',
    oldValue: { status: 'Active' },
    newValue: { status: 'Closed' },
  },
  {
    ...common,
    actionType: 'REOPEN_CATEGORY',
    targetType: 'Category',
    oldValue: { status: 'Closed' },
    newValue: { status: 'Active' },
  },
  {
    ...common,
    actionType: 'CHANGE_ROLE',
    targetType: 'User',
    oldValue: { role: 'Student' },
    newValue: { role: 'Admin' },
  },
];

test('ghi payload compact đúng danh sách field được duyệt cho mọi action', async () => {
  const tx = transaction();
  for (const entry of validEntries) await writeActivityLog(tx, entry);

  assert.equal(tx.entries.length, validEntries.length);
  assert.deepEqual(tx.entries[0], {
    admin_id: 9,
    action_type: 'APPROVE_OPPORTUNITY',
    target_type: 'Opportunity',
    target_id: 42,
    old_value: '{"status":"Pending","is_verified":false}',
    new_value: '{"status":"Approved","is_verified":true}',
    reason: null,
  });
  assert.equal(tx.entries[1].reason, 'Không đủ thông tin nguồn.');
  assert.equal(tx.entries[4].old_value, null);
  assert.equal(
    tx.entries.every(
      (entry) =>
        entry.old_value === null || Array.from(entry.old_value).length <= 500,
    ),
    true,
  );
  assert.equal(
    tx.entries.every((entry) => Array.from(entry.new_value).length <= 500),
    true,
  );
});

test('từ chối Prisma root client trước khi gọi create; transaction client được nhận', async () => {
  const tx = transaction();
  let rootTransactionCalls = 0;
  const rootClient = {
    ...tx,
    $transaction: async () => {
      rootTransactionCalls += 1;
    },
  };

  await assert.rejects(
    writeActivityLog(rootClient, validEntries[0]),
    ActivityLogTransactionRequiredError,
  );
  assert.equal(tx.entries.length, 0);
  assert.equal(rootTransactionCalls, 0);

  await writeActivityLog(tx, validEntries[0]);
  assert.equal(tx.entries.length, 1);

  const prismaTransaction = {
    ...transaction(),
    $transaction: async () => {},
    [Symbol.for('prisma.client.transaction.scope_context')]: {
      kind: 'nested',
      txId: 'tx-id',
      scopeId: 'scope-id',
      scopeState: { stack: [] },
    },
  };
  await writeActivityLog(prismaTransaction, validEntries[0]);
  assert.equal(prismaTransaction.entries.length, 1);
});

test('từ chối action-target sai, payload thừa/sai, ID sai và reason thiếu', async () => {
  const invalidEntries = [
    { ...validEntries[0], targetType: 'Category' },
    {
      ...validEntries[0],
      newValue: { ...validEntries[0].newValue, email: 'x' },
    },
    { ...validEntries[0], token: 'secret' },
    { ...validEntries[0], targetId: 0 },
    { ...validEntries[0], adminId: 2_147_483_648 },
    { ...validEntries[1], reason: '   ' },
    { ...validEntries[1], reason: undefined },
    {
      ...validEntries[4],
      newValue: { ...validEntries[4].newValue, status: 'Closed' },
    },
    { ...validEntries[8], oldValue: { role: 'Guest' } },
  ];

  for (const entry of invalidEntries) {
    await assert.rejects(
      writeActivityLog(transaction(), entry),
      ActivityLogValidationError,
    );
  }
});

test('đếm giới hạn theo Unicode code point và không cắt reason', async () => {
  const tx = transaction();
  const reasonAtLimit = '🌱'.repeat(500);
  await writeActivityLog(tx, { ...validEntries[1], reason: reasonAtLimit });
  assert.equal(tx.entries[0].reason, reasonAtLimit);
  await assert.rejects(
    writeActivityLog(transaction(), {
      ...validEntries[1],
      reason: `${reasonAtLimit}🌱`,
    }),
    ActivityLogValidationError,
  );

  const unicodePayload = transaction();
  await writeActivityLog(unicodePayload, {
    ...validEntries[4],
    newValue: {
      type: 'Major',
      name: 'Ngành kỹ thuật 🌱',
      status: 'Active',
    },
  });
  assert.match(unicodePayload.entries[0].new_value, /Ngành kỹ thuật 🌱/);
});

test('không ghi credential dạng Bearer/JWT/refresh vào reason', async () => {
  for (const reason of [
    'Bearer abc.def.ghi',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature-value-long',
    'A'.repeat(43),
  ]) {
    await assert.rejects(
      writeActivityLog(transaction(), { ...validEntries[1], reason }),
      ActivityLogValidationError,
    );
  }
});

test('lỗi database được truyền nguyên trạng để transaction caller rollback', async () => {
  const databaseError = new Error('database write failed');
  const tx = transaction({ error: databaseError });

  await assert.rejects(
    writeActivityLog(tx, validEntries[0]),
    (error) => error === databaseError,
  );
  assert.equal(tx.entries.length, 0);
});
