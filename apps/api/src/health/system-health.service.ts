import { connect } from 'node:net';
import { ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import type { Redis } from 'ioredis';
import type { Actor } from '../approvals/approval.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { istekOzeti, redisHazir } from '../observability/request-stats.js';
import { REDIS } from '../redis/redis.module.js';

const DAY = 86_400_000;
const ZAMAN_ASIMI = 4000;

/** Yoklanan servisler (YonetimSistem.dc.html › Servisler; kuyruk RabbitMQ değil pg-boss) */
export const SERVISLER = [
  ['web', 'Web sitesi'],
  ['api', 'API'],
  ['veritabani', 'Veritabanı (PostgreSQL)'],
  ['arama', 'Arama (OpenSearch)'],
  ['kuyruk', 'Kuyruk (pg-boss)'],
  ['onbellek', 'Önbellek (Redis)'],
  ['depo', 'Dosya deposu (SeaweedFS)'],
  ['eposta', 'E-posta sunucusu'],
] as const;
type Servis = (typeof SERVISLER)[number][0];
type Sonuc = { ok: boolean; ms: number | null; not?: string };

const tarih = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(d);
const saat = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(d);
const boyut = (b: bigint | null) => {
  if (b === null) return '';
  const gb = Number(b) / 1024 ** 3;
  return gb >= 1
    ? `${gb.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} GB`
    : `${Math.round(Number(b) / 1024 ** 2)} MB`;
};

/**
 * Sistem sağlığı ve yedek (Karar 56; YonetimSistem.dc.html › saglik). İşçi dakikada bir servisleri yoklar
 * (`health_samples`); çalışma süresi API yoklamasından, hata oranı ve yanıt süresi API'nin dakikalık istek özetinden
 * (Redis), kuyruk pg-boss ve outbox'tan. Yedek kayıtlarını sunucudaki yedekleme betiği yazar (`backup_runs`); konsoldan
 * geri yükleme testi istenir, sunucu alıp ayrı ortamda yürütür (canlı sistemi etkilemez).
 */
@Injectable()
export class SystemHealthService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
  ) {}

  private async sure<T>(fn: () => Promise<T>): Promise<{ ms: number; v: T }> {
    const t = performance.now();
    const v = await Promise.race([
      fn(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), ZAMAN_ASIMI)),
    ]);
    return { ms: Math.round(performance.now() - t), v };
  }

  private async dene(fn: () => Promise<string | undefined>): Promise<Sonuc> {
    try {
      const r = await this.sure(fn);
      return { ok: true, ms: r.ms, ...(r.v ? { not: r.v } : {}) };
    } catch (e) {
      return { ok: false, ms: null, not: (e as Error).message.slice(0, 120) };
    }
  }

  private async http(url: string, kabul = (s: number) => s < 500) {
    const r = await fetch(url, { signal: AbortSignal.timeout(ZAMAN_ASIMI) });
    if (!kabul(r.status)) throw new Error(`HTTP ${r.status}`);
    return r;
  }

  private tcp(host: string, port: number) {
    return new Promise<undefined>((ok, red) => {
      const s = connect({ host, port, timeout: ZAMAN_ASIMI }, () => {
        s.end();
        ok(undefined);
      });
      s.on('error', red);
      s.on('timeout', () => {
        s.destroy();
        red(new Error('zaman aşımı'));
      });
    });
  }

  /** Bekleyen kuyruk işleri (pg-boss) ve aktarılmamış olaylar (outbox) */
  async kuyruk() {
    // pg-boss şemasını işçi kurar; yoksa kuyruk hiç çalışmamıştır
    const isler = await this.db.$queryRaw<{ name: string; n: number }[]>`
      SELECT name, count(*)::int AS n FROM pgboss.job WHERE state IN ('created', 'retry') GROUP BY name ORDER BY n DESC`.catch(
      (e: Error) => {
        throw new Error(
          /42P01/.test(e.message) ? 'pg-boss kurulmamış (işçi hiç çalışmadı)' : 'kuyruk okunamadı',
        );
      },
    );
    const outbox = await this.db.outboxEvent.count({ where: { publishedAt: null } });
    return { toplam: isler.reduce((a, x) => a + x.n, 0) + outbox, enCok: isler[0] ?? null, outbox };
  }

  /** Dakikalık yoklama (işçi): sonuç kaydedilir; 35 günden eski kayıtlar silinir */
  async yokla(now = new Date()) {
    const sonuc: Record<Servis, Sonuc> = {
      web: await this.dene(async () => void (await this.http(this.env.WEB_ORIGIN))),
      api: await this.dene(
        async () => void (await this.http(`${this.env.API_PUBLIC_URL}/health`, (s) => s === 200)),
      ),
      veritabani: await this.dene(async () => void (await this.db.$queryRaw`SELECT 1`)),
      arama: await this.dene(async () => {
        const r = await this.http(`${this.env.OPENSEARCH_URL}/_cluster/health`, (s) => s === 200);
        const h = (await r.json()) as { status?: string };
        if (h.status === 'red') throw new Error('küme durumu kırmızı');
        return h.status === 'yellow' ? 'küme sarı (eş eksik)' : undefined;
      }),
      kuyruk: await this.dene(async () => {
        const k = await this.kuyruk();
        return `${k.toplam} iş bekliyor`;
      }),
      onbellek: await this.dene(async () => {
        if (!this.redis) throw new Error('Redis bağlı değil');
        await redisHazir(this.redis);
        await this.redis.ping();
        return undefined;
      }),
      depo: await this.dene(async () => void (await this.http(this.env.S3_ENDPOINT))),
      eposta: await this.dene(() => this.tcp(this.env.SMTP_HOST, this.env.SMTP_PORT)),
    };
    const dakika = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    await this.db.healthSample.upsert({
      where: { at: dakika },
      create: { at: dakika, results: sonuc as unknown as Prisma.InputJsonValue },
      update: { results: sonuc as unknown as Prisma.InputJsonValue },
    });
    await this.db.healthSample.deleteMany({ where: { at: { lt: new Date(now.getTime() - 35 * DAY) } } });
    return sonuc;
  }

  /** Konsol: ölçüler, servisler ve yedek */
  async overview(now = new Date()) {
    const ornekler = await this.db.healthSample.findMany({
      where: { at: { gte: new Date(now.getTime() - 30 * DAY) } },
      orderBy: { at: 'asc' },
    });
    const sonuclar = ornekler.map((o) => ({ at: o.at, r: o.results as unknown as Record<Servis, Sonuc> }));
    const kesik = sonuclar.filter((o) => o.r.api && !o.r.api.ok);
    const calisma = sonuclar.length ? 1 - kesik.length / sonuclar.length : null;
    const istek = this.redis
      ? await istekOzeti(this.redis, now)
      : { istek: 0, hata: 0, oran: null, p95: null };
    const k = await this.kuyruk().catch(() => null);
    const son = sonuclar.at(-1);
    const eski = !son || now.getTime() - son.at.getTime() > 5 * 60_000;
    const yuzde = (x: number, basamak: number) =>
      `%${(x * 100).toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak })}`;

    const olcu = [
      {
        ad: 'Çalışma süresi',
        deger: calisma === null ? '—' : yuzde(calisma, 2),
        not: !sonuclar.length
          ? 'Henüz yoklama yok'
          : kesik.length
            ? `${kesik.length} dk kesinti · ${tarih(kesik.at(-1)?.at as Date)}`
            : `Kesinti yok · ${sonuclar.length.toLocaleString('tr-TR')} yoklama`,
      },
      {
        ad: 'Hata oranı',
        deger: istek.oran === null ? '—' : yuzde(istek.oran, 2),
        not: istek.istek
          ? `Son 24 saat · ${istek.istek.toLocaleString('tr-TR')} istek`
          : 'Son 24 saatte istek yok',
      },
      {
        ad: 'Yanıt süresi (p95)',
        deger: istek.p95 === null ? '—' : `${istek.p95} ms`,
        not: 'API · son 24 saat',
      },
      {
        ad: 'Kuyruk',
        deger: k ? k.toplam.toLocaleString('tr-TR') : '—',
        not: !k
          ? 'Kuyruk okunamadı'
          : k.enCok
            ? `En çok: ${k.enCok.name} (${k.enCok.n})`
            : k.outbox
              ? `${k.outbox} olay aktarılmayı bekliyor`
              : 'Bekleyen iş yok',
      },
    ];

    const servisler = SERVISLER.map(([key, ad]) => {
      const r = son?.r[key];
      const durum: 'iyi' | 'uyari' | 'kotu' | 'yok' =
        eski || !r ? 'yok' : !r.ok ? 'kotu' : r.not && key !== 'kuyruk' ? 'uyari' : 'iyi';
      return {
        key,
        ad,
        durum,
        not: eski
          ? 'Yoklama yok (işçi çalışmıyor olabilir)'
          : !r
            ? 'Yoklanmadı'
            : r.ok
              ? `Sağlıklı${r.ms !== null ? ` · ${r.ms} ms` : ''}${r.not ? ` · ${r.not}` : ''}`
              : `Yanıt yok · ${r.not ?? ''}`,
      };
    });

    const yedekler = await this.db.backupRun.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    const sonu = (kind: string, durum = 'basarili') =>
      yedekler.find((y) => y.kind === kind && y.status === durum);
    const tam = sonu('tam');
    const artimli = sonu('artimli');
    const test = yedekler.find((y) => y.kind === 'geri_yukleme_testi');
    const testBekliyor = test && (test.status === 'istendi' || test.status === 'calisiyor');
    const sonTest = sonu('geri_yukleme_testi') ?? (test?.status === 'hata' ? test : undefined);
    const dk = (a: Date | null, b: Date | null) =>
      a && b ? `${Math.max(1, Math.round((b.getTime() - a.getTime()) / 60_000))} dk` : '';
    const bekle = 'Sunucu kurulunca başlar (pgBackRest)';
    return {
      yer: 'AWS · Frankfurt · son 30 gün',
      olcu,
      servisler,
      yedekler: [
        {
          ad: 'Son tam yedek',
          deger: tam
            ? `${tarih(tam.finishedAt ?? tam.createdAt)} ${saat(tam.finishedAt ?? tam.createdAt)} · ${boyut(tam.sizeBytes)}`
            : bekle,
        },
        {
          ad: 'Sürekli artımlı yedek',
          deger: artimli
            ? `${Math.max(1, Math.round((now.getTime() - (artimli.finishedAt ?? artimli.createdAt).getTime()) / 60_000))} dk önce`
            : bekle,
        },
        {
          ad: 'Yedeklerin yeri',
          deger: tam?.location ?? 'Lightsail depolama · ayrı AB bölgesi (Karar 37, 56)',
        },
        { ad: 'Saklama', deger: 'Günlük 30 gün · aylık 12 ay' },
        {
          ad: 'Son geri yükleme testi',
          deger: testBekliyor
            ? test.status === 'calisiyor'
              ? 'Şimdi çalışıyor…'
              : `İstendi · ${tarih(test.createdAt)} ${saat(test.createdAt)} · sunucu alınca başlar`
            : sonTest
              ? `${tarih(sonTest.finishedAt ?? sonTest.createdAt)} · ${sonTest.status === 'basarili' ? 'başarılı' : 'hata'}${
                  sonTest.startedAt ? ` · ${dk(sonTest.startedAt, sonTest.finishedAt)}` : ''
                }`
              : 'Henüz test yok',
        },
      ],
      testBekliyor: Boolean(testBekliyor),
    };
  }

  /** "Geri yükleme testini şimdi başlat": istek kaydı; sunucudaki betik alır ve ayrı ortamda yürütür */
  async testIste(actor: Actor, ip?: string) {
    return this.db.$transaction(async (tx) => {
      const acik = await tx.backupRun.findFirst({
        where: { kind: 'geri_yukleme_testi', status: { in: ['istendi', 'calisiyor'] } },
      });
      if (acik) throw new ConflictException('Bir geri yükleme testi zaten bekliyor ya da çalışıyor');
      const id = uuidv7();
      await tx.backupRun.create({
        data: { id, kind: 'geri_yukleme_testi', status: 'istendi', requestedBy: actor.staff.id },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'geri_yukleme_testi_istendi',
          entityType: 'backup_run',
          entityId: id,
          ip,
        },
        tx,
      );
      return { id };
    });
  }
}
