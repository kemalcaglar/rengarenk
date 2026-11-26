import { compactBudget, ONE_CIKARMA } from '@rengarenk/shared';
import Link from 'next/link';
import { AracKapak } from '../../components/arac-kapak';
import { cx } from '../../lib/cx';
import stil from './vitrin.module.css';

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
  markaAd?: string | null;
  seriAd?: string | null;
  modelAd?: string | null;
  kapakBilgi?: string[];
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
  // Son satırı tamamlamak için gereken boş hücre (kartlar + "Talebin burada görünsün" hücresi)
  const eksik = (sutun: number) => (sutun - ((vitrin.sonuclar.length + 1) % sutun)) % sutun;
  return (
    <section aria-labelledby="vitrin">
      <div className={stil.kutu1}>
        <h2 id="vitrin" className={stil.baslik1}>
          Ana sayfa vitrini
        </h2>
        <Link href="/talepler" className={stil.bag1}>
          Tüm talepler ({vitrin.toplam})
        </Link>
      </div>
      <div className="rr-vitrin">
        {vitrin.sonuclar.map((v, i) => (
          <Link key={v.no} href={`/talep/${v.no}`} className={stil.bag2}>
            <span className={stil.metin1} style={{ background: FOTO_YOK[i % FOTO_YOK.length] }}>
              {v.foto ? (
                // biome-ignore lint/performance/noImgElement: katalog görseli API'den akar; Next görüntü iyileştirmesi gerekmez
                <img src={`${GORSEL}${v.foto}`} alt="" loading="lazy" className={stil.gorsel1} />
              ) : (
                <AracKapak
                  marka={v.markaAd}
                  seri={[v.seriAd, v.modelAd].filter(Boolean).join(' ') || v.baslik}
                  bilgi={v.kapakBilgi}
                />
              )}
            </span>
            <span className={stil.metin2}>{v.baslik}</span>
            <span className={stil.metin3}>{compactBudget(v.butceMin, v.butceMax) || ' '}</span>
            <span className={stil.metin4}>{v.il ?? 'Tüm Türkiye'}</span>
          </Link>
        ))}
        <Link href="/taleplerim" className={stil.bag3}>
          <span className={stil.metin5}>Talebin burada görünsün</span>
          <span className={stil.metin6}>7 gün ana sayfa vitrini, web ve uygulamada</span>
          <span className={stil.metin7}>{VITRIN_FIYAT} TL ›</span>
        </Link>
        {/* Az talep varken satırın kalanı boş beyaz hücre; dar ekranda (3 sütun) ve telefonda (2 sütun) fazlası gizlenir */}
        {BOS.slice(0, eksik(6)).map((k, i) => (
          <span
            key={k}
            aria-hidden="true"
            className={cx(
              [i < eksik(3) ? '' : 'rr-uc-gizli', i < eksik(2) ? '' : 'rr-iki-gizli'].join(' ').trim() ||
                undefined,
              stil.metin8,
            )}
          />
        ))}
      </div>
      <p className={stil.metin9}>
        Fotoğraflar temsilîdir · Wikimedia Commons ve galeri portföyleri · sıra her açılışta karışır
      </p>
    </section>
  );
}
