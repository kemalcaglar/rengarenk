import { colors as sabit } from '@rengarenk/shared';

/**
 * Web renkleri (Karar 46): düzenlenebilen renkler CSS değişkeni olarak (değerleri kök düzen yayındaki
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
  muted: 'var(--rr-soluk, #5A6073)',
  surface: 'var(--rr-kart, #FFFFFF)',
  onBlue: 'var(--rr-maviYazi, #1E2333)',
  onPink: 'var(--rr-pembeYazi, #1E2333)',
  onYellow: 'var(--rr-sariYazi, #1E2333)',
  onGreen: 'var(--rr-yesilYazi, #1E2333)',
} as const;
