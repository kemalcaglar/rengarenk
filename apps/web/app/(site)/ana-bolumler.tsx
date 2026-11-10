import { DOTS, HELP_TOPICS, tints } from '@rengarenk/shared';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { colors } from '../../lib/renk';
import { butceAraligi, zaman } from '../../lib/talep-bicim';

/**
 * Ana sayfanın sunucuda da istemcide de çizilen bölümleri (Karar 46; YonetimIcerik.dc.html › anasayfa). Görünürlük ve
 * sıra konsoldaki "Ana sayfa düzeni"nden gelir.
 */

export const kart: CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.line}`,
  borderRadius: 'var(--rr-kart-kose)',
};

export function Baslik({ id, children, sag }: { id: string; children: ReactNode; sag?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}
    >
      <h2 id={id} style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
        {children}
      </h2>
      {sag}
    </div>
  );
}

export interface SonKart {
  no: number;
  baslik: string;
  butceMin: number | null;
  butceMax: number | null;
  il: string | null;
  ilce: string | null;
  yayin: string;
}

/** Son talepler listesi (ziyaretçi ve üye: tüm Türkiye; galeri: galerinin ili) */
export function SonTalepler({ liste, baslik, tumu }: { liste: SonKart[]; baslik: string; tumu: string }) {
  if (!liste.length) return null;
  return (
    <section aria-labelledby="son">
      <Baslik
        id="son"
        sag={
          <Link href={tumu} style={{ fontSize: 14, fontWeight: 700 }}>
            Tüm talepler
          </Link>
        }
      >
        {baslik}
      </Baslik>
      <div style={{ ...kart, borderRadius: 16, overflow: 'hidden' }}>
        {liste.map((t, i) => (
          <Link
            key={t.no}
            href={`/talep/${t.no}`}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 18px',
              padding: '14px 18px',
              borderBottom: i < liste.length - 1 ? '1px solid #EEF0F5' : 0,
              color: colors.ink,
              textDecoration: 'none',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: DOTS[i % DOTS.length],
                flex: 'none',
              }}
            />
            <span style={{ flex: '999 1 300px', minWidth: 0, fontSize: 15, fontWeight: 700 }}>
              {t.baslik}
            </span>
            <span style={{ flex: '1 1 140px', fontSize: 13.5, color: colors.muted }}>
              {[t.il, t.ilce].filter(Boolean).join(', ') || 'Tüm Türkiye'}
            </span>
            <span style={{ flex: '1 1 180px', fontSize: 14, fontWeight: 800, color: colors.link }}>
              {butceAraligi(t.butceMin, t.butceMax)}
            </span>
            <span style={{ flex: '0 0 80px', fontSize: 13, color: colors.muted, textAlign: 'right' }}>
              {zaman(t.yayin)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const ADIMLAR = [
  {
    no: 1,
    baslik: 'Talebini yaz',
    metin: 'Marka, model, bütçe ve konumunu seç. 3 dakika sürer.',
    tint: tints.blue,
  },
  {
    no: 2,
    baslik: 'Satıcılar sana yazsın',
    metin: 'Uygun aracı olan galeriler ve satıcılar ilk mesajı gönderir.',
    tint: tints.pink,
  },
  {
    no: 3,
    baslik: 'Sen seç',
    metin: 'Numaran sen izin verene kadar gizli kalır. Aracı görmeden ödeme yapma.',
    tint: tints.green,
  },
];

export function NasilCalisir() {
  return (
    <section aria-labelledby="nasil" style={{ ...kart, padding: 22 }}>
      <h2 id="nasil" style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 800 }}>
        Nasıl çalışır?
      </h2>
      <ol className="rr-uc-sutun" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {ADIMLAR.map((a) => (
          <li key={a.no} style={{ background: a.tint, borderRadius: 'var(--rr-buton-kose)', padding: 16 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: colors.muted }}>
              {a.no}
            </span>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 800, marginTop: 4 }}>{a.baslik}</span>
            <span
              style={{
                display: 'block',
                fontSize: 14,
                color: colors.inkSoft,
                marginTop: 4,
                lineHeight: 1.45,
              }}
            >
              {a.metin}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const ROZETLER = [
  'Galeriler yetki belgesiyle doğrulanır',
  'Numaran sen izin verene kadar gizli',
  'Mesajlar güvenlik kurallarıyla denetlenir',
  'Kişisel verin Türkiye’de saklanır',
];

export function GuvenRozetleri() {
  return (
    <section aria-label="Güven" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {ROZETLER.map((r) => (
        <span
          key={r}
          style={{
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 'var(--rr-etiket-kose)',
            padding: '8px 14px',
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          ✓ {r}
        </span>
      ))}
    </section>
  );
}

/** Yardım merkezinin ilk altı konusunun ilk sorusu */
const SORULAR = HELP_TOPICS.slice(0, 6).map((t) => t.sorular[0] as readonly [string, string]);

export function SikSorulanlar() {
  return (
    <section aria-labelledby="sss" style={{ ...kart, padding: 22 }}>
      <Baslik
        id="sss"
        sag={
          <Link href="/yardim" style={{ fontSize: 14, fontWeight: 700 }}>
            Yardım merkezi
          </Link>
        }
      >
        Sık sorulanlar
      </Baslik>
      {SORULAR.map(([soru, cevap]) => (
        <details key={soru} style={{ borderTop: '1px solid #EEF0F5', padding: '12px 0' }}>
          <summary style={{ cursor: 'pointer', fontSize: 15, fontWeight: 800 }}>{soru}</summary>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: colors.inkSoft, lineHeight: 1.55 }}>{cevap}</p>
        </details>
      ))}
    </section>
  );
}

export function GaleriCagri() {
  return (
    <section
      aria-label="Galeriler için"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px 16px',
        background: '#F3EFFF',
        border: '1px solid var(--rr-cizgi, #E3E6EF)',
        borderLeft: '6px solid #9B7BFF',
        borderRadius: 16,
        padding: '16px 20px',
      }}
    >
      <span style={{ flex: '1 1 300px', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 800 }}>
          Galeri misin? Alıcılar seni bekliyor
        </span>
        <span style={{ display: 'block', fontSize: 14, color: colors.inkSoft, marginTop: 3 }}>
          İlan vermeden, aradığı aracı yazan alıcılara ulaş. İlk 30 gün ücretsiz.
        </span>
      </span>
      <Link
        href="/kurumsal-basvuru"
        style={{
          flex: 'none',
          background: colors.ink,
          color: '#FFFFFF',
          borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
          padding: '11px 18px',
          fontSize: 14.5,
          fontWeight: 800,
          textDecoration: 'none',
        }}
      >
        Galeri başvurusu
      </Link>
    </section>
  );
}
