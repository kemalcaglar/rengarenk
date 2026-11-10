import { compactBudget, ONE_CIKARMA, tints } from '@rengarenk/shared';
import Link from 'next/link';
import { colors } from '../../lib/renk';

/** Görseller tarayıcıdan istenir: genel API adresi */
const GORSEL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const VITRIN_FIYAT = ONE_CIKARMA.find((o) => o.key === 'vitrin')?.tl ?? 299;
/** Vitrinin son satırını tamamlayan boş hücrelerin anahtarları */
const BOS = ['bos1', 'bos2', 'bos3', 'bos4', 'bos5'];
const FOTO_YOK = [
  'linear-gradient(135deg, #C9D3E6, #EEF1F7)',
  'linear-gradient(135deg, #D7CFE6, #F1EEF7)',
  'linear-gradient(135deg, #CFE0D8, #EEF5F1)',
  'linear-gradient(135deg, #E6DCC9, #F7F3EE)',
];

export interface VitrinKart {
  no: number;
  baslik: string;
  butceMin: number | null;
  butceMax: number | null;
  il: string | null;
  ilce: string | null;
  yayin: string;
  foto: string | null;
}
export interface TalepYaniti {
  toplam: number;
  sonuclar: VitrinKart[];
}

/**
 * Ana sayfa vitrini (Anasayfa.dc.html; Karar 22): sunucuda çizilir; sunucu talepleri alamazsa aynı bileşen tarayıcıda
 * (`ana-yedek.tsx`) çizilir. Talep yoksa bölüm görünmez.
 */
export function VitrinBolumu({ vitrin }: { vitrin: TalepYaniti }) {
  if (!vitrin.sonuclar.length) return null;
  return (
    <section aria-labelledby="vitrin">
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <h2 id="vitrin" style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
          Ana sayfa vitrini
        </h2>
        <Link
          href="/talepler"
          style={{ fontSize: 13.5, fontWeight: 700, color: colors.link, textDecoration: 'none' }}
        >
          Tüm talepler ({vitrin.toplam})
        </Link>
      </div>
      <div className="rr-vitrin">
        {vitrin.sonuclar.map((v, i) => (
          <Link
            key={v.no}
            href={`/talep/${v.no}`}
            style={{
              display: 'block',
              background: '#FFFFFF',
              padding: '8px 8px 10px',
              color: colors.ink,
              textDecoration: 'none',
              minWidth: 0,
            }}
          >
            <span
              style={{
                display: 'block',
                position: 'relative',
                aspectRatio: '4 / 3',
                borderRadius: 8,
                overflow: 'hidden',
                background: FOTO_YOK[i % FOTO_YOK.length],
              }}
            >
              {v.foto ? (
                // biome-ignore lint/performance/noImgElement: katalog görseli API'den akar; Next görüntü iyileştirmesi gerekmez
                <img
                  src={`${GORSEL}${v.foto}`}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : null}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 700,
                lineHeight: 1.3,
                marginTop: 6,
                height: 33,
                overflow: 'hidden',
              }}
            >
              {v.baslik}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 800,
                color: colors.link,
                marginTop: 3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {compactBudget(v.butceMin, v.butceMax) || ' '}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 11.5,
                color: colors.muted,
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {v.il ?? 'Tüm Türkiye'}
            </span>
          </Link>
        ))}
        <Link
          href="/taleplerim"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 5,
            background: tints.yellow,
            padding: 12,
            color: colors.ink,
            textDecoration: 'none',
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.3 }}>Talebin burada görünsün</span>
          <span style={{ fontSize: 12, color: '#5A3D00', lineHeight: 1.4 }}>
            7 gün ana sayfa vitrini, web ve uygulamada
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: '#7A5300', marginTop: 2 }}>
            {VITRIN_FIYAT} TL ›
          </span>
        </Link>
        {/* Az talep varken satırın kalanı boş beyaz hücre; dar ekranda (3 sütun) fazlası gizlenir */}
        {BOS.slice(0, (6 - ((vitrin.sonuclar.length + 1) % 6)) % 6).map((k, i) => (
          <span
            key={k}
            aria-hidden="true"
            className={i < (3 - ((vitrin.sonuclar.length + 1) % 3)) % 3 ? undefined : 'rr-genis'}
            style={{ background: '#FFFFFF' }}
          />
        ))}
      </div>
      <p style={{ margin: '6px 2px 0', fontSize: 11.5, color: colors.muted }}>
        Fotoğraflar temsilîdir · Wikimedia Commons ve galeri portföyleri · sıra her açılışta karışır
      </p>
    </section>
  );
}
