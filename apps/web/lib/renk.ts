import { colors as sabit } from '@rengarenk/shared';

/**
 * Web renkleri (Karar 46): paletin düzenlenebilen sekiz rengi CSS değişkeni olarak (değerleri kök düzen yayındaki
 * tasarım değerlerinden `:root`'a yazar; değişken yoksa varsayılan). Diğerleri sabit. SVG niteliklerinde
 * (`stroke=`, `fill=`) CSS değişkeni çalışmaz; orada `style` kullan.
 */
export const colors = {
  ...sabit,
  blue: 'var(--rr-mavi, #5B8CFF)',
  pink: 'var(--rr-pembe, #FF6FB5)',
  yellow: 'var(--rr-sari, #FFC84A)',
  green: 'var(--rr-yesil, #3DD68C)',
  ink: 'var(--rr-murekkep, #1E2333)',
  link: 'var(--rr-baglanti, #2450C8)',
  background: 'var(--rr-zemin, #F6F8FD)',
  line: 'var(--rr-cizgi, #E3E6EF)',
} as const;
