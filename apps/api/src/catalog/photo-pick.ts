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

/**
 * Nesilde seçili fotoğraf yoksa aynı serideki en yakın neslin fotoğrafı (Karar 34: "o da yoksa en yakın neslin
 * fotoğrafı 'önceki nesil' etiketiyle"). Önce hedeften önce başlayan en yakın nesil (son makyajı), yoksa sonra başlayan
 * en yakın nesil (ilk makyajı). `nesiller`: serinin nesil kodu satırları.
 */
export function nesilFoto<T extends { facelift: number | null; generationId: string }>(
  nesiller: readonly { id: string; startYear: number }[],
  fotolar: readonly T[],
  hedef: { id?: string; startYear: number | null },
  makyaj: number | null | undefined,
): { foto: T; yakin: 'onceki' | 'sonraki' | null } | undefined {
  const kendi = hedef.id
    ? makyajFoto(
        fotolar.filter((f) => f.generationId === hedef.id),
        makyaj,
      )
    : undefined;
  if (kendi) return { foto: kendi, yakin: null };
  const bas = hedef.startYear;
  if (bas === null) return undefined;
  const fotolu = nesiller.filter((n) => n.id !== hedef.id && fotolar.some((f) => f.generationId === n.id));
  const onceki = fotolu.filter((n) => n.startYear < bas).sort((a, b) => b.startYear - a.startYear)[0];
  if (onceki) {
    const list = fotolar.filter((f) => f.generationId === onceki.id);
    const foto =
      list.find((f) => f.facelift === null) ??
      [...list].sort((a, b) => (b.facelift ?? 0) - (a.facelift ?? 0))[0];
    if (foto) return { foto, yakin: 'onceki' };
  }
  const sonraki = fotolu.filter((n) => n.startYear >= bas).sort((a, b) => a.startYear - b.startYear)[0];
  if (sonraki) {
    const foto = makyajFoto(
      fotolar.filter((f) => f.generationId === sonraki.id),
      0,
    );
    if (foto) return { foto, yakin: 'sonraki' };
  }
  return undefined;
}
