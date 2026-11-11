import { loadEnv } from '../config/env.js';
import { IletiMerkeziSender } from '../sms/iletimerkezi.sender.js';
import { SmsError } from '../sms/sms.js';

/**
 * İleti Merkezi'ni API'yi açmadan dener (yalnızca yerel). Bakiye ve gönderici başlıklarını sorar; numara verilirse o
 * numaraya bir deneme SMS'i gönderir (bakiyeden düşer). Anahtar ve hash ekrana yazılmaz.
 *
 *   pnpm --filter @rengarenk/api sms:dene                 hesap durumu (SMS gitmez)
 *   pnpm --filter @rengarenk/api sms:dene 05XXXXXXXXX     deneme SMS'i
 */
const env = loadEnv();
if (!env.ILETIMERKEZI_KEY || !env.ILETIMERKEZI_HASH) {
  console.error('.env içinde ILETIMERKEZI_KEY ve ILETIMERKEZI_HASH olmalı');
  process.exit(1);
}
const auth = { authentication: { key: env.ILETIMERKEZI_KEY, hash: env.ILETIMERKEZI_HASH } };
async function sor(yol: string) {
  const r = await fetch(`https://api.iletimerkezi.com/v1/${yol}/json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ request: auth }),
    signal: AbortSignal.timeout(10_000),
  });
  return (await r.json()) as {
    response?: {
      status?: { code?: number | string; message?: string };
      balance?: { amount?: number | string; sms?: number | string };
      senders?: { sender?: string[] | string };
    };
  };
}

const bakiye = (await sor('get-balance')).response;
const baslik = (await sor('get-sender')).response;
const basliklar = ([] as string[]).concat(baslik?.senders?.sender ?? []);
console.log(`Hesap: ${bakiye?.status?.message ?? '?'} (kod ${bakiye?.status?.code ?? '?'})`);
console.log(`Bakiye: ${bakiye?.balance?.amount ?? '?'} TL · ${bakiye?.balance?.sms ?? '?'} SMS`);
console.log(`Onaylı gönderici başlıkları: ${basliklar.length ? basliklar.join(', ') : 'yok'}`);
console.log(
  `Ayarlı başlık (SMS_SENDER_ID): ${env.SMS_SENDER_ID}${basliklar.includes(env.SMS_SENDER_ID) ? ' · onaylı' : ' · listede yok'}`,
);

const numara = process.argv[2];
if (numara) {
  const e164 = `+90${numara.replace(/\D/g, '').replace(/^(90|0)/, '')}`;
  const s = new IletiMerkeziSender(env.ILETIMERKEZI_KEY, env.ILETIMERKEZI_HASH, env.SMS_SENDER_ID);
  try {
    const r = await s.send(e164, 'TEST Rengarenk deneme mesajı: SMS bağlantısı çalışıyor.');
    console.log(`Gönderildi · sipariş no ${r.messageId ?? '?'}`);
  } catch (err) {
    const e = err as SmsError;
    console.log(`Gönderilemedi: ${e.message}${e.permanent ? ' (kalıcı hata)' : ''}`);
  }
}
