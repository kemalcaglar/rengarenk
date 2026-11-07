import { describe, expect, it } from 'vitest';
import { maskTrMobile, normalizeTrMobile } from './phone.js';

describe('normalizeTrMobile', () => {
  it.each([
    ['0532 123 45 67', '+905321234567'],
    ['+90 (532) 123-45-67', '+905321234567'],
    ['905321234567', '+905321234567'],
    ['5321234567', '+905321234567'],
    ['00905321234567', '+905321234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTrMobile(input)).toBe(expected);
  });

  it.each(['0212 123 45 67', '12345', '0532 123 45', ''])('geçersiz: %s', (input) => {
    expect(normalizeTrMobile(input)).toBeNull();
  });
});

describe('maskTrMobile', () => {
  it('yalnızca son iki haneyi gösterir', () => {
    expect(maskTrMobile('+905321234567')).toBe('0 (5XX) XXX XX 67');
  });
});
