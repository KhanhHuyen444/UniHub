import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL is not configured.');
    this.name = 'DatabaseNotConfiguredError';
  }
}

export class InvalidDatabaseConfigurationError extends Error {
  constructor() {
    super('DATABASE_URL must be a valid MySQL connection URL.');
    this.name = 'InvalidDatabaseConfigurationError';
  }
}

let prismaClient: PrismaClient | undefined;

function parseDatabaseUrl(databaseUrl: string) {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new InvalidDatabaseConfigurationError();
  }

  if (
    url.protocol !== 'mysql:' ||
    !url.hostname ||
    !url.username ||
    !url.password ||
    url.pathname.length < 2 ||
    url.search ||
    url.hash
  ) {
    throw new InvalidDatabaseConfigurationError();
  }

  try {
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = decodeURIComponent(url.pathname.slice(1));
    const port = url.port ? Number(url.port) : 3306;
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

    if (
      !user ||
      !password ||
      !database ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new InvalidDatabaseConfigurationError();
    }

    return {
      host,
      port,
      user,
      password,
      database,
      allowPublicKeyRetrieval:
        host === 'localhost' ||
        host === '::1' ||
        /^127(?:\.\d{1,3}){3}$/.test(host),
    };
  } catch {
    throw new InvalidDatabaseConfigurationError();
  }
}

export function createPrismaClient(
  databaseUrl: string | undefined,
): PrismaClient {
  if (!databaseUrl?.trim()) {
    throw new DatabaseNotConfiguredError();
  }

  const adapter = new PrismaMariaDb({
    ...parseDatabaseUrl(databaseUrl),
    // MySQL 8.4 defaults to caching_sha2_password. Key retrieval is only
    // enabled for loopback development connections; remote hosts require TLS.
    connectionLimit: 5,
    connectTimeout: 5_000,
    acquireTimeout: 5_000,
    socketTimeout: 10_000,
    idleTimeout: 600,
    // The MariaDB driver sets the server session timezone for each new
    // physical connection. Prisma's adapter separately maps DATETIME as UTC.
    timezone: 'Z',
  });

  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = createPrismaClient(process.env.DATABASE_URL);
  }

  return prismaClient;
}

export async function checkDatabaseConnection(): Promise<void> {
  await getPrismaClient().$queryRaw`SELECT 1`;
}

export async function disconnectPrismaClient(): Promise<void> {
  const client = prismaClient;
  prismaClient = undefined;

  if (client) {
    await client.$disconnect();
  }
}
