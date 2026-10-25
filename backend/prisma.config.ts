import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Thư mục migration đã được version-control cùng backend.
  migrations: { path: 'prisma/migrations' },
  // Prisma CLI migrate chỉ đọc URL của tài khoản migration riêng. Các lệnh
  // format, validate, generate và diff-from-empty chạy khi URL chưa được cấp.
  datasource: { url: process.env.MIGRATION_DATABASE_URL ?? '' },
});
