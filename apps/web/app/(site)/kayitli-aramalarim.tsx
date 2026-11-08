'use client';

import { tints } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { istek, useGiris } from '../../lib/istemci';
import { aramaAdresi } from '../../lib/talep-bicim';

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
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 id="kayitli" style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
          Kayıtlı aramalarınız
        </h2>
        <Link href="/favoriler?sekme=aramalar" style={{ fontSize: 14, fontWeight: 700 }}>
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
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 16,
              padding: 16,
              color: '#1E2333',
              textDecoration: 'none',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{a.ad}</span>
              <span style={{ display: 'block', fontSize: 13, color: '#5A6073', marginTop: 3 }}>
                {a.kriterler.slice(0, 3).join(' · ')}
              </span>
            </span>
            <span
              style={{
                flex: 'none',
                background: RENK[i % RENK.length],
                fontSize: 12.5,
                fontWeight: 800,
                padding: '6px 10px',
                borderRadius: 999,
              }}
            >
              {a.yeni ?? 0} yeni
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
