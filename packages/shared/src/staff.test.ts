import { describe, expect, it } from 'vitest';
import {
  APPROVAL_POLICIES,
  customRoleSchema,
  maskEmail,
  maskIp,
  PERMISSION_KEYS,
  ROLE_GRANTS,
  satisfies,
  totpCodeSchema,
} from './staff.js';

describe('izin matrisi (Karar 40, tasarım: Roller ve yetkiler)', () => {
  it('Sahip her yetkiye tam sahiptir; çalışan yönetimi yalnızca Sahip’tedir', () => {
    for (const k of PERMISSION_KEYS) expect(ROLE_GRANTS.OWNER[k]).toBe('tam');
    for (const [role, g] of Object.entries(ROLE_GRANTS)) {
      if (role !== 'OWNER') expect(g['ekip.yonet']).toBeUndefined();
    }
  });

  it('tasarımdaki hücrelerle aynıdır', () => {
    expect(ROLE_GRANTS.ADMIN['fiyat.degistir']).toBe('oneri');
    expect(ROLE_GRANTS.ADMIN.toplu_gonderim).toBe('onay');
    expect(ROLE_GRANTS.SUPPORT['kisisel_veri.gor']).toBe('maskeli');
    expect(ROLE_GRANTS.MARKETING['kisisel_veri.gor']).toBeUndefined();
    expect(ROLE_GRANTS.VIEWER['islem_kaydi.gor']).toBe('tam');
    expect(ROLE_GRANTS.AGENT['hesap.kalici_engelle']).toBe('oneri');
    expect(ROLE_GRANTS.AGENT.iade).toBe('oneri');
  });

  it('iadeyi yalnızca Sahip onaylar; ajan hiçbir türü onaylayamaz', () => {
    expect(APPROVAL_POLICIES.REFUND.approvers).toEqual(['OWNER']);
    for (const p of Object.values(APPROVAL_POLICIES)) expect(p.approvers).not.toContain('AGENT');
  });

  it('düzey karşılaştırması', () => {
    expect(satisfies('tam', 'oneri')).toBe(true);
    expect(satisfies('oneri', 'tam')).toBe(false);
    expect(satisfies('maskeli', 'maskeli')).toBe(true);
    expect(satisfies(undefined, 'maskeli')).toBe(false);
  });

  it('özel role sahibe ait yetki verilemez', () => {
    expect(
      customRoleSchema.safeParse({ name: 'X rolü', permissions: { 'ekip.yonet': 'onay' } }).success,
    ).toBe(false);
    expect(customRoleSchema.safeParse({ name: 'X rolü', permissions: { iade: 'tam' } }).success).toBe(false);
    expect(customRoleSchema.safeParse({ name: 'X rolü', permissions: { iade: 'oneri' } }).success).toBe(true);
  });
});

describe('yardımcılar', () => {
  it('kod biçimleri', () => {
    expect(totpCodeSchema.parse(' 123 456 ')).toBe('123456');
    expect(totpCodeSchema.parse('ABCD-EFGH')).toBe('abcdefgh');
    expect(totpCodeSchema.safeParse('12345').success).toBe(false);
  });

  it('maskeleme', () => {
    expect(maskEmail('selin.demir@rengarenksite.com')).toBe('se•••••••••@rengarenksite.com');
    expect(maskIp('85.105.12.4')).toBe('85.105.•.•');
  });
});
