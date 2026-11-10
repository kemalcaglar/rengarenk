'use client';

import { useKonsol } from '../kabuk';
import { YardimMakaleleri } from './yardim';
import { YasalMetinler } from './yasal';

/**
 * Görünüm › Yardım ve yasal metinler (YonetimIcerik.dc.html › metin; Karar 46, 59). Yasal metinler sürümlüdür; her
 * kullanıcının hangi sürümü ne zaman onayladığı saklanır. Yayın sahip onayıyla. Yardım makaleleri yardım merkezinde,
 * destek sohbetinde ve ajanın yanıtlarında kullanılır.
 */
export default function YardimVeYasal() {
  const { me } = useKonsol();
  const yasal = me.permissions['tasarim_yasal.duzenle'];
  const gorunum = me.permissions['gorunum.duzenle'];
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 className="k-h1">Yardım ve yasal metinler</h1>
        <p className="k-sub">
          Yasal metinler sürümlüdür; her kullanıcının hangi sürümü ne zaman onayladığı saklanır.
        </p>
      </div>
      {yasal ? <YasalMetinler yazabilir={yasal === 'tam' || yasal === 'oneri'} /> : null}
      {gorunum ? <YardimMakaleleri yazabilir={gorunum === 'tam'} /> : null}
    </>
  );
}
