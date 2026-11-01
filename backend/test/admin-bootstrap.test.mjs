import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrapFirstAdmin } from '../dist/scripts/admin-bootstrap.js';

function makeDatabase(initialUsers = []) {
  const users = initialUsers.map((user) => ({ ...user }));
  let transactionQueue = Promise.resolve();
  let transactionCount = 0;
  const client = {
    user: {
      findFirst: async ({ where }) =>
        users.find((user) => user.role === where.role) ?? null,
      findUnique: async ({ where }) =>
        users.find((user) => user.google_sub === where.google_sub) ?? null,
    },
    $transaction: async (operation) => {
      const previous = transactionQueue;
      let release;
      transactionQueue = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      transactionCount += 1;
      const transaction = {
        $queryRaw: async () => users.map(({ user_id }) => ({ user_id })),
        user: {
          findFirst: async ({ where }) =>
            users.find((user) => user.role === where.role) ?? null,
          findUnique: async ({ where }) =>
            users.find((user) => user.google_sub === where.google_sub) ?? null,
          updateMany: async ({ where, data }) => {
            const user = users.find(
              (candidate) =>
                candidate.user_id === where.user_id &&
                candidate.google_sub === where.google_sub &&
                candidate.role === where.role,
            );
            if (!user) return { count: 0 };
            Object.assign(user, data);
            return { count: 1 };
          },
        },
      };
      try {
        return await operation(transaction);
      } finally {
        release();
      }
    },
  };
  return {
    client,
    users,
    transactionCount: () => transactionCount,
  };
}

function student(overrides = {}) {
  return {
    user_id: 7,
    google_sub: 'verified-google-sub',
    email: 'student@example.invalid',
    full_name: 'Student Example',
    role: 'Student',
    ...overrides,
  };
}

test('không tìm thấy google_sub thì không hỏi xác nhận hoặc ghi', async () => {
  const database = makeDatabase([student()]);
  let confirmationCalled = false;
  const result = await bootstrapFirstAdmin(
    database.client,
    'missing-sub',
    async () => {
      confirmationCalled = true;
      return true;
    },
  );

  assert.equal(result, 'user_not_found');
  assert.equal(confirmationCalled, false);
  assert.equal(database.transactionCount(), 0);
  assert.equal(database.users[0].role, 'Student');
});

test('đã có Admin thì không hỏi xác nhận và không ghi', async () => {
  const database = makeDatabase([
    student({ user_id: 1, google_sub: 'existing-admin', role: 'Admin' }),
    student(),
  ]);
  let confirmationCalled = false;
  const result = await bootstrapFirstAdmin(
    database.client,
    'verified-google-sub',
    async () => {
      confirmationCalled = true;
      return true;
    },
  );

  assert.equal(result, 'admin_exists');
  assert.equal(confirmationCalled, false);
  assert.equal(database.transactionCount(), 0);
  assert.equal(database.users[1].role, 'Student');
});

test('xác nhận bị hủy thì không mở transaction hoặc ghi', async () => {
  const database = makeDatabase([student()]);
  const result = await bootstrapFirstAdmin(
    database.client,
    'verified-google-sub',
    async () => false,
  );

  assert.equal(result, 'cancelled');
  assert.equal(database.transactionCount(), 0);
  assert.equal(database.users[0].role, 'Student');
});

test('cấp Admin sau xác nhận và ghi đúng user đã chọn bằng google_sub', async () => {
  const database = makeDatabase([student()]);
  const result = await bootstrapFirstAdmin(
    database.client,
    ' verified-google-sub ',
    async (candidate) => candidate.user_id === 7,
  );

  assert.equal(result, 'promoted');
  assert.equal(database.transactionCount(), 1);
  assert.equal(database.users[0].role, 'Admin');
});

test('hai lần bootstrap đồng thời chỉ một user được cấp Admin', async () => {
  const database = makeDatabase([
    student({ user_id: 7, google_sub: 'first-sub' }),
    student({ user_id: 8, google_sub: 'second-sub' }),
  ]);
  const results = await Promise.all([
    bootstrapFirstAdmin(database.client, 'first-sub', async () => true),
    bootstrapFirstAdmin(database.client, 'second-sub', async () => true),
  ]);

  assert.deepEqual(results.sort(), ['admin_exists', 'promoted']);
  assert.equal(
    database.users.filter((user) => user.role === 'Admin').length,
    1,
  );
});
