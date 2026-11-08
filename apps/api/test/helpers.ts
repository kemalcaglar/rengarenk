import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { registerXlsxBody } from '../src/catalog/xlsx-body.js';
import { type Db, PRISMA } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { SMS_SENDER } from '../src/sms/sms.js';

export async function createTestApp() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: ['error'] });
  registerXlsxBody(app);
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
