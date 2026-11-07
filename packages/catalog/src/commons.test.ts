import { describe, expect, it } from 'vitest';
import { commonsCandidates, licenseAllowed, photoCaption, plainText, scoreCandidate } from './commons.js';

const page = (title: string, width: number, height: number, license: string, extra = {}) => ({
  title: `File:${title}`,
  imageinfo: [
    {
      url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${title}`,
      thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${title}/1600px-${title}?utm=1`,
      descriptionurl: `https://commons.wikimedia.org/wiki/File:${title}`,
      width,
      height,
      mime: 'image/jpeg',
      extmetadata: {
        LicenseShortName: { value: license },
        Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Vauxford">Vauxford</a>' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
        ...extra,
      },
    },
  ],
});

describe('Commons nesil fotoğrafları (Karar 34)', () => {
  it('yalnızca ticari kullanıma izin veren lisanslar', () => {
    expect(licenseAllowed('CC BY-SA 4.0')).toBe(true);
    expect(licenseAllowed('CC BY 2.0')).toBe(true);
    expect(licenseAllowed('CC0')).toBe(true);
    expect(licenseAllowed('Public domain')).toBe(true);
    expect(licenseAllowed('CC BY-NC-SA 4.0')).toBe(false);
    expect(licenseAllowed('CC BY-ND 2.0')).toBe(false);
    expect(licenseAllowed('GFDL')).toBe(false);
  });

  it('adaylar süzülür ve sıralanır: ön çapraz yatay fotoğraf öne, iç mekân ve küçük dosya elenir ya da geriye', () => {
    const list = commonsCandidates({
      query: {
        pages: [
          page('2019 BMW 330i M Sport Interior.jpg', 4000, 2600, 'CC BY-SA 4.0'),
          page('2019 BMW 320d M Sport Front.jpg', 4031, 2694, 'CC BY-SA 4.0'),
          page('BMW small.jpg', 800, 600, 'CC BY-SA 4.0'),
          page('BMW nc.jpg', 4000, 2600, 'CC BY-NC 2.0'),
          page('2019 BMW 330i Rear.jpg', 4400, 2700, 'CC BY-SA 4.0'),
        ],
      },
    });
    expect(list.map((c) => c.commonsFile)).toEqual([
      '2019 BMW 320d M Sport Front.jpg',
      '2019 BMW 330i Rear.jpg',
      '2019 BMW 330i M Sport Interior.jpg',
    ]);
    expect(list[0]).toMatchObject({ author: 'Vauxford', license: 'CC BY-SA 4.0' });
    expect(list[0]?.sourceUrl).not.toContain('?');
    expect(scoreCandidate('x.jpg', 1000, 2000)).toBeLessThan(0);
  });

  it('atıf metni', () => {
    expect(plainText('<a href="x">Jane &amp; Co</a>  ')).toBe('Jane & Co');
    expect(photoCaption({ author: 'Vauxford', license: 'CC BY-SA 4.0' })).toBe(
      'Fotoğraf: Vauxford · CC BY-SA 4.0 · Wikimedia Commons · temsilî görsel',
    );
  });
});
