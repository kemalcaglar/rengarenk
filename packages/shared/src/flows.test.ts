import { describe, expect, it } from 'vitest';
import { flowEditSchema, flowStepText, flowVariables } from './notifications.js';

describe('Akış düzenleyicisi (Karar 51)', () => {
  it('adımları konsol satırına çevirir', () => {
    expect(flowStepText({ tip: 'bekle', saat: 48 }).baslik).toBe('2 gün');
    expect(flowStepText({ tip: 'bekle', saat: 6 }).baslik).toBe('6 saat');
    expect(flowStepText({ tip: 'kosul', kosul: 'okunmadi' })).toMatchObject({
      tip: 'Koşul',
      baslik: 'Önceki ileti okunmadıysa',
    });
    expect(
      flowStepText({
        tip: 'ileti',
        baslik: 'Talebin yarın doluyor',
        metin: 'Uzatmak için dokun',
        dugme: 'Uzat',
        kanallar: ['uygulama', 'eposta'],
      }).baslik,
    ).toBe('Uygulama içi ve push, e-posta: “Talebin yarın doluyor”');
  });

  it('değişkenler akışın ilk iletisinden gelir; SMS bağlantısı dahil değil', () => {
    expect(flowVariables('doluyor')).toEqual(expect.arrayContaining(['ad', 'talep', 'gun', 'yazan']));
    expect(flowVariables('doluyor')).not.toContain('link');
    expect(flowVariables('hosgeldin')).toEqual(['ad']);
  });

  it('SMS kanalı ve 30 günden uzun bekleme reddedilir', () => {
    const ileti = { tip: 'ileti', baslik: 'Başlık', metin: 'Metin', dugme: 'Aç' };
    expect(flowEditSchema.safeParse({ adimlar: [{ ...ileti, kanallar: ['sms'] }] }).success).toBe(false);
    expect(flowEditSchema.safeParse({ adimlar: [{ ...ileti, kanallar: [] }] }).success).toBe(false);
    expect(flowEditSchema.safeParse({ adimlar: [{ tip: 'bekle', saat: 721 }] }).success).toBe(false);
    expect(flowEditSchema.safeParse({ adimlar: [{ tip: 'bekle', saat: 24 }] }).success).toBe(true);
  });
});
