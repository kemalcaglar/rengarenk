/**
 * Makyaja göre temsilî fotoğraf (Karar 34: nesil ve makyaj başına). Önce istenen makyajın fotoğrafı, yoksa nesil
 * geneli, o da yoksa aynı neslin en erken makyajı. Talep sayfası, liste ve seri ayrıntısı aynı kuralı kullanır.
 */
export function makyajFoto<T extends { facelift: number | null }>(
  list: readonly T[],
  makyaj: number | null | undefined,
): T | undefined {
  if (!list.length) return undefined;
  const m = makyaj ?? 0;
  return (
    list.find((f) => f.facelift === m) ??
    list.find((f) => f.facelift === null) ??
    [...list].sort((a, b) => (a.facelift ?? 0) - (b.facelift ?? 0))[0]
  );
}
