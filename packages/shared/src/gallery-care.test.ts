import { describe, expect, it } from 'vitest';
import { type CareFigures, churnRisk, renewalOf } from './gallery-care.js';

const now = new Date('2026-11-09T12:00:00Z');
const gun = (n: number) => new Date(now.getTime() + n * 86_400_000);
const saglam: CareFigures = {
  plan: 'profesyonel',
  trialEndsAt: null,
  abonelik: { status: 'ACTIVE', cancelAtPeriodEnd: false, periodEnd: gun(20) },
  ilkMesaj30: 40,
  ilkMesajOnceki30: 35,
  sonGiris: gun(-1),
  portfoy: 25,
};

describe('galeri müşteri yönetimi (Karar 43)', () => {
  it('etkin galeride risk düşük; yenileme otomatik', () => {
    expect(churnRisk(saglam, now)).toEqual({ puan: 0, duzey: 'dusuk', sinyaller: [] });
    expect(renewalOf(saglam)).toEqual({ tarih: gun(20), ne: 'Otomatik yenileme' });
  });

  it('denemesi biten ve hiç mesaj atmayan sessiz galeri yüksek risk; gerekçeler ağırlığa göre', () => {
    const r = churnRisk(
      {
        ...saglam,
        plan: 'deneme',
        trialEndsAt: gun(3),
        abonelik: null,
        ilkMesaj30: 0,
        ilkMesajOnceki30: 0,
        sonGiris: gun(-20),
      },
      now,
    );
    expect(r.duzey).toBe('yuksek');
    expect(r.sinyaller).toEqual(['deneme_bitiyor', 'sessiz', 'deneme_mesajsiz']);
    expect(r.puan).toBe(70);
  });

  it('yenilemeyi kapatan ve mesajları yarıdan fazla düşen galeri; ödemesi alınamayan', () => {
    const r = churnRisk(
      {
        ...saglam,
        abonelik: { status: 'ACTIVE', cancelAtPeriodEnd: true, periodEnd: gun(5) },
        ilkMesaj30: 10,
      },
      now,
    );
    expect(r).toMatchObject({ puan: 50, duzey: 'yuksek', sinyaller: ['yenileme_kapali', 'mesaj_dususu'] });
    expect(
      renewalOf({ ...saglam, abonelik: { status: 'ACTIVE', cancelAtPeriodEnd: true, periodEnd: gun(5) } }),
    ).toMatchObject({ ne: 'Paket sona eriyor' });
    expect(
      churnRisk(
        { ...saglam, abonelik: { status: 'PAST_DUE', cancelAtPeriodEnd: false, periodEnd: gun(-1) } },
        now,
      ),
    ).toMatchObject({ duzey: 'orta', sinyaller: ['odeme_alinamadi'] });
  });
});
