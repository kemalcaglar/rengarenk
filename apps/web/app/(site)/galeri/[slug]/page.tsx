import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Profil {
  slug: string;
  ad: string;
  isletmeAdi: string;
  yetkiNo: string | null;
  tur: string;
  alan: string;
  il: string;
  ilce: string;
  adres: string;
  hakkinda: string | null;
  calismaSaatleri: string | null;
  uyelik: string;
  satisTemsilcisi: number;
  portfoy: { toplam: number; araclar: unknown[] };
}

async function profil(slug: string): Promise<Profil | null> {
  try {
    const r = await fetch(`${API}/galeriler/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    return r.ok ? ((await r.json()) as Profil) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await profil((await params).slug);
  return { title: p ? `${p.ad} · Rengarenk` : 'Galeri · Rengarenk' };
}

/** Yıla gelen "-den/-dan/-ten/-tan" eki okunuşa göre: 2026’dan, 2027’den, 2030’dan */
function yilEki(yil: number) {
  const birler = ['', 'den', 'den', 'ten', 'ten', 'ten', 'dan', 'den', 'den', 'dan'];
  const onlar = ['den', 'dan', 'den', 'dan', 'tan', 'den', 'tan', 'ten', 'den', 'dan'];
  return yil % 10 ? birler[yil % 10] : onlar[Math.floor(yil / 10) % 10];
}

const basHarf = (ad: string) =>
  ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toLocaleUpperCase('tr-TR'))
    .join('');

/**
 * Galeri profili (tasarım: GaleriProfil.dc.html; Karar 07, 17). İşletme adı ve yetki belgesi numarası profilde
 * görünür (yönetmelik m.21). Portföy Sprint 10'da, takip (Karar 28) ve rozetler (Karar 55) kendi modülleriyle gelir.
 */
export default async function GaleriProfili({ params }: { params: Promise<{ slug: string }> }) {
  const p = await profil((await params).slug);
  if (!p) notFound();
  const uyelik = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    month: 'long',
    year: 'numeric',
  }).format(new Date(p.uyelik));
  const istatistik: [string, string][] = [
    [String(p.portfoy.toplam), 'yayında araç'],
    ['—', 'ortalama yanıt süresi'],
    [String(p.satisTemsilcisi), 'satış temsilcisi'],
    [p.alan, p.yetkiNo ? 'yetki belgesi türü' : 'faaliyet alanı'],
  ];
  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '24px 24px 64px' }}>
      <section
        aria-labelledby="gad"
        style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 22, overflow: 'hidden' }}
      >
        <div
          aria-hidden="true"
          style={{
            height: 120,
            background: 'linear-gradient(100deg, #EEF3FF 0%, #FFEEF6 38%, #FFF6DF 70%, #E7FAF0 100%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: '16px 24px',
            padding: '0 24px 22px',
            marginTop: -44,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              flex: 'none',
              width: 96,
              height: 96,
              borderRadius: 24,
              background: '#FFF6DF',
              border: '4px solid #FFFFFF',
              color: '#7A5300',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            {basHarf(p.ad)}
          </span>
          <div style={{ flex: '999 1 360px', minWidth: 0, paddingTop: 58 }}>
            <h1 id="gad" style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>
              {p.ad}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: '#E7FAF0',
                  color: '#11683F',
                }}
              >
                ✓ Onaylı {p.tur.toLocaleLowerCase('tr-TR')}
              </span>
              {p.yetkiNo ? (
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: '#EEF3FF',
                    color: '#2450C8',
                  }}
                >
                  Yetki belgesi doğrulandı
                </span>
              ) : null}
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: '#F3F5FA',
                  color: '#3A4052',
                }}
              >
                {uyelik}’{yilEki(new Date(p.uyelik).getFullYear())} beri Rengarenk’te
              </span>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 14, color: '#3A4052' }}>
              {[`${p.il}, ${p.ilce}`, p.adres, p.calismaSaatleri].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div
            style={{
              flex: '1 1 260px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'flex-end',
              paddingTop: 58,
            }}
          >
            <button
              type="button"
              disabled
              title="Galeri takibi yakında açılacak"
              style={{
                border: 0,
                background: '#E3E6EF',
                borderRadius: 12,
                padding: '11px 16px',
                fontSize: 14.5,
                fontWeight: 800,
                color: '#5A6073',
                cursor: 'default',
                fontFamily: 'inherit',
              }}
            >
              Takip et
            </button>
          </div>
        </div>
        <div className="rr-dort-sutun" style={{ gap: 0, borderTop: '1px solid #EEF0F5' }}>
          {istatistik.map(([d, k], i) => (
            <div key={k} style={{ padding: '14px 24px', borderRight: i < 3 ? '1px solid #EEF0F5' : 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{d}</div>
              <div style={{ fontSize: 13, color: '#5A6073' }}>{k}</div>
            </div>
          ))}
        </div>
      </section>

      <div
        style={{
          margin: '22px 0 14px',
          background: '#FFFFFF',
          border: '1px dashed #C9CFDB',
          borderRadius: 18,
          padding: '36px 20px',
          textAlign: 'center',
          fontSize: 15,
          color: '#5A6073',
        }}
      >
        Bu galerinin henüz yayında aracı yok.
      </div>

      <section
        aria-labelledby="hk"
        style={{
          marginTop: 24,
          background: '#FFFFFF',
          border: '1px solid #E3E6EF',
          borderRadius: 18,
          padding: 22,
        }}
      >
        <h2 id="hk" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800 }}>
          Hakkında
        </h2>
        {p.hakkinda ? (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: '#2E3344', whiteSpace: 'pre-line' }}>
            {p.hakkinda}
          </p>
        ) : null}
        <p style={{ margin: p.hakkinda ? '14px 0 0' : 0, fontSize: 12.5, color: '#5A6073' }}>
          Ticari unvan: {p.isletmeAdi}
          {p.yetkiNo ? ` · Yetki belgesi no ${p.yetkiNo}` : ''} · Yetki belgesi ve vergi bilgileri Rengarenk
          tarafından doğrulanmıştır.
        </p>
      </section>
    </div>
  );
}
