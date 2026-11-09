'use client';

import { KVKK_KIND_KEYS, KVKK_KINDS, type KvkkKind } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { CerezTercihleri } from '../../../components/cerez-tercihleri';
import { API, erisim, istek } from '../../../lib/istemci';
import { Anahtar } from './iletisim';

const kart: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6EF',
  borderRadius: 18,
  padding: 20,
};
const satir: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  padding: '12px 0',
  borderTop: '1px solid #EEF0F5',
};
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 5,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 11,
  fontSize: 14.5,
  fontFamily: 'inherit',
  background: '#FFFFFF',
};
const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(
    new Date(iso),
  );

interface Engel {
  hesap: string;
  ad: string;
  not: string;
}
interface Kopya {
  id: string;
  durum: 'hazirlaniyor' | 'hazir' | 'hata' | 'suresi_doldu';
  istendi: string;
  gecerlilik: string | null;
}
interface Basvuru {
  numara: string;
  tur: string;
  durum: 'acik' | 'yanitlandi';
  sonTarih: string;
  yanit: string | null;
}

/** Engellediklerin (Ayarlar.dc.html › Gizlilik ve güvenlik) */
export function Engellediklerin({ bildir }: { bildir: (m: string | null, h?: string | null) => void }) {
  const [liste, setListe] = useState<Engel[] | null>(null);
  useEffect(() => {
    istek<Engel[]>('/me/blocks')
      .then(setListe)
      .catch(() => setListe([]));
  }, []);
  return (
    <section style={kart} aria-labelledby="en">
      <h2 id="en" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
        Engellediklerin
      </h2>
      <p style={{ margin: '0 0 10px', fontSize: 13.5, color: '#5A6073' }}>
        Engellediğin kişiler sana mesaj gönderemez ve taleplerini göremez.
      </p>
      {liste?.map((e) => (
        <div key={e.hesap} style={satir}>
          <span>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{e.ad}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>{e.not}</span>
          </span>
          <button
            type="button"
            style={ikincil}
            onClick={async () => {
              try {
                setListe(await istek<Engel[]>(`/me/blocks/${e.hesap}`, { method: 'DELETE' }));
                bildir(`${e.ad} için engel kaldırıldı.`);
              } catch (x) {
                bildir(null, (x as Error).message);
              }
            }}
          >
            Engeli kaldır
          </button>
        </div>
      ))}
      {liste && !liste.length ? (
        <p
          style={{
            margin: 0,
            paddingTop: 10,
            borderTop: '1px solid #EEF0F5',
            fontSize: 14,
            color: '#5A6073',
          }}
        >
          Engellediğin kimse yok.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Kişisel verilerim (Ayarlar.dc.html; Karar 58): "Verilerimi indir" SMS koduyla istenir, 24 saat içinde hazırlanır,
 * bağlantı 7 gün geçerli. KVKK başvurusu (bilgi alma, düzeltme, silme, itiraz) da SMS koduyla yapılır; 30 gün içinde
 * yanıtlanır.
 */
export function KisiselVerilerim({
  telefon,
  bildir,
}: {
  telefon: string;
  bildir: (m: string | null, h?: string | null) => void;
}) {
  const [kopyalar, setKopyalar] = useState<Kopya[]>([]);
  const [basvurular, setBasvurular] = useState<Basvuru[]>([]);
  const [adim, setAdim] = useState<null | 'indir' | 'kvkk'>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [kod, setKod] = useState('');
  const [tur, setTur] = useState<KvkkKind>('bilgi');
  const [metin, setMetin] = useState('');

  const [reklam, setReklam] = useState<boolean | null>(null);
  const yukle = useCallback(async () => {
    const [k, b, r] = await Promise.all([
      istek<Kopya[]>('/me/data-exports'),
      istek<Basvuru[]>('/me/kvkk'),
      istek<{ acik: boolean }>('/me/reklam-olcum'),
    ]);
    setKopyalar(k);
    setBasvurular(b);
    setReklam(r.acik);
  }, []);
  /** Reklam ölçümü onayı (Karar 35, 59): kapatınca bekleyen olaylar gönderilmez, tıklama kimlikleri silinir */
  async function reklamDegistir() {
    try {
      const r = await istek<{ acik: boolean }>('/me/reklam-olcum', {
        method: 'PUT',
        body: { acik: !reklam },
      });
      setReklam(r.acik);
      bildir(r.acik ? 'Reklam ölçümüne izin verdin.' : 'Reklam ölçümü iznini geri aldın.');
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }
  useEffect(() => {
    yukle().catch(() => undefined);
  }, [yukle]);

  async function kodIste(ne: 'indir' | 'kvkk') {
    try {
      const r = await istek<{ challengeId: string; devCode?: string }>('/auth/otp/request', {
        method: 'POST',
        body: { phone: telefon },
      });
      setChallengeId(r.challengeId);
      setAdim(ne);
      setKod(r.devCode ?? '');
      bildir('Telefonuna doğrulama kodu gönderdik.');
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }
  async function onayla() {
    if (!challengeId) return;
    try {
      if (adim === 'indir') {
        setKopyalar(
          await istek<Kopya[]>('/me/data-exports', { method: 'POST', body: { challengeId, code: kod } }),
        );
        bildir('Verilerinin kopyası hazırlanıyor; hazır olunca bildirim ve e-posta göndereceğiz.');
      } else {
        const r = await istek<{ numara: string; sonTarih: string }>('/me/kvkk', {
          method: 'POST',
          body: { challengeId, code: kod, tur, metin },
        });
        setMetin('');
        bildir(`Başvurun alındı · ${r.numara}. En geç ${tarih(r.sonTarih)} tarihine kadar yanıtlayacağız.`);
        await yukle();
      }
      setAdim(null);
      setChallengeId(null);
      setKod('');
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }
  async function indir(id: string) {
    try {
      const token = await erisim();
      const r = await fetch(`${API}/me/data-exports/${id}/download`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'İndirilemedi');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rengarenk-verilerim.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      bildir(null, (e as Error).message);
    }
  }

  const son = kopyalar[0];
  const kodAlani = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'flex-end',
        marginTop: 10,
        width: '100%',
      }}
    >
      <label style={{ flex: '0 1 180px', fontSize: 13, fontWeight: 700 }}>
        SMS kodu
        <input
          value={kod}
          onChange={(e) => setKod(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          style={girdi}
        />
      </label>
      <button
        type="button"
        onClick={onayla}
        disabled={kod.length !== 6 || (adim === 'kvkk' && metin.trim().length < 10)}
        style={{ ...ikincil, background: '#5B8CFF', border: 0, padding: '11px 16px', fontWeight: 800 }}
      >
        Onayla
      </button>
      <button type="button" onClick={() => setAdim(null)} style={{ ...ikincil, border: 0 }}>
        Vazgeç
      </button>
    </div>
  );

  return (
    <section style={kart} aria-labelledby="kv">
      <h2 id="kv" style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800 }}>
        Kişisel verilerim
      </h2>
      <div style={satir}>
        <span style={{ flex: '1 1 300px' }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Verilerimi indir</span>
          <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
            Profil, talepler, mesajlar, ödemeler ve rızaların. Doğrulama kodundan sonra 24 saat içinde
            hazırlanır; bağlantı 7 gün geçerli.
          </span>
          {son ? (
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                marginTop: 4,
                fontWeight: 700,
                color: son.durum === 'hazir' ? '#11683F' : '#7A5300',
              }}
            >
              {son.durum === 'hazir'
                ? `Hazır · ${son.gecerlilik ? tarih(son.gecerlilik) : ''} tarihine kadar indirilebilir`
                : son.durum === 'hazirlaniyor'
                  ? `${tarih(son.istendi)} tarihinde istendi · hazırlanıyor`
                  : son.durum === 'suresi_doldu'
                    ? 'Son kopyanın süresi doldu'
                    : 'Hazırlanamadı; yeniden dene'}
            </span>
          ) : null}
        </span>
        {son?.durum === 'hazir' ? (
          <button type="button" style={ikincil} onClick={() => indir(son.id)}>
            İndir
          </button>
        ) : son?.durum === 'hazirlaniyor' ? null : (
          <button type="button" style={ikincil} onClick={() => kodIste('indir')}>
            Hazırla
          </button>
        )}
        {adim === 'indir' ? kodAlani : null}
      </div>
      <div style={satir}>
        <span style={{ flex: '1 1 300px' }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>KVKK başvurusu</span>
          <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
            Bilgi alma, düzeltme, silme ya da itiraz. En geç 30 gün içinde yanıtlanır (KVKK m.13).
          </span>
        </span>
        {adim !== 'kvkk' ? (
          <button type="button" style={ikincil} onClick={() => setAdim('kvkk')}>
            Başvur
          </button>
        ) : null}
        {adim === 'kvkk' ? (
          <div style={{ width: '100%', marginTop: 6 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>
              Başvuru türü
              <select value={tur} onChange={(e) => setTur(e.target.value as KvkkKind)} style={girdi}>
                {KVKK_KIND_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {KVKK_KINDS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginTop: 10 }}>
              Talebin
              <textarea
                rows={4}
                value={metin}
                onChange={(e) => setMetin(e.target.value)}
                maxLength={3000}
                style={{ ...girdi, resize: 'vertical' }}
              />
            </label>
            {challengeId ? (
              kodAlani
            ) : (
              <button
                type="button"
                onClick={() => kodIste('kvkk')}
                disabled={metin.trim().length < 10}
                style={{ ...ikincil, marginTop: 10, background: '#5B8CFF', border: 0, fontWeight: 800 }}
              >
                Doğrulama kodu gönder
              </button>
            )}
          </div>
        ) : null}
      </div>
      {basvurular.map((b) => (
        <div key={b.numara} style={{ ...satir, alignItems: 'flex-start' }}>
          <span style={{ flex: '1 1 300px' }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>
              {b.numara} · {b.tur}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                color: '#5A6073',
                marginTop: 2,
                whiteSpace: 'pre-wrap',
              }}
            >
              {b.durum === 'acik' ? `Yanıt en geç ${tarih(b.sonTarih)}` : b.yanit}
            </span>
          </span>
          <span
            style={{ fontSize: 12.5, fontWeight: 800, color: b.durum === 'acik' ? '#7A5300' : '#11683F' }}
          >
            {b.durum === 'acik' ? 'İnceleniyor' : 'Yanıtlandı'}
          </span>
        </div>
      ))}
      {reklam === null ? null : (
        <div style={satir}>
          <span style={{ flex: '1 1 300px', minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Reklam ölçümü</span>
            <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
              Talep ve ödeme gibi adımların, reklamlarımızı ölçmek için Meta ve Google'a özet bilgiyle
              bildirilmesi. Mesajların ve talep açıklaman hiçbir zaman gönderilmez.
            </span>
          </span>
          <Anahtar acik={reklam} ad="Reklam ölçümü" onClick={reklamDegistir} />
        </div>
      )}
      <div style={satir}>
        <span>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>
            Aydınlatma metni ve çerez tercihleri
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
            Hangi verileri neden işlediğimiz ve haklarınız
          </span>
        </span>
        <span style={{ display: 'flex', gap: 16, fontSize: 13.5, fontWeight: 700 }}>
          <CerezTercihleri />
          <Link href="/kvkk">Görüntüle</Link>
        </span>
      </div>
    </section>
  );
}
