'use client';

import { tints } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { istek, useGiris } from '../../lib/istemci';
import { aramaAdresi } from '../../lib/talep-bicim';
import stil from './kayitli-aramalarim.module.css';

interface Arama {
  id: string;
  ad: string;
  sorgu: Record<string, unknown>;
  kriterler: string[];
  yeni: number | null;
}

const RENK = [tints.blue, tints.green, tints.yellow];

/**
 * Ana sayfada "Kayıtlı aramalarınız" (Karar 22, Anasayfa.dc.html): kayıtlı aramalara uyan yeni talepler. Misafirde ve
 * kayıtlı araması olmayan kullanıcıda gösterilmez.
 */
export function KayitliAramalarim() {
  const giris = useGiris();
  const router = useRouter();
  const [liste, setListe] = useState<Arama[]>([]);

  useEffect(() => {
    if (giris)
      istek<Arama[]>('/saved-searches')
        .then(setListe)
        .catch(() => undefined);
  }, [giris]);

  if (!liste.length) return null;

  const gor = async (a: Arama) => {
    await istek(`/saved-searches/${a.id}`, { method: 'PATCH', body: { gordum: true } }).catch(
      () => undefined,
    );
    router.push(aramaAdresi(a.sorgu));
  };

  return (
    <section aria-labelledby="kayitli">
      <div className={stil.kutu1}>
        <h2 id="kayitli" className={stil.baslik1}>
          Kayıtlı aramalarınız
        </h2>
        <Link href="/favoriler?sekme=aramalar" className={stil.bag1}>
          Aramaları yönet
        </Link>
      </div>
      <div className="rr-uc-sutun">
        {liste.slice(0, 3).map((a, i) => (
          <a
            key={a.id}
            href={aramaAdresi(a.sorgu)}
            onClick={(e) => {
              e.preventDefault();
              gor(a);
            }}
            className={stil.bag2}
          >
            <span className={stil.metin1}>
              <span className={stil.metin2}>{a.ad}</span>
              <span className={stil.metin3}>{a.kriterler.slice(0, 3).join(' · ')}</span>
            </span>
            <span className={stil.metin4} style={{ background: RENK[i % RENK.length] }}>
              {a.yeni ?? 0} yeni
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
