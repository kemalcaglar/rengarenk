import { describe, expect, it } from 'vitest';
import { sesBasliklari } from '../src/notifications/channels.js';

describe('E-posta kanalı (Karar 50)', () => {
  const env = {
    SES_YAPILANDIRMA_ISLEMSEL: 'rengarenk-islemsel',
    SES_YAPILANDIRMA_TICARI: 'rengarenk-ticari',
  };

  it('işlemsel ve ticari e-posta ayrı SES yapılandırma kümesinden çıkar', () => {
    expect(sesBasliklari(env, {})).toEqual({ 'X-SES-CONFIGURATION-SET': 'rengarenk-islemsel' });
    expect(sesBasliklari(env, { akis: 'islemsel' })).toEqual({
      'X-SES-CONFIGURATION-SET': 'rengarenk-islemsel',
    });
    expect(sesBasliklari(env, { akis: 'ticari' })).toEqual({ 'X-SES-CONFIGURATION-SET': 'rengarenk-ticari' });
  });

  it('küme tanımlı değilse başlık eklenmez (yerelde Mailpit)', () => {
    expect(sesBasliklari({}, { akis: 'ticari' })).toEqual({});
  });
});
