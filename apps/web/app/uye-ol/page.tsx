'use client';

import type { RegisterStarted, TicariKanallar } from '@rengarenk/shared';
import { TICARI_ILETI_KUTU } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, Fragment, useEffect, useState } from 'react';
import { Ayrac, GirisDuzeni, GoogleDugmesi, Hata, post, sonraAdresi } from '../../components/giris-ui';
import { OnayKutusu } from '../../components/onay-kutusu';
import { cx } from '../../lib/cx';
import { type GoogleKayit, kayitOku } from '../../lib/google';
import { olcumOlayi, temasGonder } from '../../lib/olcum';
import stil from './page.module.css';

/** Üyelik onayları (tasarım: Giris.dc.html). Zorunlu ikisi işaretsiz başlar (sahip kararı, 8 Kasım 2026). */
const ONAYLAR = [
  { key: 'kullanimKosullari', text: 'Kullanım koşullarını okudum ve kabul ediyorum.', zorunlu: true },
  { key: 'kvkkAydinlatma', text: 'KVKK aydınlatma metnini okudum.', zorunlu: true },
  {
    key: 'reklamOlcum',
    text: 'Reklamların ölçülmesi için telefon numaramın şifrelenmiş hâlinin Meta ve Google ile paylaşılmasına ve yurt dışına aktarılmasına açık rıza veriyorum (isteğe bağlı).',
    zorunlu: false,
  },
] as const;
type OnayKey = (typeof ONAYLAR)[number]['key'];

/** "5321234567" → "5XX 123 45 67" biçiminde gösterim için */
const showPhone = (digits: string) => {
  const d = digits.replace(/\D/g, '').replace(/^(90|0)/, '');
  return d.replace(/^(\d{3})(\d{3})(\d{2})(\d{2}).*$/, '$1 $2 $3 $4');
};

/**
 * Üye ol (Karar 18, 12 Kasım 2026): Google ile ya da formla. Her yolda ad, soyad, e-posta ve telefon alınır; telefon
 * bir kez kodla doğrulanır (WhatsApp; SMS yalnızca kapalı yedek) ve hesap o zaman açılır. Doğrulanmış bir numara başka hesapta
 * kullanılamaz. Onaylar sürümüyle kaydedilir (Karar 59).
 */
export default function UyeOl() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [google, setGoogle] = useState<GoogleKayit | null>(null);
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [phone, setPhone] = useState('');
  const [onay, setOnay] = useState<Record<OnayKey, boolean>>({
    kullanimKosullari: false,
    kvkkAydinlatma: false,
    reklamOlcum: false,
  });
  // Ticari ileti onayı kanal başına (yasal metin taslağı bölüm 4, İYS onayı kanal başına)
  const [ticari, setTicari] = useState<TicariKanallar>({ eposta: false, bildirim: false });
  const [kod, setKod] = useState<RegisterStarted | null>(null);
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sonra, setSonra] = useState<string | null>(null);

  useEffect(() => {
    setSonra(sonraAdresi());
    // Google'dan dönüldüyse form Google bilgileriyle dolar (bilgiler adresin # kısmında)
    const g = kayitOku(window.location.hash);
    if (g) {
      setGoogle(g);
      setAd(g.ad ?? '');
      setSoyad(g.soyad ?? '');
      setEposta(g.eposta);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  const zorunlu = onay.kullanimKosullari && onay.kvkkAydinlatma;
  // Google'ın verdiği bilgi değiştirilemez (API de jetondaki değeri yazar); vermediği alan formdan doldurulur
  const kilit = { ad: !!google?.ad, soyad: !!google?.soyad, eposta: !!google?.eposta };
  const kalan = Math.max(0, Math.round((expiresAt - now) / 1000));
  const sure = `${String(Math.floor(kalan / 60)).padStart(2, '0')}:${String(kalan % 60).padStart(2, '0')}`;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const kodGeldi = (r: RegisterStarted) => {
    setKod(r);
    setExpiresAt(Date.now() + r.expiresIn * 1000);
    setNow(Date.now());
    // Yalnızca yerel geliştirmede API kodu döndürür (gerçekten gönderilmez)
    setCode(r.devCode ?? '');
    setStep(2);
  };

  function adim1(e: FormEvent) {
    e.preventDefault();
    if (!zorunlu) {
      setError('Devam etmek için kullanım koşullarını ve KVKK aydınlatma metnini onayla.');
      return;
    }
    run(async () => {
      kodGeldi(
        await post<RegisterStarted>('/auth/register', {
          ad,
          soyad,
          eposta,
          telefon: `+90${phone.replace(/\D/g, '').replace(/^(90|0)/, '')}`,
          ...(google ? { kayitJetonu: google.kayitJetonu } : { sifre }),
          consents: {
            ...onay,
            ticariIleti: ticari.eposta || ticari.bildirim,
            ticariKanallar: ticari,
          },
          platform: 'WEB',
        }),
      );
    });
  }

  const tekrarGonder = () =>
    run(async () => {
      if (kod)
        kodGeldi(await post<RegisterStarted>('/auth/register/resend', { challengeId: kod.challengeId }));
    });

  function adim2(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      if (!kod) return;
      await post('/api/oturum/uyelik', { challengeId: kod.challengeId, code });
      // Reklam ölçümü (Karar 35): temaslar üyeye bağlanır; yeni üyelik olayı sunucuyla aynı kimlikle
      void temasGonder();
      olcumOlayi('CompleteRegistration', kod.challengeId);
      setStep(3);
    });
  }

  const kanalAdi = kod?.kanal === 'whatsapp' ? "WhatsApp'ına" : 'SMS ile';
  const kodMetni =
    kod?.kanal === 'ekran'
      ? 'numarasının doğrulama kodu bu ekrana yazıldı (kapalı test; WhatsApp gelene kadar kod gönderilmiyor).'
      : `numarasına ${kanalAdi} 6 haneli kod gönderdik.`;

  return (
    <GirisDuzeni baslikId="form-baslik">
      <div className={stil.kutu1} aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cx(stil.metin1, step >= n ? stil.metin2 : stil.metin3)} />
        ))}
      </div>

      {step === 1 ? (
        <>
          <h1 id="form-baslik" className={stil.baslik1}>
            Üye ol
          </h1>
          <p className={stil.metin4}>
            Zaten üye misin?{' '}
            <Link href={`/giris${sonra ? `?sonra=${encodeURIComponent(sonra)}` : ''}`} className={stil.bag1}>
              Giriş yap
            </Link>
          </p>
          {google ? (
            <p className={stil.metin5}>
              Google hesabınla devam ediyorsun. Google'dan gelen bilgiler değiştirilemez. Son adım: telefon
              numaranı doğrula.
            </p>
          ) : (
            <>
              <GoogleDugmesi sonra={sonra} yazi="Google ile üye ol" />
              <Ayrac />
            </>
          )}
          <form onSubmit={adim1}>
            <div className={stil.kutu2}>
              <div>
                <label htmlFor="ad" className={stil.etiket1}>
                  Ad
                </label>
                <input
                  id="ad"
                  autoComplete="given-name"
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  readOnly={kilit.ad}
                  required
                  minLength={2}
                  maxLength={40}
                  className={cx(kilit.ad ? stil.girdi4 : stil.girdi5)}
                />
              </div>
              <div>
                <label htmlFor="soyad" className={stil.etiket1}>
                  Soyad
                </label>
                <input
                  id="soyad"
                  autoComplete="family-name"
                  value={soyad}
                  onChange={(e) => setSoyad(e.target.value)}
                  readOnly={kilit.soyad}
                  required
                  minLength={2}
                  maxLength={40}
                  className={cx(kilit.soyad ? stil.girdi4 : stil.girdi5)}
                />
              </div>
            </div>
            <label htmlFor="eposta" className={stil.etiket2}>
              E-posta
            </label>
            <input
              id="eposta"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={eposta}
              onChange={(e) => setEposta(e.target.value)}
              readOnly={kilit.eposta}
              required
              className={cx(kilit.eposta ? stil.girdi4 : stil.girdi5)}
            />
            {google ? null : (
              <>
                <label htmlFor="sifre" className={stil.etiket2}>
                  Şifre
                </label>
                <input
                  id="sifre"
                  type="password"
                  autoComplete="new-password"
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  required
                  minLength={8}
                  aria-describedby="sifre-not"
                  className={stil.girdi1}
                />
                <p id="sifre-not" className={stil.metin6}>
                  En az 8 karakter; içinde harf ve rakam olsun.
                </p>
              </>
            )}
            <label htmlFor="tel" className={stil.etiket2}>
              Cep telefonu
            </label>
            <div className={stil.kutu3}>
              <span className={stil.metin7}>+90</span>
              <input
                id="tel"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="5XX 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                aria-describedby="tel-not"
                className={stil.girdi2}
              />
            </div>
            <p id="tel-not" className={stil.metin6}>
              Numarana bir kez doğrulama kodu göndereceğiz (WhatsApp). Bir numarayla yalnızca bir hesap
              açılabilir.
            </p>
            <div className={stil.kutu4}>
              {ONAYLAR.map((o) => (
                <Fragment key={o.key}>
                  {o.key === 'reklamOlcum' ? (
                    <fieldset className={stil.kutu5}>
                      <legend className={stil.baslik2}>{TICARI_ILETI_KUTU.metin}</legend>
                      <div className={stil.kutu6}>
                        {TICARI_ILETI_KUTU.kanallar.map((k) => (
                          <OnayKutusu
                            key={k.anahtar}
                            checked={ticari[k.anahtar]}
                            onChange={(v) => setTicari({ ...ticari, [k.anahtar]: v })}
                            className={stil.kanalOnay}
                          >
                            {k.ad}
                          </OnayKutusu>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  <OnayKutusu
                    checked={onay[o.key]}
                    onChange={(v) => setOnay({ ...onay, [o.key]: v })}
                    className={stil.onay}
                  >
                    {o.text}
                  </OnayKutusu>
                </Fragment>
              ))}
            </div>
            <button
              type="submit"
              disabled={busy}
              aria-disabled={!zorunlu}
              className={cx(zorunlu ? stil.dugme4 : stil.dugme5)}
            >
              {busy ? 'Gönderiliyor…' : 'Devam et'}
            </button>
            <Hata>{error}</Hata>
          </form>
        </>
      ) : null}

      {step === 2 && kod ? (
        <form onSubmit={adim2}>
          <h1 id="form-baslik" className={stil.baslik1}>
            Telefonunu doğrula
          </h1>
          <p className={stil.metin4}>
            +90 {showPhone(phone)} {kodMetni}{' '}
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              className={stil.dugme1}
            >
              Bilgileri değiştir
            </button>
          </p>
          <label htmlFor="kod" className={stil.etiket1}>
            Doğrulama kodu
          </label>
          <input
            id="kod"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            className={stil.girdi3}
          />
          <div className={stil.kutu7}>
            <span className={stil.metin8}>
              {kalan > 0 ? `Kod ${sure} içinde geçerli` : 'Kodun süresi doldu'}
            </span>
            <button type="button" onClick={tekrarGonder} disabled={busy} className={stil.dugme2}>
              Kodu tekrar gönder
            </button>
          </div>
          {kod.devCode && kod.kanal !== 'ekran' ? (
            <p className={stil.metin9}>Geliştirme ortamı: kod gönderilmedi, {kod.devCode} kutuya yazıldı.</p>
          ) : null}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className={cx(code.length === 6 ? stil.dugme4 : stil.dugme5)}
          >
            {busy ? 'Doğrulanıyor…' : 'Doğrula ve üye ol'}
          </button>
          <Hata>{error}</Hata>
          <p className={stil.metin10}>Kodu kimseyle paylaşma; Rengarenk çalışanları kodunu asla sormaz.</p>
        </form>
      ) : null}

      {step === 3 ? (
        <div>
          <h1 id="form-baslik" className={stil.baslik1}>
            Hoş geldin, {ad}!
          </h1>
          <div className={stil.kutu8}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#11683F"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12l5 5 9-10" />
            </svg>
            <span className={stil.metin11}>Telefon numaran doğrulandı. 1 ücretsiz talep hakkın hazır.</span>
          </div>
          {google ? null : (
            <p className={stil.metin4}>
              {eposta} adresine bir doğrulama bağlantısı gönderdik; bildirimleri e-postayla almak için
              bağlantıya bas.
            </p>
          )}
          <button
            type="button"
            onClick={() => router.push(sonra ?? '/talep-olustur')}
            className={stil.dugme4}
          >
            İlk talebimi oluştur
          </button>
          <button type="button" onClick={() => router.push('/')} className={stil.dugme3}>
            Önce taleplere göz at
          </button>
        </div>
      ) : null}
    </GirisDuzeni>
  );
}
