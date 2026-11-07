import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

export * from './generated/client.js';
export { uuidv7 } from './uuid.js';

/** Uygulamanın tek veritabanı istemcisi. Bağlantı havuzu `pg` sürücüsündedir. */
export function createPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) throw new Error('DATABASE_URL tanımlı değil');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

/** Veritabanı tetikleyicilerinin hata kodları (migration.sql). */
export const DbErrorCode = {
  APPEND_ONLY: 'RR001',
  REFUND_FIELDS_LOCKED: 'RR010',
  REFUND_APPROVAL_MISSING: 'RR011',
  REFUND_NOT_APPROVED: 'RR012',
  REFUND_NOT_OWNER: 'RR013',
  REFUND_APPROVAL_EXPIRED: 'RR014',
  REFUND_MISMATCH: 'RR015',
  APPROVAL_DECIDED: 'RR020',
} as const;
