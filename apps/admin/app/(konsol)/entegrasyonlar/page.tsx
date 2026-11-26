'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { goreli, yonetim } from '../../../lib/istemci';
import stil from './page.module.css';

interface Source {
  key: string;
  name: string;
  active: boolean;
  autoFetch: boolean;
  lastSuccessAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
}

interface ReklamAgi {
  saglayici: string;
  acik: boolean;
  sonGonderim: string | null;
  sonHarcama: string | null;
  bekleyen: number;
  hata: string | null;
}
interface Durum {
  sms: { ana: string; yedek: string | null; dogrulamada: boolean };
  whatsapp: { bildirim: string; dogrulamada: boolean };
  reklam: { meta: ReklamAgi; google: ReklamAgi } | null;
  sources: Source[];
  bekleyen: { adEsleme: number; fotograf: number };
}

type Etiket = 'Sağlıklı' | 'Beklemede' | 'Uyarı';
const ED: Record<Etiket, [string, string]> = {
  Sağlıklı: ['#E7FAF0', '#11683F'],
  Beklemede: ['#EEF3FF', '#2450C8'],
  Uyarı: ['#FFF6DF', '#7A5300'],
};

interface Kart {
  ad: string;
  amac: string;
  durum: Etiket;
  son: string;
  anahtar: string;
  /** "Test et": kaynağın şimdi kontrolü */
  test?: string[];
  baglanti?: { href: string; ad: string }[];
}

const SMS_ADI: Record<string, string> = {
  iletimerkezi: 'İleti Merkezi',
  console: 'geliştirme (SMS gönderilmez)',
  test: 'test',
  none: 'kapalı',
};
const WA_ADI: Record<string, string> = {
  meta: 'Meta',
  console: 'geliştirme (gönderilmez)',
  test: 'test',
  none: 'kapalı',
};

/** Kaynak listesinden kartın durumu: hata varsa Uyarı, hiç başarılı değilse Beklemede */
function kaynakDurumu(list: Source[]): { durum: Etiket; son: string } {
  const etkin = list.filter((s) => s.active);
  if (!etkin.length) return { durum: 'Beklemede', son: '—' };
  const son = etkin
    .map((s) => s.lastSuccessAt)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1);
  if (etkin.some((s) => s.lastError)) return { durum: 'Uyarı', son: goreli(son) };
  return { durum: son ? 'Sağlıklı' : 'Beklemede', son: goreli(son) };
}

/**
 * Reklam ağı kartı (Karar 35): bağlı değilse Beklemede (olaylar kuyrukta bekler), son işten sonra hata varsa Uyarı.
 * Son: olay gönderimi ya da harcama çekiminin yenisi.
 */
function reklamKarti(ad: string, amac: string, a: ReklamAgi | undefined, harcama: boolean): Kart {
  if (!a?.acik)
    return bekleyen(
      ad,
      amac,
      a?.bekleyen ? `Hesap bekleniyor · ${a.bekleyen} olay kuyrukta` : 'Hesap bekleniyor',
    );
  const son =
    [a.sonGonderim, a.sonHarcama]
      .filter((x): x is string => Boolean(x))
      .sort()
      .at(-1) ?? null;
  return {
    ad,
    amac,
    durum: a.hata ? 'Uyarı' : son ? 'Sağlıklı' : 'Beklemede',
    son: goreli(son),
    anahtar: a.hata
      ? `Son hata: ${a.hata}`
      : `Sağlayıcı: ${a.saglayici} · ${a.bekleyen} olay bekliyor${harcama && !a.sonHarcama ? ' · harcama henüz çekilmedi' : ''}`,
  };
}

/** Henüz hesabı açılmamış dış hizmet (sahibin yürüttüğü işler, CLAUDE.md) */
const bekleyen = (ad: string, amac: string, anahtar = 'Hesap bekleniyor'): Kart => ({
  ad,
  amac,
  durum: 'Beklemede',
  son: '—',
  anahtar,
});

/**
 * Entegrasyonlar (tasarım: YonetimSistem › Entegrasyonlar): tasarımdaki 15 kart aynı sırayla. Bağlı olanlar gerçek
 * durumla gelir; katalog kartlarından ayrıntı, ad eşleme ve nesil fotoğrafı sayfalarına geçilir (sahip kararı,
 * 8 Kasım 2026). Gizli anahtarlar hiçbir zaman gösterilmez.
 */
export default function Entegrasyonlar() {
  const [d, setD] = useState<Durum | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    yonetim<Durum>('integrations')
      .then(setD)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const src = (keys: string[]) => (d?.sources ?? []).filter((s) => keys.includes(s.key));
  const kartlar: Kart[] = d
    ? [
        bekleyen('PayTR', 'Web ödemeleri ve abonelikler'),
        bekleyen('App Store ve Google Play', 'Mobil satın alma · RevenueCat üzerinden'),
        bekleyen('e-Arşiv fatura entegratörü', 'Fatura kesme'),
        {
          ad: 'WhatsApp (Meta Cloud API)',
          amac: 'Doğrulama kodu ve kritik bildirim (talebin son günü, ödeme sorunu)',
          durum: d.whatsapp.bildirim === 'meta' ? 'Sağlıklı' : 'Beklemede',
          son: '—',
          anahtar: `Bildirim: ${WA_ADI[d.whatsapp.bildirim] ?? d.whatsapp.bildirim} · doğrulama kodu ${d.whatsapp.dogrulamada ? 'açık' : 'kapalı'}`,
        },
        {
          ad: 'SMS · kapalı yedek',
          amac: 'Yalnızca doğrulama kodunun yedeği (şirket kurulunca açılabilir)',
          durum: d.sms.dogrulamada ? 'Sağlıklı' : 'Beklemede',
          son: '—',
          anahtar: `Sağlayıcı: ${SMS_ADI[d.sms.ana] ?? d.sms.ana}${d.sms.yedek ? ` · yedek ${SMS_ADI[d.sms.yedek] ?? d.sms.yedek}` : ''} · ${d.sms.dogrulamada ? 'açık' : 'kapalı'}`,
        },
        bekleyen('İYS', 'Ticari ileti onaylarının eşitlenmesi'),
        bekleyen('Firebase Cloud Messaging', 'Mobil ve web push'),
        bekleyen('Kendi e-posta sunucumuz', 'İşlemsel ve ticari e-posta', 'Sunucu kurulumu bekleniyor'),
        reklamKarti(
          'Meta (Pixel ve dönüşüm API’si)',
          'Reklam ölçümü · rızası olanlar',
          d.reklam?.meta,
          false,
        ),
        reklamKarti('Google Ads ve Analytics', 'Reklam ölçümü ve harcama çekme', d.reklam?.google, true),
        {
          ad: 'TSB kasko değer listesi',
          amac: 'Katalog · ana kaynak · aylık dosya',
          ...kaynakDurumu(src(['tsb'])),
          anahtar: 'Yazılı izin henüz istenmedi',
          test: ['tsb'],
          baglanti: [{ href: '/entegrasyonlar/katalog', ad: 'Katalog ayrıntıları' }],
        },
        {
          ad: 'Açık veri setleri',
          amac: 'VehiclesDB, AB Çevre Ajansı, Wikidata, vehicle-makes-models',
          ...kaynakDurumu(src(['vehiclesdb', 'wikidata', 'vmm', 'yerli'])),
          anahtar: 'Anahtar yok · atıf zorunlu',
          test: ['vehiclesdb', 'wikidata', 'vmm'],
          baglanti: [
            { href: '/entegrasyonlar/katalog', ad: 'Kaynaklar' },
            { href: '/entegrasyonlar/ad-esleme', ad: `Ad eşleme (${d.bekleyen.adEsleme} öneri)` },
          ],
        },
        bekleyen('motodb', 'Motosiklet kataloğu · haftalık', 'Anahtar yok · açık veri'),
        {
          ad: 'Wikimedia Commons',
          amac: 'Gerçek araç fotoğrafları · açık lisans, atıfla',
          ...kaynakDurumu(src(['commons'])),
          anahtar: 'Anahtar yok · açık API',
          test: ['commons'],
          baglanti: [
            {
              href: '/entegrasyonlar/fotograflar',
              ad: `Araç görselleri (${d.bekleyen.fotograf} seçim bekliyor)`,
            },
          ],
        },
        bekleyen(
          'AWS Bedrock (Amazon Nova)',
          'Ajan ve kullanıcı tarafı yapay zekâ özellikleri',
          'AWS erişimi bekleniyor',
        ),
      ]
    : [];

  async function test(k: Kart) {
    if (!k.test) return;
    setBusy(k.ad);
    setError(null);
    setNotice(null);
    const t0 = Date.now();
    try {
      for (const key of k.test) await yonetim(`catalog/sources/${key}/check`, { method: 'POST', body: {} });
      setNotice(`${k.ad} kontrol edildi · ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {notice ? (
        <p className={`k-ok ${stil.metin1}`} role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className={`k-error ${stil.metin1}`} role="alert">
          {error}
        </p>
      ) : null}
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Entegrasyonlar</h1>
        <p className={stil.metin2}>
          Gizli anahtarlar hiçbir zaman gösterilmez; yalnızca yenilenir. Yenileme işlem kaydına girer.
        </p>
      </div>
      {d === null && !error ? <div className="k-panel k-empty">Yükleniyor…</div> : null}
      <div className={stil.kutu2}>
        {kartlar.map((k) => {
          const [bg, fg] = ED[k.durum];
          const uyari = k.durum === 'Uyarı';
          return (
            <div
              key={k.ad}
              className={stil.kutu3}
              style={{ border: `1px solid ${uyari ? '#F4DC9A' : '#E3E6EF'}` }}
            >
              <div className={stil.kutu4}>
                <span className={stil.metin3}>
                  <span className={stil.metin4}>{k.ad}</span>
                  <span className={stil.metin5}>{k.amac}</span>
                </span>
                <span className={stil.metin6} style={{ background: bg, color: fg }}>
                  {k.durum}
                </span>
              </div>
              <div className={stil.kutu5}>Son başarılı: {k.son}</div>
              <div className={cx(stil.kutu6, uyari ? stil.kutu7 : stil.kutu8)}>{k.anahtar}</div>
              <div className={stil.kutu9}>
                <button
                  type="button"
                  className={cx(stil.dugme1, k.test ? stil.dugme2 : stil.dugme3)}
                  disabled={!k.test || busy !== null}
                  onClick={() => test(k)}
                >
                  {busy === k.ad ? 'Deneniyor…' : 'Test et'}
                </button>
                <button type="button" className={stil.dugme4} disabled>
                  Anahtarı yenile
                </button>
              </div>
              {k.baglanti ? (
                <div className={stil.kutu10}>
                  {k.baglanti.map((b) => (
                    <Link key={b.href + b.ad} href={b.href} className={stil.bag1}>
                      {b.ad} ›
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
