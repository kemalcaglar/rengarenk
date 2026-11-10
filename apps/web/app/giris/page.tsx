'use client';

import { tints } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { OnayKutusu } from '../../components/onay-kutusu';
import { olcumOlayi, temasGonder } from '../../lib/olcum';
import { colors } from '../../lib/renk';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function post<T>(path: string, body: object): Promise<T> {
  const r = await fetch(path.startsWith('/api/') ? path : `${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = data as { message?: string | string[]; issues?: { message: string }[] };
    throw new Error(
      m.issues?.[0]?.message ??
        (Array.isArray(m.message) ? m.message[0] : m.message) ??
        'Bir şeyler ters gitti',
    );
  }
  return data as T;
}

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

const AVANTAJLAR = [
  { text: 'İlk talebin ücretsiz', bg: tints.blue, dot: colors.blue },
  { text: 'Her gün 5 farklı talebe ücretsiz yaz', bg: tints.pink, dot: colors.pink },
  { text: 'Numaran yalnızca izin verirsen görünür', bg: tints.yellow, dot: colors.yellow },
  { text: 'Şifre yok: SMS koduyla giriş', bg: tints.green, dot: colors.green },
];

const label = { display: 'block', fontSize: 13.5, fontWeight: 700, marginBottom: 6 } as const;
const h1 = { margin: '0 0 6px', fontSize: 26, fontWeight: 800 } as const;
const lead = { margin: '0 0 22px', fontSize: 14.5, color: colors.muted } as const;
const primary = (enabled = true) =>
  ({
    width: '100%',
    border: 0,
    background: enabled ? colors.blue : '#C9CFDB',
    borderRadius: 'var(--rr-buton-kose)',
    padding: 15,
    fontSize: 16,
    fontWeight: 800,
    color: enabled ? 'var(--rr-maviYazi, #1E2333)' : colors.ink,
    cursor: enabled ? 'pointer' : 'default',
    fontFamily: 'inherit',
  }) as const;
const note = { margin: '12px 0 0', fontSize: 12.5, color: colors.muted } as const;
const field = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #D5DAE5',
  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
  padding: 13,
  fontSize: 15,
  fontFamily: 'inherit',
} as const;

/** "5321234567" → "5XX 123 45 67" biçiminde gösterim için */
const showPhone = (digits: string) => {
  const d = digits.replace(/\D/g, '').replace(/^(90|0)/, '');
  return d.replace(/^(\d{3})(\d{3})(\d{2})(\d{2}).*$/, '$1 $2 $3 $4');
};

/**
 * Giriş yap veya üye ol (Karar 18, T09; tasarım: Giris.dc.html). Adımlar: telefon ve onaylar → SMS kodu → ad
 * (yalnızca yeni üyede). Yenileme jetonu httpOnly çerezde (lib/oturum.ts); onaylar sürümüyle kaydedilir (Karar 59).
 */
export default function Giris() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState('');
  const [onay, setOnay] = useState<Record<OnayKey, boolean>>({
    kullanimKosullari: false,
    kvkkAydinlatma: false,
    ticariIleti: false,
    reklamOlcum: false,
  });
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [access, setAccess] = useState<string | null>(null);
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hedef, setHedef] = useState('/');
  // Giriş isteyen sayfadan gelindiyse (ör. talep sihirbazı) girişten sonra oraya dönülür.
  const [sonra, setSonra] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('sonra');
    if (q?.startsWith('/') && !q.startsWith('//')) setSonra(q);
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  const zorunlu = onay.kullanimKosullari && onay.kvkkAydinlatma;
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

  const kodIste = () =>
    run(async () => {
      const r = await post<{ challengeId: string; expiresIn: number; devCode?: string }>(
        '/auth/otp/request',
        {
          phone: `+90${phone.replace(/\D/g, '').replace(/^(90|0)/, '')}`,
        },
      );
      setChallengeId(r.challengeId);
      setExpiresAt(Date.now() + r.expiresIn * 1000);
      setNow(Date.now());
      // Yalnızca yerel geliştirmede API kodu döndürür (SMS gönderilmez).
      setDevCode(r.devCode ?? null);
      setCode(r.devCode ?? '');
      setStep(2);
    });

  function adim1(e: FormEvent) {
    e.preventDefault();
    if (zorunlu) kodIste();
  }

  function adim2(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const r = await post<{ accessToken: string; isNewUser?: boolean }>('/api/oturum/dogrula', {
        challengeId,
        code,
        consents: onay,
      });
      // Reklam ölçümü (Karar 35): temaslar üyeye bağlanır; yeni üyelik olayı sunucuyla aynı kimlikle
      void temasGonder();
      if (!r.isNewUser) {
        router.push(sonra ?? '/');
        return;
      }
      if (challengeId) olcumOlayi('CompleteRegistration', challengeId);
      setAccess(r.accessToken);
      setStep(3);
    });
  }

  function adim3(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const r = await fetch(`${API}/me`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` },
        body: JSON.stringify({ firstName: ad, lastName: soyad }),
      });
      if (!r.ok) {
        const m = (await r.json().catch(() => ({}))) as { issues?: { message: string }[]; message?: string };
        throw new Error(m.issues?.[0]?.message ?? m.message ?? 'Adın kaydedilemedi');
      }
      router.push(hedef);
    });
  }

  const hata = error ? (
    <p role="alert" style={{ margin: '12px 0 0', fontSize: 13.5, fontWeight: 700, color: '#A3271F' }}>
      {error}
    </p>
  ) : null;

  return (
    <main
      style={{
        flex: 1,
        maxWidth: 1100,
        width: '100%',
        boxSizing: 'border-box',
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        gap: 24,
      }}
    >
      <section
        style={{
          flex: '1 1 380px',
          minWidth: 0,
          background: colors.surface,
          border: `1px solid ${colors.line}`,
          borderRadius: 'calc(var(--rr-kart-kose) * 24 / 18)',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
        aria-labelledby="neden"
      >
        <h2
          id="neden"
          style={{ margin: 0, fontSize: 28, lineHeight: 1.2, fontWeight: 800, letterSpacing: -0.5 }}
        >
          Tek telefon numarasıyla hem al hem sat.
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {AVANTAJLAR.map((a) => (
            <div
              key={a.text}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                background: a.bg,
                borderRadius: 'calc(var(--rr-kart-kose) * 16 / 18)',
                padding: '14px 16px',
              }}
            >
              <span
                style={{ width: 12, height: 12, borderRadius: '50%', background: a.dot, flex: 'none' }}
                aria-hidden="true"
              />
              <span style={{ fontSize: 15, fontWeight: 600 }}>{a.text}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', borderTop: '1px solid #EEF0F5', paddingTop: 16 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>
            Galeri, kiralama firması veya tekne galerisi misin?
          </p>
          <Link
            href="/kurumsal-basvuru"
            style={{ display: 'inline-block', marginTop: 6, fontSize: 14.5, fontWeight: 700 }}
          >
            Kurumsal hesap başvurusu yap
          </Link>
        </div>
      </section>

      <section
        style={{
          flex: '1 1 420px',
          minWidth: 0,
          background: colors.surface,
          border: `1px solid ${colors.line}`,
          borderRadius: 'calc(var(--rr-kart-kose) * 24 / 18)',
          padding: 32,
        }}
        aria-labelledby="form-baslik"
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }} aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 'calc(var(--rr-buton-kose) * 3 / 14)',
                background: step >= n ? colors.blue : colors.line,
                color: step >= n ? 'var(--rr-maviYazi, #1E2333)' : undefined,
              }}
            />
          ))}
        </div>

        {step === 1 ? (
          <form onSubmit={adim1}>
            <h1 id="form-baslik" style={h1}>
              Giriş yap veya üye ol
            </h1>
            <p style={lead}>Telefon numarana bir doğrulama kodu göndereceğiz.</p>
            <label htmlFor="tel" style={label}>
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
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: `1.5px solid ${colors.blue}`,
                  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                  padding: 14,
                  fontSize: 16,
                  letterSpacing: 0.5,
                  fontFamily: 'inherit',
                }}
              />
            </div>
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
              {busy ? 'Gönderiliyor…' : 'Kod gönder'}
            </button>
            {hata}
            <p style={note}>Bir telefon numarasıyla yalnızca bir bireysel hesap açılabilir.</p>
          </form>
        ) : null}

        {step === 2 ? (
          <form onSubmit={adim2}>
            <h1 id="form-baslik" style={h1}>
              Kodu gir
            </h1>
            <p style={lead}>
              +90 {showPhone(phone)} numarasına 6 haneli kod gönderdik.{' '}
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: colors.link,
                  fontWeight: 700,
                  fontSize: 14.5,
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Numarayı değiştir
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
                onClick={kodIste}
                disabled={busy}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: colors.muted,
                  fontWeight: 700,
                  fontSize: 13.5,
                  padding: '6px 0',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Kodu tekrar gönder
              </button>
            </div>
            {devCode ? (
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: colors.muted }}>
                Geliştirme ortamı: SMS gönderilmedi, kod {devCode} kutuya yazıldı.
              </p>
            ) : null}
            <button type="submit" disabled={busy || code.length !== 6} style={primary(code.length === 6)}>
              {busy ? 'Doğrulanıyor…' : 'Doğrula'}
            </button>
            {hata}
            <p style={note}>
              rengarenk sana kodu yalnızca "RENGARENK" gönderici adıyla SMS olarak iletir; kodu kimseyle
              paylaşma.
            </p>
          </form>
        ) : null}

        {step === 3 ? (
          <form onSubmit={adim3}>
            <h1 id="form-baslik" style={h1}>
              Son adım: adın
            </h1>
            <p style={lead}>Adın ve soyadın taleplerinde ve mesajlarında görünür.</p>
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
                  required
                  style={field}
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
                  required
                  style={field}
                />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                background: tints.green,
                borderRadius: 'var(--rr-buton-kose)',
                padding: '14px 16px',
                margin: '20px 0 22px',
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
            <button
              type="submit"
              disabled={busy}
              onClick={() => setHedef(sonra ?? '/talep-olustur')}
              style={primary(true)}
            >
              {busy && hedef !== '/' ? 'Kaydediliyor…' : 'İlk talebimi oluştur'}
            </button>
            <button
              type="submit"
              disabled={busy}
              onClick={() => setHedef('/')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'center',
                marginTop: 12,
                border: 0,
                background: 'transparent',
                fontSize: 14.5,
                fontWeight: 700,
                color: colors.link,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Önce taleplere göz at
            </button>
            {hata}
          </form>
        ) : null}
      </section>
    </main>
  );
}
