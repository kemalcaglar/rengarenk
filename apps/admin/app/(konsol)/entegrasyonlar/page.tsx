'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { goreli, yonetim } from '../../../lib/istemci';

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
  sms: { ana: string; yedek: string | null };
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
          ad: 'SMS · ana sağlayıcı',
          amac: 'Doğrulama kodu ve kritik bildirim',
          durum: d.sms.ana === 'iletimerkezi' ? 'Sağlıklı' : 'Beklemede',
          son: '—',
          anahtar: `Sağlayıcı: ${SMS_ADI[d.sms.ana] ?? d.sms.ana}`,
        },
        {
          ad: 'SMS · yedek sağlayıcı',
          amac: 'Ana sağlayıcı yanıt vermezse',
          durum: 'Beklemede',
          son: '—',
          anahtar: d.sms.yedek ? `Sağlayıcı: ${SMS_ADI[d.sms.yedek] ?? d.sms.yedek}` : 'Sağlayıcı seçilmedi',
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
              ad: `Nesil fotoğrafları (${d.bekleyen.fotograf} bekliyor)`,
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

  const btn = {
    border: '1px solid #D5DAE5',
    background: '#FFFFFF',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12.5,
    fontWeight: 700,
    color: '#1E2333',
    cursor: 'pointer',
  } as const;

  return (
    <>
      {notice ? (
        <p className="k-ok" role="status" style={{ margin: '0 0 14px' }}>
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="k-error" role="alert" style={{ margin: '0 0 14px' }}>
          {error}
        </p>
      ) : null}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Entegrasyonlar</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Gizli anahtarlar hiçbir zaman gösterilmez; yalnızca yenilenir. Yenileme işlem kaydına girer.
        </p>
      </div>
      {d === null && !error ? <div className="k-panel k-empty">Yükleniyor…</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {kartlar.map((k) => {
          const [bg, fg] = ED[k.durum];
          const uyari = k.durum === 'Uyarı';
          return (
            <div
              key={k.ad}
              style={{
                background: '#FFFFFF',
                border: `1px solid ${uyari ? '#F4DC9A' : '#E3E6EF'}`,
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{k.ad}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                    {k.amac}
                  </span>
                </span>
                <span
                  style={{
                    flex: 'none',
                    fontSize: 11.5,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: bg,
                    color: fg,
                  }}
                >
                  {k.durum}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#3A4052', marginTop: 8 }}>Son başarılı: {k.son}</div>
              <div
                style={{ fontSize: 12, color: uyari ? '#7A5300' : '#5A6073', marginTop: 2, fontWeight: 700 }}
              >
                {k.anahtar}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                <button
                  type="button"
                  style={{ ...btn, opacity: k.test ? 1 : 0.5, cursor: k.test ? 'pointer' : 'default' }}
                  disabled={!k.test || busy !== null}
                  onClick={() => test(k)}
                >
                  {busy === k.ad ? 'Deneniyor…' : 'Test et'}
                </button>
                <button type="button" style={{ ...btn, opacity: 0.5, cursor: 'default' }} disabled>
                  Anahtarı yenile
                </button>
              </div>
              {k.baglanti ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                  {k.baglanti.map((b) => (
                    <Link key={b.href + b.ad} href={b.href} style={{ fontSize: 12.5, fontWeight: 700 }}>
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
