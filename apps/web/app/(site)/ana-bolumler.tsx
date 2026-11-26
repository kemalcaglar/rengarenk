import { DOTS, HELP_TOPICS, tints } from '@rengarenk/shared';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { colors } from '../../lib/renk';
import { butceAraligi, zaman } from '../../lib/talep-bicim';
import stil from './ana-bolumler.module.css';

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
    <div className={stil.kutu1}>
      <h2 id={id} className={stil.baslik1}>
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
          <Link href={tumu} className={stil.bag1}>
            Tüm talepler
          </Link>
        }
      >
        {baslik}
      </Baslik>
      <div className={stil.kutu2}>
        {liste.map((t, i) => (
          <Link
            key={t.no}
            href={`/talep/${t.no}`}
            className={cx(stil.bag2, i < liste.length - 1 ? stil.bag3 : stil.bag4)}
          >
            <span aria-hidden="true" className={stil.metin1} style={{ background: DOTS[i % DOTS.length] }} />
            <span className={stil.metin2}>{t.baslik}</span>
            <span className={stil.metin3}>{[t.il, t.ilce].filter(Boolean).join(', ') || 'Tüm Türkiye'}</span>
            <span className={stil.metin4}>{butceAraligi(t.butceMin, t.butceMax)}</span>
            <span className={stil.metin5}>{zaman(t.yayin)}</span>
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
    <section aria-labelledby="nasil" className={stil.kutu3}>
      <h2 id="nasil" className={stil.baslik2}>
        Nasıl çalışır?
      </h2>
      <ol className={`rr-uc-sutun ${stil.liste1}`}>
        {ADIMLAR.map((a) => (
          <li key={a.no} className={stil.oge1} style={{ background: a.tint }}>
            <span className={stil.metin6}>{a.no}</span>
            <span className={stil.metin7}>{a.baslik}</span>
            <span className={stil.metin8}>{a.metin}</span>
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
    <section aria-label="Güven" className={stil.kutu4}>
      {ROZETLER.map((r) => (
        <span key={r} className={stil.metin9}>
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
    <section aria-labelledby="sss" className={stil.kutu3}>
      <Baslik
        id="sss"
        sag={
          <Link href="/yardim" className={stil.bag1}>
            Yardım merkezi
          </Link>
        }
      >
        Sık sorulanlar
      </Baslik>
      {SORULAR.map(([soru, cevap]) => (
        <details key={soru} className={stil.kutu5}>
          <summary className={stil.metin10}>{soru}</summary>
          <p className={stil.metin11}>{cevap}</p>
        </details>
      ))}
    </section>
  );
}

export function GaleriCagri() {
  return (
    <section aria-label="Galeriler için" className={stil.kutu6}>
      <span className={stil.metin12}>
        <span className={stil.metin13}>Galeri misin? Alıcılar seni bekliyor</span>
        <span className={stil.metin14}>
          İlan vermeden, aradığı aracı yazan alıcılara ulaş. İlk 30 gün ücretsiz.
        </span>
      </span>
      <Link href="/kurumsal-basvuru" className={stil.bag5}>
        Galeri başvurusu
      </Link>
    </section>
  );
}
