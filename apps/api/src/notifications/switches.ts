import { Inject, Injectable } from '@nestjs/common';
import { AUTOMATIONS, type AutomationKey, automationOf } from '@rengarenk/shared';
import { type Db, PRISMA } from '../database/prisma.js';

/**
 * Bildirim anahtarları (konsol): otomatik akışların ve ticari gönderimin açık olup olmadığı. 30 saniye önbellek.
 * Satır yoksa akışın varsayılanı geçerlidir; ticari gönderim varsayılan açıktır.
 */
@Injectable()
export class SwitchService {
  private onbellek: { zaman: number; deger: Map<string, boolean> } | null = null;
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  private async hepsi() {
    if (this.onbellek && Date.now() - this.onbellek.zaman < 30_000) return this.onbellek.deger;
    const satir = await this.db.notificationSwitch.findMany();
    const deger = new Map(satir.map((s) => [s.key, s.enabled]));
    this.onbellek = { zaman: Date.now(), deger };
    return deger;
  }

  temizle() {
    this.onbellek = null;
  }

  async akisAcik(key: AutomationKey) {
    return (await this.hepsi()).get(`akis.${key}`) ?? AUTOMATIONS[key].varsayilan;
  }

  /** Şablonu bir akış gönderiyorsa akış açık mı */
  async sablonAcik(sablon: string) {
    const a = automationOf(sablon);
    return a ? this.akisAcik(a) : true;
  }

  async ticariAcik() {
    return (await this.hepsi()).get('ticari') ?? true;
  }

  async ayarla(key: string, enabled: boolean, by: string) {
    await this.db.notificationSwitch.upsert({
      where: { key },
      create: { key, enabled, updatedBy: by },
      update: { enabled, updatedBy: by },
    });
    this.temizle();
  }
}
