import { Inject, Injectable } from '@nestjs/common';
import { bannedWordsIn, type ContentFilterKey } from '@rengarenk/shared';
import { type Db, PRISMA } from '../database/prisma.js';

/**
 * Otomatik içerik filtreleri ve yasaklı kelimeler (Karar 13.2): konsoldan yönetilir, 30 saniye önbellekte tutulur.
 * Filtre satırı yoksa açıktır.
 */
@Injectable()
export class ContentRulesService {
  private onbellek: { zaman: number; filtre: Map<string, boolean>; kelimeler: string[] } | null = null;
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  private async yukle() {
    if (this.onbellek && Date.now() - this.onbellek.zaman < 30_000) return this.onbellek;
    const [f, k] = await Promise.all([
      this.db.contentFilter.findMany(),
      this.db.bannedWord.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    this.onbellek = {
      zaman: Date.now(),
      filtre: new Map(f.map((x) => [x.key, x.enabled])),
      kelimeler: k.map((x) => x.word),
    };
    return this.onbellek;
  }

  temizle() {
    this.onbellek = null;
  }

  async acik(key: ContentFilterKey) {
    return (await this.yukle()).filtre.get(key) ?? true;
  }

  async filtreler() {
    const o = await this.yukle();
    return { filtre: o.filtre, kelimeler: o.kelimeler };
  }

  /** Metindeki yasaklı kelimeler; filtre kapalıysa boş */
  async yasakli(text: string): Promise<string[]> {
    if (!text || !(await this.acik('kelime'))) return [];
    return bannedWordsIn(text, (await this.yukle()).kelimeler);
  }
}
