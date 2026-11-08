import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { registerXlsxBody } from '../src/catalog/xlsx-body.js';
import { registerUploadBodies } from '../src/common/upload-body.js';
import { type Db, PRISMA } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { SMS_SENDER } from '../src/sms/sms.js';
import { STORAGE, type Storage } from '../src/storage/storage.service.js';

/** Bellek içi depo: testler SeaweedFS'e bağlı kalmaz (CI'da depo servisi yok) */
export function memoryStorage(): Storage {
  const files = new Map<string, { body: Uint8Array; type: string }>();
  return {
    put: async (key, body, contentType) => {
      files.set(key, { body, type: contentType });
    },
    get: async (key) => {
      const { Readable } = await import('node:stream');
      const f = files.get(key);
      if (!f) throw new Error(`depoda yok: ${key}`);
      return { body: Readable.from([Buffer.from(f.body)]), contentType: f.type, length: f.body.byteLength };
    },
  };
}

export async function createTestApp() {
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(STORAGE)
    .useValue(memoryStorage())
    .compile();
  const app = mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: ['error'] });
  registerXlsxBody(app);
  registerUploadBodies(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, sms: app.get<MemorySmsSender>(SMS_SENDER), db: app.get<Db>(PRISMA) };
}

export async function call(
  app: NestFastifyApplication,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  body?: object,
  token?: string,
) {
  const res = await app.inject({
    method,
    url,
    payload: body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

/** Üyelik onayları (Karar 59): yeni üye kullanım koşulları ve KVKK aydınlatma onayı olmadan açılmaz */
export const SIGNUP_CONSENTS = {
  kullanimKosullari: true,
  kvkkAydinlatma: true,
  ticariIleti: false,
  reklamOlcum: false,
} as const;
