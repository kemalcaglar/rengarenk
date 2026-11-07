/**
 * Kasa kuşağı (vehicle-makes-models, kasa başına) ile nesil kodunu (Wikidata) eşler ve makyaj sırasını çıkarır.
 * Örnek BMW 3 Serisi Sedan: 1998 ve 2002 kuşakları E46'ya (1997–2006) düşer; 1998 makyajsız (0), 2002 makyajlı (1).
 * Kural: kuşağın başlangıç yılını kapsayan kodlardan en geç başlayanı seçilir (2018 kuşağı F30 yerine G20'ye).
 * Aynı kod ve kasada kuşaklar başlangıç yılına göre sıralanır; sırası makyaj numarasıdır.
 */

export interface PhaseIn {
  id: string;
  body: string | null;
  startYear: number;
  endYear: number | null;
}

export interface CodeIn {
  id: string;
  code: string | null;
  startYear: number;
  endYear: number | null;
  wikidataId: string | null;
  commonsCategory: string | null;
}

export interface PhaseCode {
  phaseId: string;
  codeId: string;
  code: string | null;
  facelift: number;
  wikidataId: string | null;
  commonsCategory: string | null;
}

export const MAX_PHASES = 4;

export function assignGenerationCodes(phases: PhaseIn[], codes: CodeIn[]): PhaseCode[] {
  const pick = (p: PhaseIn): CodeIn | undefined => {
    const covers = (c: CodeIn, slack: number) =>
      c.startYear <= p.startYear + slack && (c.endYear === null || p.startYear <= c.endYear + slack);
    for (const slack of [0, 1]) {
      const hits = codes.filter((c) => covers(c, slack));
      if (hits.length) return hits.sort((a, b) => b.startYear - a.startYear)[0];
    }
    return undefined;
  };
  const matched = phases
    .map((p) => ({ p, c: pick(p) }))
    .filter((x): x is { p: PhaseIn; c: CodeIn } => x.c !== undefined);
  const groups = new Map<string, { p: PhaseIn; c: CodeIn }[]>();
  for (const m of matched) {
    const k = `${m.c.id}|${m.p.body ?? ''}`;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const out: PhaseCode[] = [];
  for (const list of groups.values()) {
    // Bir nesilde makyajsız dönem ve en çok üç makyaj olur; daha fazlası yanlış eşleşmedir (ör. kodun yılları
    // eksik), o grup kodsuz bırakılır.
    if (list.length > MAX_PHASES) continue;
    list.sort((a, b) => a.p.startYear - b.p.startYear);
    // Kodun yılları eksik olabilir (Wikidata'da E36 yoksa 1991 kuşağı E30'a düşer). İki işaret yanlış eşleşmeyi
    // gösterir: kuşak kodun bitişinden iki yıldan fazla sonra bitiyorsa ya da önceki kuşakla çakışıyorsa (aynı kasada
    // çakışan iki kuşak, nesil değişimidir; makyajda yeni dönem eskisinin bittiği yıl başlar). Oradan sonrası
    // kodsuz kalır.
    const kept: typeof list = [];
    for (const m of list) {
      const prev = kept.at(-1);
      const overlaps = prev ? m.p.startYear < (prev.p.endYear ?? Number.POSITIVE_INFINITY) : false;
      const outlives = m.c.endYear !== null && m.p.endYear !== null && m.p.endYear > m.c.endYear + 2;
      if (overlaps || outlives) break;
      kept.push(m);
    }
    kept.forEach(({ p, c }, i) => {
      out.push({
        phaseId: p.id,
        codeId: c.id,
        code: c.code,
        facelift: i,
        wikidataId: c.wikidataId,
        commonsCategory: c.commonsCategory,
      });
    });
  }
  return out;
}
