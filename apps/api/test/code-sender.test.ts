import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { AppleJwksVerifier } from '../src/auth/user-identity.js';
import { ChannelCodeSender, WhatsAppCodeSender } from '../src/sms/code-sender.js';
import { MemorySmsSender } from '../src/sms/console.sender.js';
import { SmsError } from '../src/sms/sms.js';

describe('telefon doğrulama kodu kanalları (Karar 18)', () => {
  it('WhatsApp kimlik doğrulama şablonu: kod gövdede ve kopyala düğmesinde, numara + işaretsiz', async () => {
    const istekler: { url: string; body: Record<string, unknown>; auth: string }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      istekler.push({
        url,
        body: JSON.parse(String(init.body)),
        auth: (init.headers as Record<string, string>).authorization ?? '',
      });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const wa = new WhatsAppCodeSender('jeton', '123456', 'rengarenk_kod', 'tr', 'v23.0', fetchFn);
    expect(await wa.send('+905321112233', '482913')).toEqual({ messageId: 'wamid.1' });
    expect(istekler[0]?.url).toBe('https://graph.facebook.com/v23.0/123456/messages');
    expect(istekler[0]?.auth).toBe('Bearer jeton');
    expect(istekler[0]?.body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '905321112233',
      type: 'template',
      template: {
        name: 'rengarenk_kod',
        language: { code: 'tr' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: '482913' }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482913' }] },
        ],
      },
    });
  });

  it('WhatsApp reddederse SMS yedeği; numara geçersizse yedek denenmez', async () => {
    const sms = new MemorySmsSender();
    const red = {
      name: 'whatsapp',
      send: async () => {
        throw new Error('131026');
      },
    };
    const k = new ChannelCodeSender(['whatsapp', 'sms'], sms, red);
    expect(await k.send('+905321112233', '123456')).toEqual({ kanal: 'sms', provider: 'test' });
    expect(sms.lastCode('+905321112233')).toBe('123456');

    const tamam = new ChannelCodeSender(['whatsapp', 'sms'], sms, {
      name: 'whatsapp',
      send: async () => ({}),
    });
    expect((await tamam.send('+905321112244', '654321')).kanal).toBe('whatsapp');
    expect(sms.lastCode('+905321112244')).toBeUndefined();

    const kalici = {
      name: 'whatsapp',
      send: async () => {
        throw new SmsError('geçersiz numara', 'whatsapp', true);
      },
    };
    await expect(
      new ChannelCodeSender(['whatsapp', 'sms'], sms, kalici).send('+905321112255', '1'),
    ).rejects.toThrow('geçersiz numara');
    expect(sms.sent.some((m) => m.to === '+905321112255')).toBe(false);
  });

  it('şifre özeti: scrypt, tuzlu; yanlış şifre ve bozuk özet eşleşmez', async () => {
    const a = await hashPassword('Deneme1234');
    const b = await hashPassword('Deneme1234');
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword('Deneme1234', a)).toBe(true);
    expect(await verifyPassword('deneme1234', a)).toBe(false);
    expect(await verifyPassword('Deneme1234', 'bozuk')).toBe(false);
  });
});

describe('Apple ile giriş: kimlik jetonu doğrulaması', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
  const fetchFn = (async () =>
    new Response(JSON.stringify({ keys: [jwk] }), { status: 200 })) as unknown as typeof fetch;
  const jeton = (claims: Record<string, unknown>, kid = 'k1') => {
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url');
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const s = sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url');
    return `${h}.${p}.${s}`;
  };
  const gecerli = {
    iss: 'https://appleid.apple.com',
    aud: 'tr.com.rengarenk.app',
    exp: Math.floor(Date.now() / 1000) + 600,
    sub: '001234.abc',
    email: 'Gizli@PrivateRelay.AppleID.com',
    email_verified: 'true',
  };

  it('imza, yayıncı, hedef kitle ve süre denetlenir', async () => {
    const v = new AppleJwksVerifier(['tr.com.rengarenk.app'], fetchFn);
    expect(await v.verify(jeton(gecerli))).toEqual({
      sub: '001234.abc',
      email: 'gizli@privaterelay.appleid.com',
      emailVerified: true,
    });
    await expect(v.verify(jeton({ ...gecerli, aud: 'baska.uygulama' }))).rejects.toThrow(
      'bu uygulama için değil',
    );
    await expect(v.verify(jeton({ ...gecerli, iss: 'https://sahte.example' }))).rejects.toThrow('yayıncısı');
    await expect(v.verify(jeton({ ...gecerli, exp: 1 }))).rejects.toThrow('süresi dolmuş');
    const [h, p] = jeton(gecerli).split('.');
    const baskaImza = jeton({ ...gecerli, sub: 'baska' }).split('.')[2];
    await expect(v.verify(`${h}.${p}.${baskaImza}`)).rejects.toThrow('imzası geçersiz');
    await expect(v.verify(jeton(gecerli, 'bilinmeyen'))).rejects.toThrow('anahtarı bulunamadı');
  });
});
