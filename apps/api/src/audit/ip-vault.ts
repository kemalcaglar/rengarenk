import { randomBytes } from 'node:crypto';
import type { Env } from '../config/env.js';
import type { Db } from '../database/prisma.js';
import { SecretBox } from '../staff/secret-box.js';

/** Süreç içi önbellek süresi: silinen dönem anahtarı en geç bu kadar sonra her süreçte unutulur */
const TTL = 10 * 60_000;
const cache = new Map<string, { box: SecretBox | null; at: number }>();

/** Yarıyıl dönemi: islem-2026-1 (Ocak–Haziran) ya da islem-2026-2 (Temmuz–Aralık), UTC */
export function ipKeyPeriod(at: Date, purpose = 'islem') {
  const y = at.getUTCFullYear();
  const yari = at.getUTCMonth() < 6 ? 1 : 2;
  return {
    id: `${purpose}-${y}-${yari}`,
    periodEnd: new Date(yari === 1 ? Date.UTC(y, 6, 1) : Date.UTC(y + 1, 0, 1)),
  };
}

/**
 * İşlem kaydındaki IP adresleri için dönem anahtarı (Karar 40, 59). Kayıt yalnızca ekleme yapılan tablodadır;
 * saklama süresi dolunca satıra dokunulmaz, dönemin anahtarı silinir ve o dönemin IP adresleri okunamaz olur.
 * Biçim: k1.<dönem>.<şifreli>. Ön eki olmayan eski değerler düz metin sayılır.
 */
export class IpVault {
  private readonly master: SecretBox;

  constructor(
    private readonly db: Db,
    env: Env,
  ) {
    this.master = new SecretBox(env.STAFF_SECRET_KEY ?? `gelistirme:${env.JWT_SECRET}`, 'ip-kasa');
  }

  private async box(id: string, create: boolean, periodEnd?: Date): Promise<SecretBox | null> {
    const c = cache.get(id);
    if (c && Date.now() - c.at < TTL && (c.box || !create)) return c.box;
    let row = await this.db.piiKey.findUnique({ where: { id } });
    if (!row && create && periodEnd) {
      // Anahtar işlemin dışında yazılır: aynı anda açılan iki işlem aynı dönemi paylaşır.
      await this.db.piiKey.createMany({
        data: [
          {
            id,
            purpose: id.split('-')[0] as string,
            periodEnd,
            keyEnc: this.master.seal(randomBytes(32).toString('base64url')),
          },
        ],
        skipDuplicates: true,
      });
      row = await this.db.piiKey.findUnique({ where: { id } });
    }
    const box = row ? new SecretBox(this.master.open(row.keyEnc), 'ip') : null;
    cache.set(id, { box, at: Date.now() });
    return box;
  }

  async seal(ip: string | null | undefined, at = new Date()): Promise<string | null> {
    if (!ip) return null;
    const p = ipKeyPeriod(at);
    const box = await this.box(p.id, true, p.periodEnd);
    return `k1.${p.id}.${(box as SecretBox).seal(ip)}`;
  }

  /** Açık IP; dönem anahtarı imha edildiyse null */
  async open(v: string | null | undefined): Promise<string | null> {
    if (!v) return null;
    if (!v.startsWith('k1.')) return v;
    const [, id, ...rest] = v.split('.');
    const box = await this.box(id as string, false);
    if (!box) return null;
    try {
      return box.open(rest.join('.'));
    } catch {
      return null;
    }
  }

  /** Testler ve imha sonrası: süreç önbelleğini boşaltır */
  static forget(id?: string) {
    if (id) cache.delete(id);
    else cache.clear();
  }
}
