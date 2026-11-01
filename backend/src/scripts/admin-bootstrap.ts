import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { PrismaClient } from '../generated/prisma/client.js';
import { disconnectPrismaClient, getPrismaClient } from '../lib/prisma.js';

export interface AdminBootstrapCandidate {
  user_id: number;
  google_sub: string | null;
  email: string;
  full_name: string;
  role: string;
}

export type AdminBootstrapResult =
  | 'promoted'
  | 'admin_exists'
  | 'user_not_found'
  | 'not_student'
  | 'cancelled'
  | 'changed';

export async function bootstrapFirstAdmin(
  prisma: PrismaClient,
  googleSub: string,
  confirm: (candidate: AdminBootstrapCandidate) => Promise<boolean>,
): Promise<AdminBootstrapResult> {
  const normalizedSub = googleSub.trim();
  if (!normalizedSub || normalizedSub.length > 255) {
    throw new Error('Invalid Google sub input.');
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'Admin' },
    select: { user_id: true },
  });
  if (existingAdmin) return 'admin_exists';

  const candidate = await prisma.user.findUnique({
    where: { google_sub: normalizedSub },
    select: {
      user_id: true,
      google_sub: true,
      email: true,
      full_name: true,
      role: true,
    },
  });
  if (!candidate) return 'user_not_found';
  if (candidate.role !== 'Student') return 'not_student';
  if (!(await confirm(candidate))) return 'cancelled';

  return prisma.$transaction(async (transaction) => {
    // Every existing account maps to the same smallest-user lock row.
    // Concurrent invocations serialize here; the second transaction rechecks
    // the Admin invariant after the first one commits.
    await transaction.$queryRaw<Array<{ user_id: number }>>`
      SELECT user_id FROM users ORDER BY user_id LIMIT 1 FOR UPDATE
    `;

    const admin = await transaction.user.findFirst({
      where: { role: 'Admin' },
      select: { user_id: true },
    });
    if (admin) return 'admin_exists';

    const currentCandidate = await transaction.user.findUnique({
      where: { google_sub: normalizedSub },
      select: { user_id: true, role: true },
    });
    if (!currentCandidate) return 'user_not_found';
    if (currentCandidate.role !== 'Student') return 'not_student';

    const update = await transaction.user.updateMany({
      where: {
        user_id: currentCandidate.user_id,
        google_sub: normalizedSub,
        role: 'Student',
      },
      data: { role: 'Admin' },
    });
    return update.count === 1 ? 'promoted' : 'changed';
  });
}

async function main(): Promise<void> {
  const prompt = createInterface({ input: stdin, output: stdout });
  let prisma: PrismaClient | undefined;
  try {
    stdout.write(
      'Trước tiên, người dùng phải đăng nhập UniHub bằng Google để có tài khoản.\n',
    );
    const googleSub = (
      await prompt.question('Google sub đã xác minh của người dùng: ')
    ).trim();
    if (!googleSub || googleSub.length > 255) {
      stdout.write(
        'Google sub không hợp lệ. Không có thay đổi nào được ghi.\n',
      );
      process.exitCode = 1;
      return;
    }

    prisma = getPrismaClient();
    const result = await bootstrapFirstAdmin(
      prisma,
      googleSub,
      async (user) => {
        stdout.write(
          `Tài khoản được chọn: ${user.full_name} <${user.email}> (user_id ${user.user_id}).\n`,
        );
        return (
          (
            await prompt.question('Nhập PROMOTE để cấp quyền Admin: ')
          ).trim() === 'PROMOTE'
        );
      },
    );

    const messages: Record<AdminBootstrapResult, string> = {
      promoted: 'Đã cấp quyền Admin cho tài khoản đã xác nhận.',
      admin_exists: 'Database đã có Admin; không thay đổi dữ liệu.',
      user_not_found: 'Không tìm thấy tài khoản có Google sub này.',
      not_student:
        'Tài khoản không ở trạng thái Student; không thay đổi dữ liệu.',
      cancelled: 'Đã hủy theo yêu cầu; không thay đổi dữ liệu.',
      changed:
        'Tài khoản đã thay đổi đồng thời; không cấp quyền. Hãy kiểm tra lại trạng thái.',
    };
    stdout.write(`${messages[result]}\n`);
    if (result !== 'promoted') process.exitCode = 1;
  } catch {
    stdout.write(
      'Không thể hoàn tất thao tác Admin bootstrap. Kiểm tra DATABASE_URL và quyền database; chi tiết kết nối không được hiển thị.\n',
    );
    process.exitCode = 1;
  } finally {
    prompt.close();
    if (prisma) await disconnectPrismaClient().catch(() => {});
  }
}

if (process.argv[1]?.endsWith('admin-bootstrap.ts')) {
  await main();
}
