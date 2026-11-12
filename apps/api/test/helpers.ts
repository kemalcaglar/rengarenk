import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { normalizeTrMobile, type SignupConsents, type TokenPair } from '@rengarenk/shared';
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
    delete: async (key) => {
      files.delete(key);
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

/** Testlerde formla üye olanın şifresi ve numaradan türetilen e-postası (Karar 18) */
export const TEST_SIFRE = 'Deneme1234';
export const testEposta = (phone: string) => `u${phone.replace(/\D/g, '')}@ornek.com`;

export interface UyeOlSecenek {
  ad?: [string, string];
  eposta?: string;
  sifre?: string;
  consents?: Partial<SignupConsents>;
  platform?: 'IOS' | 'ANDROID' | 'WEB';
  kurulum?: string;
}

/**
 * Üye ol (Karar 18): ad, soyad, e-posta, şifre ve telefon; telefona gelen kodla hesap açılır. Numara zaten kayıtlıysa
 * e-posta ve şifreyle giriş yapar (aynı kişinin ikinci oturumu).
 */
export async function uyeOl(
  app: NestFastifyApplication,
  phone: string,
  o: UyeOlSecenek = {},
): Promise<TokenPair & { userId: string; challengeId: string }> {
  const tel = normalizeTrMobile(phone) ?? phone;
  const db = app.get<Db>(PRISMA);
  const sms = app.get<MemorySmsSender>(SMS_SENDER);
  const kayitli = await db.user.findUnique({ where: { phone: tel }, select: { id: true, email: true } });
  if (kayitli) {
    const g = await call(app, 'POST', '/auth/login', {
      eposta: kayitli.email ?? o.eposta ?? testEposta(tel),
      sifre: o.sifre ?? TEST_SIFRE,
      ...(o.platform ? { platform: o.platform } : {}),
      ...(o.kurulum ? { kurulum: o.kurulum } : {}),
    });
    if (g.status !== 200) throw new Error(`giriş olmadı (${g.status}): ${JSON.stringify(g.body)}`);
    return { ...g.body, userId: kayitli.id, challengeId: '' };
  }
  const r = await call(app, 'POST', '/auth/register', {
    ad: o.ad?.[0] ?? 'Deneme',
    soyad: o.ad?.[1] ?? 'Kullanıcı',
    eposta: o.eposta ?? testEposta(tel),
    telefon: tel,
    sifre: o.sifre ?? TEST_SIFRE,
    consents: { ...SIGNUP_CONSENTS, ...o.consents },
    ...(o.platform ? { platform: o.platform } : {}),
    ...(o.kurulum ? { kurulum: o.kurulum } : {}),
  });
  if (r.status !== 200) throw new Error(`üyelik başlamadı (${r.status}): ${JSON.stringify(r.body)}`);
  const v = await call(app, 'POST', '/auth/register/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(tel),
    ...(o.kurulum ? { kurulum: o.kurulum } : {}),
  });
  if (v.status !== 200) throw new Error(`üyelik tamamlanmadı (${v.status}): ${JSON.stringify(v.body)}`);
  const u = await db.user.findUniqueOrThrow({ where: { phone: tel }, select: { id: true } });
  return { ...v.body, userId: u.id, challengeId: r.body.challengeId };
}
