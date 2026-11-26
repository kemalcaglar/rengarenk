'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import {
  Ayrac,
  Bilgi,
  GirisDuzeni,
  GoogleDugmesi,
  Hata,
  post,
  primary,
  sonraAdresi,
} from '../../components/giris-ui';
import { temasGonder } from '../../lib/olcum';
import stil from './page.module.css';

/** Google dönüşünden gelen hata kodları */
const GOOGLE_HATA: Record<string, string> = {
  google: 'Google girişi tamamlanamadı, yeniden dene.',
  google_iptal: 'Google girişi iptal edildi.',
  google_eposta: 'Bu e-postayla bir hesap var. E-posta ve şifrenle giriş yap.',
  google_kapali: 'Google ile giriş şu an kapalı; e-posta ve şifrenle devam et.',
};

/**
 * Giriş yap (Karar 18, 12 Kasım 2026): e-posta ve şifreyle ya da Google ile. Girişte telefon kodu istenmez; telefon
 * üyelikte bir kez doğrulanır. Yenileme jetonu httpOnly çerezde (lib/oturum.ts).
 */
export default function Giris() {
  const router = useRouter();
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [goster, setGoster] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [sonra, setSonra] = useState<string | null>(null);

  useEffect(() => {
    setSonra(sonraAdresi());
    const q = new URLSearchParams(window.location.search);
    const h = q.get('hata');
    if (h) setError(GOOGLE_HATA[h] ?? GOOGLE_HATA.google ?? null);
    if (q.get('sifre') === 'yenilendi') setBilgi('Şifren değişti. Yeni şifrenle giriş yapabilirsin.');
  }, []);

  function gir(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    post('/api/oturum/giris', { eposta, sifre })
      .then(() => {
        // Reklam ölçümü (Karar 35): temaslar üyeye bağlanır
        void temasGonder();
        router.push(sonra ?? '/');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  }

  const uyeOl = `/uye-ol${sonra ? `?sonra=${encodeURIComponent(sonra)}` : ''}`;
  return (
    <GirisDuzeni baslikId="form-baslik">
      <h1 id="form-baslik" className={stil.baslik1}>
        Giriş yap
      </h1>
      <p className={stil.metin1}>
        Hesabın yok mu?{' '}
        <Link href={uyeOl} className={stil.bag1}>
          Üye ol
        </Link>
      </p>
      <Bilgi>{bilgi}</Bilgi>
      <GoogleDugmesi sonra={sonra} />
      <Ayrac />
      <form onSubmit={gir}>
        <label htmlFor="eposta" className={stil.etiket1}>
          E-posta
        </label>
        <input
          id="eposta"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={eposta}
          onChange={(e) => setEposta(e.target.value)}
          required
          className={stil.girdi1}
        />
        <div className={stil.kutu1}>
          <label htmlFor="sifre" className={stil.etiket1}>
            Şifre
          </label>
          <Link href="/sifremi-unuttum" className={stil.bag2}>
            Şifremi unuttum
          </Link>
        </div>
        <div className={stil.kutu2}>
          <input
            id="sifre"
            type={goster ? 'text' : 'password'}
            autoComplete="current-password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            required
            className={stil.girdi2}
          />
          <button
            type="button"
            onClick={() => setGoster(!goster)}
            aria-pressed={goster}
            className={stil.dugme1}
          >
            {goster ? 'Gizle' : 'Göster'}
          </button>
        </div>
        <button type="submit" disabled={busy} style={{ ...primary(true), marginTop: 20 }}>
          {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
        <Hata>{error}</Hata>
        <p className={stil.metin2}>Google ile üye olduysan "Google ile devam et"i kullan.</p>
      </form>
    </GirisDuzeni>
  );
}
