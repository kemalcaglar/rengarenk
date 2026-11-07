/**
 * Türkiye cep telefonu numarasını E.164 biçimine çevirir: "0532 123 45 67" → "+905321234567".
 * Geçersizse null döner. Yalnızca 5 ile başlayan cep numaraları kabul edilir (SMS ile doğrulama).
 */
export function normalizeTrMobile(input: string): string | null {
  let d = input.replace(/[^\d+]/g, '');
  if (d.startsWith('+90')) d = d.slice(3);
  else if (d.startsWith('0090')) d = d.slice(4);
  else if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  if (!/^5\d{9}$/.test(d)) return null;
  return `+90${d}`;
}

/** Ekranda gösterim için maskeler: "+905321234567" → "0 (5XX) XXX XX 67" (Karar 58). */
export function maskTrMobile(e164: string): string {
  const last = e164.slice(-2);
  return `0 (5XX) XXX XX ${last}`;
}
