import { describe, expect, it } from 'vitest';
import { MemorySmsSender } from '../src/sms/console.sender.js';
import { FailoverSmsSender } from '../src/sms/failover.sender.js';
import { IletiMerkeziSender } from '../src/sms/iletimerkezi.sender.js';
import { SmsError } from '../src/sms/sms.js';

describe('ana ve yedek SMS', () => {
  it('ana sağlayıcı hata verirse aynı mesaj yedekle gider', async () => {
    const a = new MemorySmsSender('ana');
    const b = new MemorySmsSender('yedek');
    const f = new FailoverSmsSender(a, b);
    a.failNext = 1;
    expect((await f.send('+905321112233', 'kod 123456')).provider).toBe('yedek');
    expect((await f.send('+905321112233', 'kod 654321')).provider).toBe('ana');
  });

  it('art arda 3 hatada ana sağlayıcı bir süre devre dışı kalır, sonra yeniden denenir', async () => {
    let t = 0;
    const a = new MemorySmsSender('ana');
    const b = new MemorySmsSender('yedek');
    const f = new FailoverSmsSender(a, b, { failureThreshold: 3, cooldownMs: 60_000, now: () => t });
    a.failNext = 3;
    for (let i = 0; i < 3; i++) await f.send('+905321112233', 'x');
    expect(f.primaryDisabled).toBe(true);
    await f.send('+905321112233', 'y');
    expect(a.sent).toHaveLength(0);
    t = 61_000;
    expect((await f.send('+905321112233', 'z')).provider).toBe('ana');
  });

  it('kalıcı hatada (geçersiz numara) yedeğe geçmez', async () => {
    const a = { name: 'ana', send: async () => Promise.reject(new SmsError('kod 466', 'ana', true)) };
    const b = new MemorySmsSender('yedek');
    await expect(new FailoverSmsSender(a, b).send('+905321112233', 'x')).rejects.toThrow('466');
    expect(b.sent).toHaveLength(0);
  });
});

describe('İleti Merkezi', () => {
  const ok = { response: { status: { code: 200, message: 'İşlem başarılı' }, order: { id: '312891245' } } };

  it('belgedeki istek biçimini gönderir ve sipariş numarasını döndürür', async () => {
    let sent: { url: string; body: unknown } | undefined;
    const fake = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify(ok), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await new IletiMerkeziSender('k', 'h', 'RENGARENK', fake).send('+905321112233', 'kod 123456');
    expect(r.messageId).toBe('312891245');
    expect(sent?.url).toBe('https://api.iletimerkezi.com/v1/send-sms/json');
    expect(sent?.body).toEqual({
      request: {
        authentication: { key: 'k', hash: 'h' },
        order: {
          sender: 'RENGARENK',
          iys: '0',
          message: { text: 'kod 123456', receipents: { number: ['905321112233'] } },
        },
      },
    });
  });

  it('401 geçici, 466 kalıcı hata sayılır', async () => {
    const reply = (code: number) =>
      (async () =>
        new Response(JSON.stringify({ response: { status: { code, message: 'x' } } }), {
          status: 200,
        })) as unknown as typeof fetch;
    const e401 = await new IletiMerkeziSender('k', 'h', 'R', reply(401))
      .send('+905321112233', 'x')
      .catch((e) => e);
    const e466 = await new IletiMerkeziSender('k', 'h', 'R', reply(466))
      .send('+905321112233', 'x')
      .catch((e) => e);
    expect(e401).toBeInstanceOf(SmsError);
    expect(e401.permanent).toBe(false);
    expect(e466.permanent).toBe(true);
  });
});
