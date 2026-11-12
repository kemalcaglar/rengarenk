import 'reflect-metadata';
import { uuidv7 } from '@rengarenk/db';
import { vknGecerli } from '@rengarenk/shared';
import sharp from 'sharp';
import { hashPassword } from '../auth/password.js';
import { createApp } from '../bootstrap.js';
import { loadEnv } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { EntitlementService } from '../entitlements/entitlement.service.js';
import { GalleryApplicationService } from '../galleries/gallery-application.service.js';
import { PortfolioService } from '../portfolio/portfolio.service.js';
import { DemandSearchService } from '../search/demand-search.service.js';
import { FakeIdentityProvider } from '../staff/identity.js';
import { SecretBox } from '../staff/secret-box.js';
import { currentStep, totpAt } from '../staff/totp.js';

/**
 * Yerel demo verisi (yalnızca geliştirme). Bireysel kullanıcılar, galeriler (biri ücretli paketli, biri denemede, biri
 * başvuru incelemesinde), portföy araçları, talepler, mesajlar, favoriler, kayıtlı arama, destek talebi, şikâyet ve
 * konsol çalışanları API'nin kendi uçlarından kurulur (hak defteri, işlem kaydı, outbox ve arama tutarlı kalır).
 * Giriş bilgileri: docs/DURUM-VE-TEST.md.
 *
 *   pnpm --filter @rengarenk/api demo            demo verisini kurar (varsa dokunmaz)
 *   pnpm --filter @rengarenk/api demo kod <e-posta>   konsol çalışanının şu anki doğrulama kodu
 */

const env = loadEnv();
if (env.NODE_ENV !== 'development') throw new Error('Demo verisi yalnızca yerel geliştirmede kurulur');
if (env.SMS_PROVIDER !== 'console')
  throw new Error('Demo verisi için SMS_PROVIDER=console olmalı (kod yanıtta döner)');

const [komut, arg] = process.argv.slice(2);

const app = await createApp();
await app.init();
await app.getHttpAdapter().getInstance().ready();
const db = app.get<Db>(PRISMA);

if (komut === 'kod') {
  const s = await db.staffMember.findUnique({ where: { email: String(arg ?? '').toLowerCase() } });
  if (!s?.totpSecretEnc) console.log('Bu e-postayla doğrulama uygulaması kurulu çalışan yok.');
  else
    console.log(
      `${s.email} · şu anki kod: ${totpAt(app.get(SecretBox).open(s.totpSecretEnc), currentStep())}`,
    );
  await app.close();
  process.exit(0);
}

// ── İstek yardımcıları: her istek ayrı IP'den (giriş hız sınırları demo kurulumunu durdurmasın) ──
let ipNo = 0;
const ip = () => `10.77.${Math.floor(++ipNo / 250)}.${(ipNo % 250) + 1}`;
// biome-ignore lint/suspicious/noExplicitAny: demo betiği farklı uçların yanıtlarını okur
type Yanit = { status: number; body: any; headers: Record<string, unknown> };
async function istek(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
  token?: string,
  ekBaslik: Record<string, string> = {},
): Promise<Yanit> {
  const r = await app.inject({
    method,
    url,
    payload: body as never,
    remoteAddress: ip(),
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...ekBaslik },
  });
  return { status: r.statusCode, body: r.body ? safeJson(r.body) : undefined, headers: r.headers };
}
function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
function olmali(r: Yanit, ne: string, kodlar = [200, 201, 204]) {
  if (!kodlar.includes(r.status)) throw new Error(`${ne}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

const ONAY = { kullanimKosullari: true, kvkkAydinlatma: true, ticariIleti: true, reklamOlcum: false };

interface Kisi {
  tel: string;
  ad: string;
  soyad: string;
  token: string;
  userId: string;
}
/** Demo hesapların şifresi ve e-postası (Karar 18: e-posta ve şifreyle giriş; yalnızca yerel demo) */
const DEMO_SIFRE = 'Demo1234';
const demoEposta = (tel: string) => `demo${tel.slice(-7)}@ornek.com`;

async function giris(tel: string, ad: string, soyad: string): Promise<Kisi> {
  const var_ = await db.user.findUnique({
    where: { phone: tel },
    select: { id: true, email: true, passwordHash: true },
  });
  if (var_) {
    const eposta = var_.email ?? demoEposta(tel);
    // Karar 18'den önce telefonla kurulan demo hesaplara e-posta ve şifre verilir (yalnızca yerel demo)
    if (!var_.passwordHash) {
      await db.user.update({
        where: { id: var_.id },
        data: { email: eposta, passwordHash: await hashPassword(DEMO_SIFRE) },
      });
    }
    const g = olmali(await istek('POST', '/auth/login', { eposta, sifre: DEMO_SIFRE }), `${ad} giriş`);
    return { tel, ad, soyad, token: g.accessToken, userId: var_.id };
  }
  // Yalnızca yerel demo: önceki kod istekleri geriye alınır (60 sn bekleme ve saatlik sınır yeniden kurulumu durdurmasın)
  await db.otpChallenge.updateMany({
    where: { phone: tel, createdAt: { gt: new Date(Date.now() - 3600_000) } },
    data: { createdAt: new Date(Date.now() - 2 * 3600_000) },
  });
  const r = olmali(
    await istek('POST', '/auth/register', {
      ad,
      soyad,
      eposta: demoEposta(tel),
      telefon: tel,
      sifre: DEMO_SIFRE,
      consents: ONAY,
    }),
    `${ad} üyelik`,
  );
  if (!r.devCode)
    throw new Error('Kod yanıtta dönmedi (SMS_PROVIDER=console ve NODE_ENV=development olmalı)');
  const v = olmali(
    await istek('POST', '/auth/register/verify', { challengeId: r.challengeId, code: r.devCode }),
    `${ad} üyelik kodu`,
  );
  const u = await db.user.findUniqueOrThrow({ where: { phone: tel }, select: { id: true } });
  return { tel, ad, soyad, token: v.accessToken, userId: u.id };
}

// ── Çalışanlar: sahte Google girişi ve doğrulama uygulaması kurulumu; sır çıktıya yazılır ──
const CALISANLAR = [
  ['yonetici@rengarenksite.com', 'Deniz Yönetici', 'ADMIN'],
  ['moderator@rengarenksite.com', 'Mert Moderatör', 'MODERATOR'],
  ['destek@rengarenksite.com', 'Duygu Destek', 'SUPPORT'],
  ['finans@rengarenksite.com', 'Fatih Finans', 'FINANCE'],
  ['operasyon@rengarenksite.com', 'Oya Operasyon', 'OPERATIONS'],
  ['pazarlama@rengarenksite.com', 'Pelin Pazarlama', 'MARKETING'],
  ['izleyici@rengarenksite.com', 'İlker İzleyici', 'VIEWER'],
] as const;

async function calisanGiris(email: string): Promise<{ token: string; sir: string | null }> {
  const adres = ip();
  const st = async (url: string, body?: unknown) => {
    const r = await app.inject({ method: 'POST', url, payload: body as never, remoteAddress: adres });
    return { status: r.statusCode, body: safeJson(r.body) } as Yanit;
  };
  const basla = olmali(await st('/staff/auth/google/start'), 'yönetim başlat');
  const cb = olmali(
    await st('/staff/auth/google/callback', {
      state: basla.state,
      code: FakeIdentityProvider.code({ email }),
    }),
    `${email} google`,
  );
  if (!cb.needsSetup) {
    const k = await db.staffMember.findUniqueOrThrow({ where: { email } });
    const sir = app.get(SecretBox).open(k.totpSecretEnc as string);
    // Aynı kod iki kez kullanılamaz: son kabul edilen adımdan sonrakini kullan
    const adim = Math.max(currentStep(), Number(k.totpLastStep ?? 0) + 1);
    if (adim > currentStep() + 1) return { token: '', sir };
    const v = olmali(
      await st('/staff/auth/2fa/verify', {
        ticket: cb.ticket,
        code: totpAt(sir, adim),
        deviceId: `demo-${uuidv7()}`,
      }),
      'doğrulama kodu',
    );
    return { token: v.sessionToken, sir };
  }
  const kur = olmali(await st('/staff/auth/2fa/setup', { ticket: cb.ticket }), 'doğrulama kurulumu');
  const v = olmali(
    await st('/staff/auth/2fa/verify', {
      ticket: cb.ticket,
      code: totpAt(kur.secret, currentStep()),
      deviceId: `demo-${uuidv7()}`,
    }),
    'doğrulama kodu',
  );
  return { token: v.sessionToken, sir: kur.secret };
}

// ── Fotoğraf: her araç için ayırt edilebilir 6 görsel (kopya fotoğraf denetimine takılmasın) ──
async function foto(etiket: string, renk: [number, number, number], i: number): Promise<Buffer> {
  const w = 1200;
  const h = 900;
  const blok = 6 + i;
  const ham = Buffer.alloc(blok * blok * 3);
  for (let p = 0; p < blok * blok; p++) {
    const k = ((p * 37 + i * 101 + etiket.length * 13) % 97) / 97;
    ham[p * 3] = Math.round(renk[0] * (0.5 + k / 2));
    ham[p * 3 + 1] = Math.round(renk[1] * (0.5 + ((k * 3) % 1) / 2));
    ham[p * 3 + 2] = Math.round(renk[2] * (0.5 + ((k * 7) % 1) / 2));
  }
  const yazi = Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="60" y="${h - 190}" width="${w - 120}" height="130" rx="18" fill="rgba(255,255,255,0.88)"/><text x="100" y="${h - 110}" font-family="Arial" font-size="54" font-weight="700" fill="#1E2333">${etiket}</text><text x="100" y="${h - 72}" font-family="Arial" font-size="30" fill="#5A6073">Demo fotoğraf ${i + 1} / 6</text></svg>`,
  );
  return sharp(ham, { raw: { width: blok, height: blok, channels: 3 } })
    .resize(w, h, { kernel: 'nearest' })
    .composite([{ input: yazi }])
    .jpeg({ quality: 82 })
    .toBuffer();
}

interface Arac {
  kategori: string;
  marka: string;
  seri: string;
  model: string;
  yil: number;
  km: number;
  yakit: string;
  vites: string;
  renk: string;
  fiyat: number;
  plaka: string;
  etiket: string;
  ton: [number, number, number];
}
async function aracEkle(g: { accountId: string; token: string }, a: Arac) {
  const base = `/gallery/${g.accountId}/portfolio`;
  const plaka = a.plaka.replace(/\s/g, '').toUpperCase();
  const var_ = await db.portfolioVehicle.findFirst({
    where: { accountId: g.accountId, plate: plaka, status: { not: 'DRAFT' } },
  });
  if (var_) return { id: var_.id, no: Number(var_.no) };
  // Yarıda kalmış kurulumun taslağı (araç kayıtları silinmez): aynı plakalı yayındaki aracın kopyası yeniden kullanılır
  const yetim = await db.portfolioVehicle.findFirst({
    where: { accountId: g.accountId, status: 'DRAFT', plate: { not: null } },
    include: { photos: { select: { id: true } } },
    orderBy: { no: 'desc' },
  });
  const yetimKopya =
    yetim &&
    (await db.portfolioVehicle.count({
      where: { accountId: g.accountId, plate: yetim.plate, status: { not: 'DRAFT' } },
    }));
  if (yetim && yetimKopya)
    for (const ph of yetim.photos)
      await istek('DELETE', `${base}/${yetim.id}/photos/${ph.id}`, undefined, g.token);
  const c = olmali(
    await istek(
      yetim && yetimKopya ? 'PUT' : 'POST',
      yetim && yetimKopya ? `${base}/${yetim.id}` : base,
      {
        kategori: a.kategori,
        marka: a.marka,
        seri: a.seri,
        model: a.model,
        yil: a.yil,
        km: a.km,
        yakit: a.yakit,
        vites: a.vites,
        renk: a.renk,
        fiyat: a.fiyat,
        plaka: a.plaka,
        sasiSon6: `D${String(a.fiyat).slice(0, 5)}`.slice(0, 6).toUpperCase(),
        ilkTescil: `${a.yil}-04-15`,
        fiyatBeyani: true,
        hasar: { parcalar: {}, tramer: 0 },
      },
      g.token,
    ),
    `araç ${a.etiket}`,
  );
  if (yetim && yetimKopya) c.id = yetim.id;
  for (let i = 0; i < 6; i++)
    olmali(
      await istek('POST', `${base}/${c.id}/photos`, await foto(a.etiket, a.ton, i), g.token, {
        'content-type': 'image/jpeg',
      }),
      `fotoğraf ${a.etiket}`,
    );
  const s = olmali(
    await istek('POST', `${base}/${c.id}/submit`, undefined, g.token),
    `yayına gönder ${a.etiket}`,
  );
  await app.get(PortfolioService).processEids(c.id);
  return { id: c.id as string, no: s.no as number };
}

interface Talep {
  kategori: string;
  marka: string;
  seri: string;
  model: string;
  il: string;
  ilce: string;
  butce: [number, number];
  yil: [number, number];
}
async function talepAc(k: Kisi, t: Talep) {
  const var_ = await db.demand.findFirst({
    where: { userId: k.userId, modelKey: t.model, status: { not: 'DRAFT' } },
  });
  if (var_?.no) return { id: var_.id, no: Number(var_.no) };
  const d = olmali(await istek('POST', '/demands', { kategori: t.kategori }, k.token), `${k.ad} talep`);
  const data = {
    alanlar: {
      model: { make: t.marka, series: t.seri, model: t.model },
      konum: { il: t.il, ilce: t.ilce },
    },
    alternatifler: [{ butce: { min: t.butce[0], max: t.butce[1] }, yil: { min: t.yil[0], max: t.yil[1] } }],
  };
  olmali(await istek('PATCH', `/demands/${d.id}`, { data, step: 6 }, k.token), `${k.ad} talep taslağı`);
  const p = olmali(await istek('POST', `/demands/${d.id}/publish`, {}, k.token), `${k.ad} talep yayını`);
  await app.get(DemandSearchService).sync(d.id, true);
  return { id: d.id as string, no: p.no as number };
}

/** 9 haneli önek + GİB sağlama hanesi */
const vkn = (onek: string) => {
  for (let i = 0; i < 10; i++) if (vknGecerli(`${onek}${i}`)) return `${onek}${i}`;
  throw new Error('vkn');
};
const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n');
async function galeriBasvur(
  k: Kisi,
  g: {
    ad: string;
    il: string;
    ilce: string;
    adres: string;
    yetkiNo: string;
    vergiNo: string;
    eposta: string;
  },
) {
  const onceki = await db.galleryApplication.findFirst({
    where: { userId: k.userId, status: { in: ['APPROVED', 'SUBMITTED', 'IN_REVIEW'] } },
  });
  if (onceki) return onceki.id;
  olmali(
    await istek(
      'PATCH',
      '/gallery-applications/me',
      {
        tur: 'DEALER',
        unvan: `${g.ad} Ltd. Şti.`,
        gorunenAd: g.ad,
        vergiNo: vkn(g.vergiNo.slice(0, 9)),
        vergiDairesi: g.ilce,
        mersis: '0123456789000015',
        il: g.il,
        ilce: g.ilce,
        adres: g.adres,
        yetkiNo: g.yetkiNo,
        sahip: { ad: k.ad, soyad: k.soyad, gorev: 'Kurucu', eposta: g.eposta },
      },
      k.token,
    ),
    `${g.ad} başvuru`,
  );
  for (const tur of ['vergi_levhasi', 'sicil_gazetesi', 'oda_kayit'])
    olmali(
      await istek('POST', `/gallery-applications/me/documents/${tur}`, PDF, k.token, {
        'content-type': 'application/pdf',
        'x-file-name': encodeURIComponent(`${tur}.pdf`),
      }),
      `${g.ad} belge`,
    );
  const s = olmali(
    await istek('POST', '/gallery-applications/me/submit', { sozlesme: true, ticariIleti: true }, k.token),
    `${g.ad} gönderim`,
  );
  await app.get(GalleryApplicationService).runChecks(s.id);
  return s.id as string;
}

// ── Kurulum ────────────────────────────────────────────────────
const IZ = '+905551000001';
const izU = await db.user.findUnique({ where: { phone: IZ } });
if (izU && (await db.savedSearch.count({ where: { name: 'İstanbul BMW' } }))) {
  console.log('Demo verisi zaten kurulu (+90 555 100 00 01 var); değişiklik yapılmadı.');
  await app.close();
  process.exit(0);
}

const cikti: string[] = [];
const yaz = (s: string) => {
  cikti.push(s);
  console.log(s);
};

// Çalışanlar
const sirlar: Record<string, string> = {};
const oturumlar: Record<string, string> = {};
for (const [email, ad, rol] of CALISANLAR) {
  const var_ = await db.staffMember.findUnique({ where: { email } });
  if (!var_)
    await db.staffMember.create({ data: { id: uuidv7(), email, name: ad, role: rol, status: 'ACTIVE' } });
  if (var_?.twoFactorEnabled && email !== 'yonetici@rengarenksite.com') {
    if (var_.totpSecretEnc) sirlar[email] = app.get(SecretBox).open(var_.totpSecretEnc);
    continue;
  }
  const g = await calisanGiris(email);
  if (g.sir) sirlar[email] = g.sir;
  if (g.token) oturumlar[email] = g.token;
}
const yonetici = oturumlar['yonetici@rengarenksite.com'];
const adminId = (await db.staffMember.findUniqueOrThrow({ where: { email: 'yonetici@rengarenksite.com' } }))
  .id;

// Bireysel kullanıcılar
const ayse = await giris('+905551000001', 'Ayşe', 'Yılmaz');
const mehmet = await giris('+905551000002', 'Mehmet', 'Kaya');
const zeynep = await giris('+905551000003', 'Zeynep', 'Demir');
const can = await giris('+905551000004', 'Can', 'Öztürk');
const burak = await giris('+905551000005', 'Burak', 'Çelik');
const selin = await giris('+905551000006', 'Selin', 'Aksoy');

// Galeriler: başvuru → kontroller → onay (ajan onaylamadıysa yönetici)
const ahmet = await giris('+905552000001', 'Ahmet', 'Şahin');
const huseyin = await giris('+905552000003', 'Hüseyin', 'Koç');
const serkan = await giris('+905552000004', 'Serkan', 'Aydın');
async function onayla(basvuruId: string) {
  const a = await db.galleryApplication.findUniqueOrThrow({ where: { id: basvuruId } });
  if (a.status !== 'APPROVED') {
    if (!yonetici) throw new Error('yönetici oturumu yok');
    olmali(
      await istek('POST', `/staff/gallery-applications/${basvuruId}/approve`, {}, yonetici),
      'başvuru onayı',
    );
  }
  return (await db.galleryApplication.findUniqueOrThrow({ where: { id: basvuruId } })).accountId as string;
}
const kadikoyId = await onayla(
  await galeriBasvur(ahmet, {
    ad: 'Kadıköy Premium Otomotiv',
    il: 'İstanbul',
    ilce: 'Kadıköy',
    adres: 'Caferağa Mah. Moda Cad. No: 12',
    yetkiNo: '34-2021-114',
    vergiNo: '4410012345',
    eposta: 'ahmet@kadikoypremium.com.tr',
  }),
);
const ankaraId = await onayla(
  await galeriBasvur(huseyin, {
    ad: 'Ankara Güven Oto',
    il: 'Ankara',
    ilce: 'Çankaya',
    adres: 'Kızılırmak Mah. Ufuk Üniversitesi Cad. No: 4',
    yetkiNo: '06-2019-482',
    vergiNo: '7720054321',
    eposta: 'huseyin@ankaraguvenoto.com.tr',
  }),
);
// İncelemede kalan başvuru: yetki belgesi uyarılı (sonu 9), konsolda Galeri başvuruları'nda karar bekler
await galeriBasvur(serkan, {
  ad: 'İzmir Körfez Otomotiv',
  il: 'İzmir',
  ilce: 'Karşıyaka',
  adres: 'Bostanlı Mah. Cemal Gürsel Cad. No: 88',
  yetkiNo: '35-2022-309',
  vergiNo: '5530098765',
  eposta: 'serkan@korfezotomotiv.com.tr',
});

// Kadıköy: Profesyonel paket (sahte ödeme sağlayıcısıyla, kart saklama ve otomatik yenileme)
const kadikoy = { accountId: kadikoyId, token: ahmet.token };
const ankara = { accountId: ankaraId, token: huseyin.token };
const kadikoyPlan = (await db.gallery.findUniqueOrThrow({ where: { accountId: kadikoyId } })).plan;
if (kadikoyPlan === 'deneme') {
  const odeme = olmali(
    await istek(
      'POST',
      `/gallery/${kadikoyId}/subscription/checkout`,
      {
        plan: 'profesyonel',
        donem: 'aylik',
        eposta: 'muhasebe@kadikoypremium.com.tr',
        onay: { sozlesme: true, yenileme: true },
      },
      ahmet.token,
    ),
    'paket ödemesi',
  );
  const siparisNo = String(odeme.odemeAdresi).split('/').pop();
  await istek('GET', `/odeme/kart/${siparisNo}`);
  const sahte = await app.inject({
    method: 'POST',
    url: `/odeme/sahte/${siparisNo}`,
    payload: new URLSearchParams({ durum: 'success' }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    remoteAddress: ip(),
  });
  if (sahte.statusCode !== 303) throw new Error(`sahte ödeme: ${sahte.statusCode} ${sahte.body}`);
}

// Kadıköy ekibi: satış temsilcisi Elif davetle katılır
const elifU = await db.user.findUnique({ where: { phone: '+905552000002' } });
const elifUye =
  elifU && (await db.accountMember.findFirst({ where: { userId: elifU.id, accountId: kadikoyId } }));
if (!elifUye)
  olmali(
    await istek(
      'POST',
      `/gallery/${kadikoyId}/invites`,
      { telefon: '0555 200 00 02', rol: 'SALES' },
      ahmet.token,
    ),
    'davet',
  );
const elif = await giris('+905552000002', 'Elif', 'Arslan');
if (!elifUye) {
  const [davet] = olmali(await istek('GET', '/me/invites', undefined, elif.token), 'davetler');
  olmali(await istek('POST', `/me/invites/${davet.id}/accept`, undefined, elif.token), 'davet kabulü');
}

// Portföyler
const A = (
  o: Partial<Arac> & Pick<Arac, 'marka' | 'seri' | 'model' | 'yil' | 'fiyat' | 'plaka' | 'etiket'>,
): Arac => ({
  kategori: 'otomobil',
  km: 45_000,
  yakit: 'benzin',
  vites: 'otomatik',
  renk: 'beyaz',
  ton: [91, 140, 255],
  ...o,
});
const kBmw = await aracEkle(
  kadikoy,
  A({
    marka: 'bmw',
    seri: 'bmw/3-serisi',
    model: 'bmw/3-serisi/320i',
    yil: 2021,
    km: 48_000,
    renk: 'siyah',
    fiyat: 2_290_000,
    plaka: '34 RNG 101',
    etiket: 'BMW 320i · 2021',
    ton: [70, 80, 110],
  }),
);
const kCorolla = await aracEkle(
  kadikoy,
  A({
    marka: 'toyota',
    seri: 'toyota/corolla',
    model: 'toyota/corolla/1.5',
    yil: 2022,
    km: 31_000,
    fiyat: 1_385_000,
    plaka: '34 RNG 102',
    etiket: 'Toyota Corolla 1.5 · 2022',
    ton: [220, 225, 235],
  }),
);
const kMercedes = await aracEkle(
  kadikoy,
  A({
    marka: 'mercedes-benz',
    seri: 'mercedes-benz/c-serisi',
    model: 'mercedes-benz/c-serisi/c-200',
    yil: 2020,
    km: 72_000,
    renk: 'gri',
    fiyat: 2_650_000,
    plaka: '34 RNG 103',
    etiket: 'Mercedes C 200 · 2020',
    ton: [150, 155, 165],
  }),
);
await aracEkle(
  kadikoy,
  A({
    marka: 'volkswagen',
    seri: 'volkswagen/passat',
    model: 'volkswagen/passat/1.5-tsi',
    yil: 2020,
    km: 66_000,
    renk: 'mavi',
    fiyat: 1_890_000,
    plaka: '34 RNG 104',
    etiket: 'VW Passat 1.5 TSI · 2020',
    ton: [60, 100, 170],
  }),
);
await aracEkle(
  kadikoy,
  A({
    marka: 'honda',
    seri: 'honda/civic',
    model: 'honda/civic/1.5',
    yil: 2021,
    km: 39_000,
    renk: 'kirmizi',
    fiyat: 1_545_000,
    plaka: '34 RNG 105',
    etiket: 'Honda Civic 1.5 · 2021',
    ton: [190, 50, 50],
  }),
);
await aracEkle(
  kadikoy,
  A({
    kategori: 'arazi-suv-pickup',
    marka: 'peugeot',
    seri: 'peugeot/3008',
    model: 'peugeot/3008/1.5-bluehdi',
    yil: 2021,
    km: 58_000,
    yakit: 'dizel',
    fiyat: 1_720_000,
    plaka: '34 RNG 106',
    etiket: 'Peugeot 3008 1.5 BlueHDi · 2021',
    ton: [110, 120, 90],
  }),
);
await aracEkle(
  kadikoy,
  A({
    marka: 'hyundai',
    seri: 'hyundai/i20',
    model: 'hyundai/i20/1.4',
    yil: 2021,
    km: 41_000,
    renk: 'gumus',
    fiyat: 895_000,
    plaka: '34 RNG 107',
    etiket: 'Hyundai i20 1.4 · 2021',
    ton: [180, 185, 195],
  }),
);
const aClio = await aracEkle(
  ankara,
  A({
    marka: 'renault',
    seri: 'renault/clio',
    model: 'renault/clio/1.0-tce',
    yil: 2022,
    km: 28_000,
    vites: 'manuel',
    fiyat: 1_050_000,
    plaka: '06 RNG 201',
    etiket: 'Renault Clio 1.0 TCe · 2022',
    ton: [240, 130, 40],
  }),
);
await aracEkle(
  ankara,
  A({
    marka: 'fiat',
    seri: 'fiat/egea',
    model: 'fiat/egea/1.4-fire',
    yil: 2021,
    km: 54_000,
    vites: 'manuel',
    fiyat: 845_000,
    plaka: '06 RNG 202',
    etiket: 'Fiat Egea 1.4 Fire · 2021',
    ton: [200, 200, 205],
  }),
);
await aracEkle(
  ankara,
  A({
    marka: 'ford',
    seri: 'ford/focus',
    model: 'ford/focus/1.5-tdci',
    yil: 2019,
    km: 96_000,
    yakit: 'dizel',
    fiyat: 1_020_000,
    plaka: '06 RNG 203',
    etiket: 'Ford Focus 1.5 TDCi · 2019',
    ton: [40, 60, 120],
  }),
);

// Talepler (ilk talep ücretsiz; Ayşe'ye ikinci talep için hak tanımlanır)
const ayseHesap = await db.accountMember.findFirstOrThrow({
  where: { userId: ayse.userId, account: { kind: 'INDIVIDUAL' } },
});
await app.get(EntitlementService).grant(ayseHesap.accountId, 'talep', 1, 'tanimlama', {
  sourceType: 'demo',
  sourceId: uuidv7(),
  createdBy: adminId,
});
const tBmw = await talepAc(ayse, {
  kategori: 'otomobil',
  marka: 'bmw',
  seri: 'bmw/3-serisi',
  model: 'bmw/3-serisi/320i',
  il: 'İstanbul',
  ilce: 'Kadıköy',
  butce: [2_000_000, 2_500_000],
  yil: [2019, 2023],
});
const tCorolla = await talepAc(ayse, {
  kategori: 'otomobil',
  marka: 'toyota',
  seri: 'toyota/corolla',
  model: 'toyota/corolla/1.5',
  il: 'İstanbul',
  ilce: 'Kadıköy',
  butce: [1_200_000, 1_500_000],
  yil: [2020, 2024],
});
const tClio = await talepAc(mehmet, {
  kategori: 'otomobil',
  marka: 'renault',
  seri: 'renault/clio',
  model: 'renault/clio/1.0-tce',
  il: 'Ankara',
  ilce: 'Çankaya',
  butce: [900_000, 1_200_000],
  yil: [2021, 2024],
});
const tPassat = await talepAc(zeynep, {
  kategori: 'otomobil',
  marka: 'volkswagen',
  seri: 'volkswagen/passat',
  model: 'volkswagen/passat/1.5-tsi',
  il: 'İzmir',
  ilce: 'Karşıyaka',
  butce: [1_600_000, 2_100_000],
  yil: [2019, 2023],
});
await talepAc(burak, {
  kategori: 'arazi-suv-pickup',
  marka: 'dacia',
  seri: 'dacia/duster',
  model: 'dacia/duster/1.3-tce',
  il: 'Bursa',
  ilce: 'Nilüfer',
  butce: [1_100_000, 1_400_000],
  yil: [2021, 2024],
}).catch((e) => yaz(`(uyarı) Burak'ın talebi açılamadı: ${(e as Error).message}`));
await talepAc(selin, {
  kategori: 'otomobil',
  marka: 'hyundai',
  seri: 'hyundai/i20',
  model: 'hyundai/i20/1.4',
  il: 'Antalya',
  ilce: 'Muratpaşa',
  butce: [750_000, 950_000],
  yil: [2020, 2023],
}).catch((e) => yaz(`(uyarı) Selin'in talebi açılamadı: ${(e as Error).message}`));

// Mesajlar: galeri araç kartıyla ilk mesaj, alıcı yanıtı, galeri yanıtı
const m1 = olmali(
  await istek(
    'POST',
    `/talepler/${tBmw.no}/mesaj`,
    {
      metin:
        'Merhaba Ayşe Hanım, aradığınız 320i bizde var: 2021, 48.000 km, boyasız, servis bakımlı. Showroomumuzda görebilirsiniz.',
      aracId: kBmw.id,
      hesap: kadikoyId,
    },
    ahmet.token,
  ),
  'Kadıköy ilk mesaj',
);
olmali(
  await istek(
    'POST',
    `/conversations/${m1.id}/messages`,
    { metin: 'Merhaba, cumartesi öğleden sonra gelebilirim. Ekspertiz raporu var mı?' },
    ayse.token,
  ),
  'Ayşe yanıt',
);
olmali(
  await istek(
    'POST',
    `/conversations/${m1.id}/messages`,
    { metin: 'Var, raporu araç sayfasına ekledik. Cumartesi 14.00 uygun mu?' },
    ahmet.token,
  ),
  'Kadıköy yanıt',
);
olmali(
  await istek(
    'POST',
    `/talepler/${tCorolla.no}/mesaj`,
    {
      metin: 'Corolla 1.5 2022, 31.000 km, tek sahibinden. Fiyatta görüşebiliriz.',
      aracId: kCorolla.id,
      hesap: kadikoyId,
    },
    elif.token,
  ),
  'Elif ilk mesaj',
);
olmali(
  await istek(
    'POST',
    `/talepler/${tCorolla.no}/mesaj`,
    { metin: 'Merhaba, 2021 model Corolla 1.5 Vision bende var, 52.000 km. Bireysel satıyorum.' },
    can.token,
  ),
  'Can ilk mesaj',
);
const m4 = olmali(
  await istek(
    'POST',
    `/talepler/${tClio.no}/mesaj`,
    {
      metin: 'Merhaba Mehmet Bey, 2022 Clio 1.0 TCe, 28.000 km. Takas da değerlendiririz.',
      aracId: aClio.id,
      hesap: ankaraId,
    },
    huseyin.token,
  ),
  'Ankara ilk mesaj',
);
olmali(
  await istek(
    'POST',
    `/conversations/${m4.id}/messages`,
    { metin: 'Merhaba, son fiyat nedir?' },
    mehmet.token,
  ),
  'Mehmet yanıt',
);
// Şüpheli ilk mesaj (kapora): Zeynep şikâyet eder, moderasyon kuyruğuna düşer
const m5 = olmali(
  await istek(
    'POST',
    `/talepler/${tPassat.no}/mesaj`,
    { metin: 'Passat bende, çok talep var. Kapora gönderirseniz aracı size ayırırım.' },
    can.token,
  ),
  'Can kapora mesajı',
);
const sohbet5 = olmali(await istek('GET', `/conversations/${m5.id}`, undefined, zeynep.token), 'sohbet');
olmali(
  await istek(
    'POST',
    '/reports',
    { hedef: 'mesaj', id: sohbet5.mesajlar[0].id, neden: 'kapora' },
    zeynep.token,
  ),
  'şikâyet',
);

// Favoriler, kayıtlı arama, destek talebi
olmali(await istek('PUT', `/favorites/${tBmw.no}`, undefined, mehmet.token), 'talep favorisi');
olmali(await istek('PUT', `/araclar/${kMercedes.no}/favori`, undefined, ayse.token), 'araç favorisi');
olmali(
  await istek(
    'POST',
    '/saved-searches',
    { ad: 'İstanbul BMW', sorgu: { il: 'İstanbul', marka: 'bmw' } },
    zeynep.token,
  ),
  'kayıtlı arama',
);
olmali(
  await istek(
    'POST',
    '/support/tickets',
    { konu: 'diger', metin: 'Talebimi yayınladım ama kaç kişinin gördüğünü nerede görebilirim?' },
    mehmet.token,
  ),
  'destek talebi',
);

yaz('\nDemo verisi kuruldu.');
yaz(`Talepler: BMW #${tBmw.no}, Corolla #${tCorolla.no}, Clio #${tClio.no}, Passat #${tPassat.no}`);
yaz(`Araçlar: BMW #${kBmw.no}, Corolla #${kCorolla.no}, Mercedes #${kMercedes.no}, Clio #${aClio.no}`);
if (Object.keys(sirlar).length) {
  yaz('\nKonsol çalışanlarının doğrulama uygulaması sırları (uygulamaya "anahtar gir" ile eklenir):');
  for (const [e, s] of Object.entries(sirlar)) yaz(`  ${e}  ${s}`);
}
await app.close();
process.exit(0);
