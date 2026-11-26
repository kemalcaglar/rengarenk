'use client';

import {
  BLOCK_KINDS,
  BLOCK_MANUAL_KINDS,
  type BlockKind,
  GRANT_KINDS,
  type GrantKind,
  PEOPLE_FILTERS,
  REVEAL_SECONDS,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

type Tip = 'kisi' | 'galeri';
interface Sonuc {
  tip: Tip;
  id: string;
  ad: string;
  bas: string;
  renk: string;
  alt: string;
  durum: string;
}
interface Kart {
  /** Hesap kapatıldı (Karar 31) */
  kapali?: boolean;
  tip: Tip;
  id: string;
  ad: string;
  bas: string;
  renk: string;
  alt: string;
  rozetler: { t: string; bg: string; fg: string }[];
  telefon: string;
  eposta: string;
  sayilar: { ad: string; deger: string }[];
  gecmis: { zamanYazi: string; olay: string; detay: string; renk: string }[];
  musteri?: Musteri;
  /** Kişinin cihazları (cihaz kara listesi, Karar 43) */
  cihazlar?: {
    id: string;
    ad: string;
    sonGiris: string;
    ilkGiris: string;
    engellenebilir: boolean;
    karaListede: boolean;
  }[];
}
type Cihazlar = NonNullable<Kart['cihazlar']>;
/** Galeri kartı › Müşteri yönetimi (Karar 43) */
interface Musteri {
  sorumlu: { id: string; ad: string; zaman: string | null } | null;
  risk: { puan: number; ad: string; bg: string; fg: string; gerekceler: string[] };
  yenileme: { tarih: string; ne: string; kalanGun: number } | null;
  ilkMesaj30: number;
  calisanlar: { id: string; name: string }[];
}
interface KaraSatir {
  id: string;
  tur: BlockKind;
  turAd: string;
  deger: string;
  not: string | null;
  kim: string;
  zaman: string;
}
type Form = null | 'hak' | 'not' | 'uyari' | 'aski' | 'engel';

/** Durum rozeti (YonetimPazar.dc.html › kisiler) */
const DURUM: Record<string, [string, string]> = {
  Aktif: ['#E7FAF0', '#11683F'],
  Askıda: ['#FDECEC', '#A3271F'],
  Engelli: ['#FDECEC', '#A3271F'],
  Kapalı: ['#F3F5FA', '#5A6073'],
};
const KARAR_FORM: Record<'uyari' | 'aski' | 'engel', [string, string]> = {
  uyari: [
    'Uyar',
    'Şablonlu uyarı gider; 30 gün içinde ikinci uyarıda otomatik askı. Kişi 7 gün içinde itiraz edebilir.',
  ],
  aski: ['24 saat askıya al', '24 saat ilk mesaj ve mesaj gönderemez. Kişi 7 gün içinde itiraz edebilir.'],
  engel: ['Kalıcı engelleme öner', 'Öneri onay kuyruğuna düşer; onaya kadar hesap askıda kalır.'],
};

/**
 * Kullanıcılar ve galeriler (YonetimPazar.dc.html › kullanici; Karar 40, 43, 52): arama ve süzgeç, kart (maskeli
 * iletişim, sayılar, işlemler, geçmiş) ve kara liste.
 */
export default function Kullanicilar() {
  const { me } = useKonsol();
  const p = me.permissions;
  const izin = {
    uyari: p['sikayet.coz'] === 'tam',
    aski: p['hesap.askiya_al'] === 'tam',
    engel: p['hesap.kalici_engelle'] === 'tam' || p['hesap.kalici_engelle'] === 'oneri',
    hak: p['hak.tanimla'] === 'tam',
    oturum: p['destek.yanitla'] === 'tam' || p['hesap.askiya_al'] === 'tam',
    iade: p.iade === 'tam' || p.iade === 'oneri',
    kara: p['sikayet.coz'] === 'tam',
  };
  const [q, setQ] = useState('');
  const [tur, setTur] = useState<(typeof PEOPLE_FILTERS)[number][0]>('hepsi');
  const [liste, setListe] = useState<Sonuc[]>([]);
  const [sec, setSec] = useState<{ tip: Tip; id: string } | null>(null);
  const [k, setK] = useState<Kart | null>(null);
  const [acik, setAcik] = useState<{ telefon: string; eposta: string } | null>(null);
  const [gerekceAc, setGerekceAc] = useState(false);
  const [gerekce, setGerekce] = useState('');
  const [form, setForm] = useState<Form>(null);
  const [hak, setHak] = useState<{ tur: GrantKind; adet: number; gerekce: string }>({
    tur: 'ilk_mesaj',
    adet: 5,
    gerekce: '',
  });
  const [metin, setMetin] = useState('');
  const [kara, setKara] = useState<KaraSatir[]>([]);
  const [yeniKara, setYeniKara] = useState<{
    tur: (typeof BLOCK_MANUAL_KINDS)[number];
    deger: string;
    not: string;
  }>({
    tur: 'telefon',
    deger: '',
    not: '',
  });
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const ara = useCallback(async (aranan: string, t: string) => {
    try {
      const r = await yonetim<Sonuc[]>(`people?q=${encodeURIComponent(aranan)}&tur=${t}`);
      setListe(r);
      // Destek ekranından gelen bağlantı: ?kisi=<id> ya da ?galeri=<id>
      const u = new URLSearchParams(window.location.search);
      const dis = u.get('kisi')
        ? { tip: 'kisi' as Tip, id: u.get('kisi') as string }
        : u.get('galeri')
          ? { tip: 'galeri' as Tip, id: u.get('galeri') as string }
          : null;
      setSec((s) => s ?? dis ?? (r[0] ? { tip: r[0].tip, id: r[0].id } : null));
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const z = setTimeout(() => ara(q, tur), 300);
    return () => clearTimeout(z);
  }, [q, tur, ara]);
  useEffect(() => {
    if (izin.kara)
      yonetim<KaraSatir[]>('blocklist')
        .then(setKara)
        .catch(() => undefined);
  }, [izin.kara]);
  useEffect(() => {
    if (!sec) return;
    setK(null);
    setAcik(null);
    setGerekceAc(false);
    setForm(null);
    yonetim<Kart>(`people/${sec.tip}/${sec.id}`)
      .then(setK)
      .catch((e: Error) => setHata(e.message));
  }, [sec]);
  // Açılan veri 5 dakika sonra yeniden maskelenir
  useEffect(() => {
    if (!acik) return;
    const z = setTimeout(() => setAcik(null), REVEAL_SECONDS * 1000);
    return () => clearTimeout(z);
  }, [acik]);

  async function islem(yol: string, body: object, mesaj: string) {
    if (!sec) return;
    setHata(null);
    try {
      setK(await yonetim<Kart>(`people/${sec.tip}/${sec.id}/${yol}`, { method: 'POST', body }));
      setBilgi(mesaj);
      setForm(null);
      setMetin('');
      ara(q, tur);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function goster() {
    if (!sec) return;
    try {
      setAcik(await yonetim(`people/${sec.tip}/${sec.id}/reveal`, { method: 'POST', body: { gerekce } }));
      setGerekceAc(false);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function sorumluAta(calisan: string) {
    if (!k) return;
    setHata(null);
    try {
      const m = await yonetim<Musteri>(`people/galeri/${k.id}/manager`, {
        method: 'POST',
        body: { calisan: calisan || null },
      });
      setK({ ...k, musteri: m });
      setBilgi(calisan ? 'Sorumlu çalışan atandı; işlem kaydına yazıldı.' : 'Sorumlu çalışan kaldırıldı.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function cihazEngelle(deviceId: string) {
    if (!k) return;
    setHata(null);
    try {
      const c = await yonetim<Cihazlar>(`people/kisi/${k.id}/devices/${deviceId}/block`, {
        method: 'POST',
        body: {},
      });
      setK({ ...k, cihazlar: c });
      setKara(await yonetim<KaraSatir[]>('blocklist'));
      setBilgi('Cihaz kara listeye alındı; bu cihazdan giriş yapılamaz, açık oturumları kapandı.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function karaEkle() {
    try {
      setKara(
        await yonetim<KaraSatir[]>('blocklist', {
          method: 'POST',
          body: {
            tur: yeniKara.tur,
            deger: yeniKara.deger,
            ...(yeniKara.not.trim() ? { not: yeniKara.not } : {}),
          },
        }),
      );
      setYeniKara({ ...yeniKara, deger: '', not: '' });
      setBilgi('Kara listeye eklendi.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function karaCikar(id: string) {
    try {
      setKara(await yonetim<KaraSatir[]>(`blocklist/${id}`, { method: 'DELETE' }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  // Kapatılan hesapta yalnızca not ve iade önerisi (Karar 31)
  const kapali = !!k?.kapali;
  const dugmeler: [string, Form | 'oturum' | 'baglanti' | 'iade', boolean, string, string][] = [
    ['Uyar', 'uyari', izin.uyari && !kapali, '#D5DAE5', '#1E2333'],
    ['24 saat askıya al', 'aski', izin.aski && !kapali, '#D5DAE5', '#1E2333'],
    ['Hak tanımla', 'hak', izin.hak && !kapali, '#D5DAE5', '#1E2333'],
    // Tasarımdaki sıra (YonetimPazar.dc.html): hak tanımla, giriş bağlantısı, oturumları kapat
    ['Giriş bağlantısı gönder', 'baglanti', izin.oturum && !kapali, '#D5DAE5', '#1E2333'],
    ['Oturumları kapat', 'oturum', izin.oturum && !kapali, '#D5DAE5', '#1E2333'],
    ['Not ekle', 'not', true, '#D5DAE5', '#1E2333'],
    ['İade öner', 'iade', izin.iade, '#F4DC9A', '#7A5300'],
    ['Kalıcı engelleme öner', 'engel', izin.engel && !kapali, '#E5A6A1', '#A3271F'],
  ];

  return (
    <>
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Kullanıcılar ve galeriler</h1>
        <p className={stil.metin1}>
          Kişisel veriler maskeli gelir. Açmak gerekçe ister ve işlem kaydına girer.
        </p>
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {bilgi ? (
        <p role="status" className={stil.metin3}>
          {bilgi}
        </p>
      ) : null}
      <div className={stil.kutu2}>
        <label htmlFor="ara" className={stil.etiket1}>
          Kullanıcı ara
        </label>
        <input
          id="ara"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad, galeri adı, talep no veya e-postanın ilk harfleri"
          className={stil.girdi1}
        />
        {PEOPLE_FILTERS.map(([key, ad]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTur(key)}
            aria-pressed={tur === key}
            className={cx(tur === key ? stil.dugme1 : stil.dugme2)}
          >
            {ad}
          </button>
        ))}
      </div>

      <div className={stil.kutu3}>
        <section aria-label="Sonuçlar" className={stil.kutu4}>
          {!liste.length ? <p className={stil.metin4}>Sonuç yok.</p> : null}
          {liste.map((x) => {
            const on = sec?.id === x.id;
            const [db, df] = DURUM[x.durum] ?? DURUM.Aktif;
            return (
              <button
                key={`${x.tip}-${x.id}`}
                type="button"
                onClick={() => {
                  setSec({ tip: x.tip, id: x.id });
                  setBilgi(null);
                }}
                aria-current={on}
                className={cx(stil.dugme3, on ? stil.dugme4 : stil.dugme5)}
              >
                <span aria-hidden="true" className={stil.metin5} style={{ background: x.renk }}>
                  {x.bas}
                </span>
                <span className={stil.metin6}>
                  <span className={stil.metin7}>{x.ad}</span>
                  <span className={stil.metin8}>{x.alt}</span>
                </span>
                <span className={stil.metin9} style={{ background: db, color: df }}>
                  {x.durum}
                </span>
              </button>
            );
          })}
        </section>

        <section aria-labelledby="kart" className={stil.kutu5}>
          {k ? (
            <>
              <div className={stil.kutu6}>
                <span aria-hidden="true" className={stil.metin10} style={{ background: k.renk }}>
                  {k.bas}
                </span>
                <div className={stil.kutu7}>
                  <h2 id="kart" className={stil.baslik2}>
                    {k.ad}
                  </h2>
                  <div className={stil.kutu8}>{k.alt}</div>
                  <div className={stil.kutu9}>
                    {k.rozetler.map((r) => (
                      <span key={r.t} className={stil.metin11} style={{ background: r.bg, color: r.fg }}>
                        {r.t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={stil.kutu10}>
                  <div className={stil.kutu11}>
                    <span className={stil.metin12}>Telefon</span>
                    <strong>{acik?.telefon ?? k.telefon}</strong>
                  </div>
                  <div className={stil.kutu12}>
                    <span className={stil.metin12}>E-posta</span>
                    <strong className={stil.metin13}>{acik?.eposta ?? k.eposta}</strong>
                  </div>
                  {acik ? (
                    <div className={stil.kutu13}>
                      Açıldı · işlem kaydına yazıldı · 5 dakika sonra yeniden maskelenir
                    </div>
                  ) : gerekceAc ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        goster();
                      }}
                      className={stil.kutu14}
                    >
                      <input
                        value={gerekce}
                        onChange={(e) => setGerekce(e.target.value)}
                        aria-label="Gerekçe"
                        placeholder="Ör. Destek talebi D-20952, geri dönüş"
                        className={stil.girdi2}
                      />
                      <button type="submit" className={stil.dugme6}>
                        Göster
                      </button>
                    </form>
                  ) : (
                    <button type="button" onClick={() => setGerekceAc(true)} className={stil.dugme7}>
                      Gerekçe yazıp göster
                    </button>
                  )}
                </div>
              </div>
              <div className={stil.kutu15}>
                {k.sayilar.map((n) => (
                  <div key={n.ad} className={stil.kutu16}>
                    <div className={stil.kutu17}>{n.deger}</div>
                    <div className={stil.kutu18}>{n.ad}</div>
                  </div>
                ))}
              </div>
              <div className={stil.kutu19}>
                {dugmeler.map(([ad, ne, var_, kenar, renk]) =>
                  ne === 'iade' ? (
                    var_ ? (
                      <Link
                        key={ad}
                        href="/odemeler"
                        className={stil.bag1}
                        style={{ border: `1px solid ${kenar}`, color: renk }}
                      >
                        {ad}
                      </Link>
                    ) : null
                  ) : (
                    <button
                      key={ad}
                      type="button"
                      disabled={!var_}
                      title={var_ ? undefined : 'Bu işlem için yetkin yok'}
                      onClick={() =>
                        ne === 'oturum'
                          ? islem('sessions/revoke', {}, 'Tüm cihazlardaki oturumlar kapatıldı.')
                          : ne === 'baglanti'
                            ? islem(
                                'login-link',
                                {},
                                'Giriş bağlantısı kişinin doğrulanmış e-postasına gönderildi. 15 dakika geçerli, bir kez kullanılır.',
                              )
                            : setForm(form === ne ? null : (ne as Form))
                      }
                      className={cx(
                        stil.dugme8,
                        form === ne ? stil.dugme9 : stil.dugme10,
                        var_ ? stil.dugme11 : stil.dugme12,
                      )}
                      style={{ border: `1px solid ${kenar}`, color: var_ ? renk : '#AEB5C4' }}
                    >
                      {ad}
                    </button>
                  ),
                )}
              </div>
              {form === 'hak' ? (
                <div className={stil.kutu20}>
                  <label className={stil.etiket2}>
                    Hak
                    <select
                      value={hak.tur}
                      onChange={(e) => setHak({ ...hak, tur: e.target.value as GrantKind })}
                      className={stil.girdi3}
                    >
                      {(Object.keys(GRANT_KINDS) as GrantKind[]).map((g) => (
                        <option key={g} value={g}>
                          {GRANT_KINDS[g]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={stil.etiket3}>
                    Adet
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={hak.adet}
                      onChange={(e) => setHak({ ...hak, adet: Number(e.target.value) })}
                      className={stil.girdi3}
                    />
                  </label>
                  <label className={stil.etiket4}>
                    Gerekçe
                    <input
                      value={hak.gerekce}
                      onChange={(e) => setHak({ ...hak, gerekce: e.target.value })}
                      placeholder="Ör. Acil etiketi hatası nedeniyle gönül alma"
                      className={stil.girdi3}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      islem(
                        'grant',
                        hak,
                        `${hak.adet} ${GRANT_KINDS[hak.tur].toLocaleLowerCase('tr-TR')} tanımlandı; kişiye bildirim gitti.`,
                      )
                    }
                    className={stil.dugme13}
                  >
                    Tanımla
                  </button>
                  <p className={stil.metin14}>
                    Destek rolü kişi başına ayda en fazla 10 hak tanımlayabilir; üstü yönetici onayı ister.
                    İade bu ekrandan yapılmaz, yalnızca önerilir.
                  </p>
                </div>
              ) : form === 'not' || form === 'uyari' || form === 'aski' || form === 'engel' ? (
                <div className={stil.kutu20}>
                  <label className={stil.etiket5}>
                    {form === 'not' ? 'Not (yalnızca çalışanlar görür)' : 'Gerekçe (kullanıcıya gider)'}
                    <input
                      value={metin}
                      onChange={(e) => setMetin(e.target.value)}
                      maxLength={500}
                      className={stil.girdi3}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      form === 'not'
                        ? islem('notes', { metin }, 'Not eklendi; yalnızca çalışanlar görür.')
                        : islem(
                            'action',
                            { karar: form, gerekce: metin },
                            form === 'engel'
                              ? 'Kalıcı engelleme önerisi onay kuyruğuna eklendi.'
                              : form === 'aski'
                                ? '24 saat askıya alındı. Kişi 7 gün içinde itiraz edebilir.'
                                : 'Uyarı gönderildi ve işlem kaydına yazıldı.',
                          )
                    }
                    className={cx(stil.dugme14, form === 'engel' ? stil.dugme15 : stil.dugme16)}
                  >
                    {form === 'not' ? 'Ekle' : KARAR_FORM[form][0]}
                  </button>
                  {form !== 'not' ? <p className={stil.metin14}>{KARAR_FORM[form][1]}</p> : null}
                </div>
              ) : null}
              {k.musteri ? (
                <>
                  <h3 className={stil.baslik3}>Müşteri yönetimi</h3>
                  <div className={stil.kutu21}>
                    <span className={stil.metin15}>
                      <span className={stil.metin8}>Ayrılma riski</span>
                      <span
                        className={stil.metin16}
                        style={{ background: k.musteri.risk.bg, color: k.musteri.risk.fg }}
                      >
                        {k.musteri.risk.ad} · {k.musteri.risk.puan}
                      </span>
                      {k.musteri.risk.gerekceler.length ? (
                        <span className={stil.metin17}>{k.musteri.risk.gerekceler.join(' · ')}</span>
                      ) : null}
                    </span>
                    <span className={stil.metin18}>
                      <span className={stil.metin8}>Yenileme</span>
                      <span className={stil.metin19}>
                        {k.musteri.yenileme
                          ? `${k.musteri.yenileme.ne} · ${new Date(k.musteri.yenileme.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`
                          : 'Yenileme yok'}
                      </span>
                    </span>
                    <span className={stil.metin20}>
                      <label htmlFor="sorumlu-calisan">Sorumlu çalışan</label>
                      {me.permissions['galeri_basvuru.onayla'] === 'tam' ? (
                        <select
                          id="sorumlu-calisan"
                          value={k.musteri.sorumlu?.id ?? ''}
                          onChange={(e) => sorumluAta(e.target.value)}
                          className={stil.girdi4}
                        >
                          <option value="">Sorumlu yok</option>
                          {k.musteri.calisanlar.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={stil.metin21}>{k.musteri.sorumlu?.ad ?? 'Sorumlu yok'}</span>
                      )}
                    </span>
                  </div>
                </>
              ) : null}
              {k.cihazlar?.length ? (
                <>
                  <h3 className={stil.baslik3}>Cihazlar</h3>
                  {k.cihazlar.map((c) => (
                    <div key={c.id} className={stil.kutu22}>
                      <span className={stil.metin22}>
                        <span className={stil.metin23}>{c.ad}</span>
                        <span className={stil.metin12}>
                          {' '}
                          · ilk giriş {new Date(c.ilkGiris).toLocaleDateString('tr-TR')} · son{' '}
                          {new Date(c.sonGiris).toLocaleDateString('tr-TR')}
                        </span>
                      </span>
                      {c.karaListede ? (
                        <span className={stil.metin24}>Kara listede</span>
                      ) : c.engellenebilir && me.permissions['sikayet.coz'] === 'tam' ? (
                        <button type="button" onClick={() => cihazEngelle(c.id)} className={stil.dugme17}>
                          Kara listeye al
                        </button>
                      ) : null}
                    </div>
                  ))}
                </>
              ) : null}
              <h3 className={stil.baslik3}>Geçmiş</h3>
              {k.gecmis.map((g, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: geçmiş sırası sabit
                  key={i}
                  className={stil.kutu23}
                >
                  <span className={stil.metin25}>{g.zamanYazi}</span>
                  <span aria-hidden="true" className={stil.metin26} style={{ background: g.renk }} />
                  <span className={stil.metin6}>
                    <span className={stil.metin23}>{g.olay}</span>
                    {g.detay ? <span className={stil.metin27}>{g.detay}</span> : null}
                  </span>
                </div>
              ))}
              <div className={stil.kutu24} />
            </>
          ) : (
            <p className={stil.metin28}>{sec ? 'Yükleniyor…' : 'Soldan bir kişi ya da galeri seç.'}</p>
          )}
        </section>
      </div>

      {izin.kara ? (
        <section className={stil.kutu25} aria-labelledby="kara">
          <div className={stil.kutu26}>
            <h2 id="kara" className={stil.baslik4}>
              Kara liste
            </h2>
            <p className={stil.metin29}>
              Listedeki telefon ve IP adresine giriş kodu gönderilmez; IBAN içeren mesaj gizlenir ve
              moderasyona kritik olarak düşer. Değerin kendisi saklanmaz.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              karaEkle();
            }}
            className={stil.kutu20}
          >
            <label className={stil.etiket6}>
              Tür
              <select
                value={yeniKara.tur}
                onChange={(e) =>
                  setYeniKara({ ...yeniKara, tur: e.target.value as (typeof BLOCK_MANUAL_KINDS)[number] })
                }
                className={stil.girdi3}
              >
                {BLOCK_MANUAL_KINDS.map((b) => (
                  <option key={b} value={b}>
                    {BLOCK_KINDS[b]}
                  </option>
                ))}
              </select>
            </label>
            <label className={stil.etiket7}>
              Değer
              <input
                value={yeniKara.deger}
                onChange={(e) => setYeniKara({ ...yeniKara, deger: e.target.value })}
                placeholder={
                  yeniKara.tur === 'telefon'
                    ? '0532 111 22 33'
                    : yeniKara.tur === 'iban'
                      ? 'TR00 0000 …'
                      : '203.0.113.7'
                }
                className={stil.girdi3}
              />
            </label>
            <label className={stil.etiket4}>
              Not
              <input
                value={yeniKara.not}
                onChange={(e) => setYeniKara({ ...yeniKara, not: e.target.value })}
                placeholder="Ör. Kapora dolandırıcılığı, S-1024"
                className={stil.girdi3}
              />
            </label>
            <button type="submit" className={stil.dugme18}>
              Listeye ekle
            </button>
          </form>
          {!kara.length ? <p className={stil.metin30}>Kara liste boş.</p> : null}
          {kara.map((x) => (
            <div key={x.id} className={stil.kutu27}>
              <span className={stil.metin31}>{x.turAd}</span>
              <span className={stil.metin32}>{x.deger}</span>
              <span className={stil.metin33}>
                {x.not ? `${x.not} · ` : ''}
                {x.kim}
              </span>
              <button type="button" onClick={() => karaCikar(x.id)} className={stil.dugme19}>
                Listeden çıkar
              </button>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
