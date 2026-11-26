/**
 * Sınıf adlarını birleştirir; boş, false, null ve undefined atlanır. Hiç sınıf yoksa undefined döner (öğeye boş
 * class niteliği yazılmaz). CSS Modules ile koşullu sınıf: `cx(stil.kart, secili ? stil.secili : undefined)`.
 */
export function cx(...siniflar: (string | false | null | undefined)[]): string | undefined {
  const s = siniflar.filter(Boolean).join(' ');
  return s || undefined;
}
