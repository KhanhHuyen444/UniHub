import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Vị trí cho nhiệm vụ migration sau này; hiện chưa có migration.
  migrations: { path: 'prisma/migrations' },
  // Không tự đọc .env thật. Format/validate/generate không cần kết nối DB.
  // Không dùng env() ở đây vì nó ném lỗi khi DATABASE_URL chưa được cấp.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
