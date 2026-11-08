import type { PortfolioVehicle } from '@rengarenk/db';
import type { Db } from '../database/prisma.js';

type Named = Pick<
  PortfolioVehicle,
  'makeKey' | 'seriesKey' | 'modelKey' | 'trimKey' | 'makeName' | 'modelName' | 'year'
>;

/** Portföy araçlarının katalog adları (marka, seri, model, paket) toplu; "2020 BMW 3 Serisi 320i M Sport" */
export async function vehicleNames<N extends Named>(db: Db, vs: N[]) {
  const keys = (f: (v: N) => string | null) => [...new Set(vs.map(f).filter((x): x is string => Boolean(x)))];
  const [m, s, mo, t] = await Promise.all([
    db.catalogMake.findMany({
      where: { key: { in: keys((v) => v.makeKey) } },
      select: { key: true, name: true },
    }),
    db.catalogSeries.findMany({
      where: { key: { in: keys((v) => v.seriesKey) } },
      select: { key: true, name: true },
    }),
    db.catalogModel.findMany({
      where: { key: { in: keys((v) => v.modelKey) } },
      select: { key: true, name: true },
    }),
    db.catalogTrim.findMany({
      where: { key: { in: keys((v) => v.trimKey) } },
      select: { key: true, name: true },
    }),
  ]);
  const map = new Map([...m, ...s, ...mo, ...t].map((x) => [x.key, x.name]));
  return (v: N) => {
    const marka = v.makeKey ? (map.get(v.makeKey) ?? v.makeKey) : (v.makeName ?? '');
    const seri = v.seriesKey ? map.get(v.seriesKey) : null;
    const model = v.modelKey ? map.get(v.modelKey) : v.modelName;
    const paket = v.trimKey ? map.get(v.trimKey) : null;
    return {
      marka,
      seri,
      model,
      paket,
      ad: [String(v.year), marka, seri, model, paket].filter(Boolean).join(' '),
    };
  };
}
