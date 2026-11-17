import { describe, expect, it } from 'vitest';
import { aciklamaDuz, aciklamaParcala, aciklamaSar } from './aciklama.js';
import { BASE_FIELDS, fieldValueSchema } from './category-schema.js';
import { hideDemandDescription } from './moderation.js';

describe('talep açıklaması biçimi (sahip isteği, 17 Kasım 2026)', () => {
  it('kalın, italik, renk ve boyut etiketleri parçalara ayrılır; iç içe etiketler birleşir', () => {
    expect(
      aciklamaParcala('Merhaba [k]kalın [renk=mavi]mavi[/renk][/k] ve [boyut=buyuk]büyük[/boyut]'),
    ).toEqual([
      { metin: 'Merhaba ' },
      { metin: 'kalın ', kalin: true },
      { metin: 'mavi', kalin: true, renk: 'mavi' },
      { metin: ' ve ' },
      { metin: 'büyük', boyut: 'buyuk' },
    ]);
  });

  it('bilinmeyen ya da eşleşmeyen etiket yazı olarak kalır; HTML çalışmaz', () => {
    expect(aciklamaParcala('[renk=fosfor]x[/renk] [/k] <b>y</b>')).toEqual([
      { metin: '[renk=fosfor]x[/renk] [/k] <b>y</b>' },
    ]);
    // Kapanmayan etiket metnin sonuna kadar geçerli
    expect(aciklamaParcala('[i]sonuna kadar')).toEqual([{ metin: 'sonuna kadar', italik: true }]);
  });

  it('düz metin etiketsizdir; sınır düz metne uygulanır', () => {
    expect(aciklamaDuz('[k]Acil[/k] [renk=kirmizi]değil[/renk]')).toBe('Acil değil');
    const f = BASE_FIELDS.find((x) => x.key === 'aciklama');
    if (!f) throw new Error('açıklama alanı yok');
    expect(fieldValueSchema(f).safeParse(`[k]${'a'.repeat(2000)}[/k]`).success).toBe(true);
    expect(fieldValueSchema(f).safeParse('a'.repeat(2001)).success).toBe(false);
  });

  it('seçimi sarar; boş seçimde imleç etiketlerin arasına gelir', () => {
    expect(aciklamaSar('abc def', 4, 7, { e: 'k' })).toEqual({ metin: 'abc [k]def[/k]', bas: 7, son: 10 });
    expect(aciklamaSar('ab', 1, 1, { e: 'renk', d: 'mavi' })).toEqual({
      metin: 'a[renk=mavi][/renk]b',
      bas: 12,
      son: 12,
    });
  });
});

describe('biçimli açıklamada iletişim bilgisi gizlenir', () => {
  it('etiketlerle bölünmüş numara da yakalanır; öyleyse biçim düşer', () => {
    expect(hideDemandDescription('[k]Acil[/k] arayın')).toBe('[k]Acil[/k] arayın');
    expect(hideDemandDescription('Numaram [k]0532[/k] 123 45 67')).toBe('Numaram [numara gizlendi]');
    expect(hideDemandDescription('[renk=mavi]0532 123 45 67[/renk]')).toBe(
      '[renk=mavi][numara gizlendi][/renk]',
    );
  });
});
