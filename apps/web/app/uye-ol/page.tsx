'use client';

import type { RegisterStarted } from '@rengarenk/shared';
import { tints } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import {
  Ayrac,
  field,
  GirisDuzeni,
  GoogleDugmesi,
  Hata,
  h1,
  label,
  lead,
  linkButton,
  note,
  post,
  primary,
  sonraAdresi,
} from '../../components/giris-ui';
import { OnayKutusu } from '../../components/onay-kutusu';
import { type GoogleKayit, kayitOku } from '../../lib/google';
import { olcumOlayi, temasGonder } from '../../lib/olcum';
import { colors } from '../../lib/renk';

/** Üyelik onayları (tasarım: Giris.dc.html). Zorunlu ikisi işaretsiz başlar (sahip kararı, 8 Kasım 2026). */
const ONAYLAR = [
  { key: 'kullanimKosullari', text: 'Kullanım koşullarını okudum ve kabul ediyorum.', zorunlu: true },
  { key: 'kvkkAydinlatma', text: 'KVKK aydınlatma metnini okudum.', zorunlu: true },
  {
    key: 'ticariIleti',
    text: 'Kampanya ve duyurular için ticari elektronik ileti almak istiyorum (isteğe bağlı).',
    zorunlu: false,
  },
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
 * bir kez kodla doğrulanır (önce WhatsApp, yedek SMS) ve hesap o zaman açılır. Doğrulanmış bir numara başka hesapta
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
    ticariIleti: false,
    reklamOlcum: false,
  });
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
  const kilitli = {
    ...field,
    background: colors.background,
    color: colors.muted,
    cursor: 'not-allowed',
  } as const;
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
          consents: onay,
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }} aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 'calc(var(--rr-buton-kose) * 3 / 14)',
              background: step >= n ? colors.blue : colors.line,
            }}
          />
        ))}
      </div>

      {step === 1 ? (
        <>
          <h1 id="form-baslik" style={h1}>
            Üye ol
          </h1>
          <p style={lead}>
            Zaten üye misin?{' '}
            <Link
              href={`/giris${sonra ? `?sonra=${encodeURIComponent(sonra)}` : ''}`}
              style={{ fontWeight: 700 }}
            >
              Giriş yap
            </Link>
          </p>
          {google ? (
            <p
              style={{
                margin: '0 0 18px',
                fontSize: 14,
                fontWeight: 600,
                background: tints.blue,
                borderRadius: 'var(--rr-buton-kose)',
                padding: '12px 14px',
              }}
            >
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label htmlFor="ad" style={label}>
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
                  style={kilit.ad ? kilitli : field}
                />
              </div>
              <div>
                <label htmlFor="soyad" style={label}>
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
                  style={kilit.soyad ? kilitli : field}
                />
              </div>
            </div>
            <label htmlFor="eposta" style={{ ...label, marginTop: 14 }}>
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
              style={kilit.eposta ? kilitli : field}
            />
            {google ? null : (
              <>
                <label htmlFor="sifre" style={{ ...label, marginTop: 14 }}>
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
                  style={field}
                />
                <p id="sifre-not" style={{ margin: '6px 0 0', fontSize: 12.5, color: colors.muted }}>
                  En az 8 karakter; içinde harf ve rakam olsun.
                </p>
              </>
            )}
            <label htmlFor="tel" style={{ ...label, marginTop: 14 }}>
              Cep telefonu
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #D5DAE5',
                  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                  padding: '0 14px',
                  fontSize: 15,
                  fontWeight: 700,
                  background: '#F3F5FA',
                }}
              >
                +90
              </span>
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
                style={{ ...field, flex: 1, minWidth: 0, letterSpacing: 0.5 }}
              />
            </div>
            <p id="tel-not" style={{ margin: '6px 0 0', fontSize: 12.5, color: colors.muted }}>
              Numarana bir kez doğrulama kodu göndereceğiz (WhatsApp). Bir numarayla yalnızca bir hesap
              açılabilir.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '20px 0 22px' }}>
              {ONAYLAR.map((o) => (
                <OnayKutusu
                  key={o.key}
                  checked={onay[o.key]}
                  onChange={(v) => setOnay({ ...onay, [o.key]: v })}
                  style={{ padding: '6px 0', fontSize: 13.5, lineHeight: 1.5, color: colors.inkSoft }}
                >
                  {o.text}
                </OnayKutusu>
              ))}
            </div>
            <button type="submit" disabled={busy} aria-disabled={!zorunlu} style={primary(zorunlu)}>
              {busy ? 'Gönderiliyor…' : 'Devam et'}
            </button>
            <Hata>{error}</Hata>
          </form>
        </>
      ) : null}

      {step === 2 && kod ? (
        <form onSubmit={adim2}>
          <h1 id="form-baslik" style={h1}>
            Telefonunu doğrula
          </h1>
          <p style={lead}>
            +90 {showPhone(phone)} {kodMetni}{' '}
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              style={linkButton}
            >
              Bilgileri değiştir
            </button>
          </p>
          <label htmlFor="kod" style={label}>
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
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: `1.5px solid ${colors.blue}`,
              borderRadius: 'var(--rr-buton-kose)',
              padding: 16,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 10,
              textAlign: 'center',
              fontFamily: 'inherit',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '12px 0 22px',
              fontSize: 13.5,
            }}
          >
            <span style={{ color: colors.muted }}>
              {kalan > 0 ? `Kod ${sure} içinde geçerli` : 'Kodun süresi doldu'}
            </span>
            <button
              type="button"
              onClick={tekrarGonder}
              disabled={busy}
              style={{ ...linkButton, color: colors.muted, fontSize: 13.5, padding: '6px 0' }}
            >
              Kodu tekrar gönder
            </button>
          </div>
          {kod.devCode && kod.kanal !== 'ekran' ? (
            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: colors.muted }}>
              Geliştirme ortamı: kod gönderilmedi, {kod.devCode} kutuya yazıldı.
            </p>
          ) : null}
          <button type="submit" disabled={busy || code.length !== 6} style={primary(code.length === 6)}>
            {busy ? 'Doğrulanıyor…' : 'Doğrula ve üye ol'}
          </button>
          <Hata>{error}</Hata>
          <p style={note}>Kodu kimseyle paylaşma; Rengarenk çalışanları kodunu asla sormaz.</p>
        </form>
      ) : null}

      {step === 3 ? (
        <div>
          <h1 id="form-baslik" style={h1}>
            Hoş geldin, {ad}!
          </h1>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              background: tints.green,
              borderRadius: 'var(--rr-buton-kose)',
              padding: '14px 16px',
              margin: '14px 0 12px',
            }}
          >
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
            <span style={{ fontSize: 14, color: '#11683F', fontWeight: 600 }}>
              Telefon numaran doğrulandı. 1 ücretsiz talep hakkın hazır.
            </span>
          </div>
          {google ? null : (
            <p style={{ ...lead, margin: '0 0 22px' }}>
              {eposta} adresine bir doğrulama bağlantısı gönderdik; bildirimleri e-postayla almak için
              bağlantıya bas.
            </p>
          )}
          <button type="button" onClick={() => router.push(sonra ?? '/talep-olustur')} style={primary(true)}>
            İlk talebimi oluştur
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{ ...linkButton, display: 'block', width: '100%', textAlign: 'center', marginTop: 12 }}
          >
            Önce taleplere göz at
          </button>
        </div>
      ) : null}
    </GirisDuzeni>
  );
}
