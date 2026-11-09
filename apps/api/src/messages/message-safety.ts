import { Inject, Injectable } from '@nestjs/common';
import { type MessageFlag, SAFETY_PREFILTER, SAFETY_RISK } from '@rengarenk/shared';
import { AiGateway } from '../ai/ai-gateway.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { FeatureFlagService } from '../flags/feature-flag.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SecretBox } from '../staff/secret-box.js';

/**
 * Yapay zekâ destekli mesaj güvenliği (Karar 42; özellik anahtarı `mesaj_guvenligi`). Karar 25'teki anlık kelime
 * taramasını güçlendirir: satıcı mesajı para, teslim ya da iletişimle ilgiliyse sınıflandırılır (kurallar ve maskeli
 * istekle yapay zekâ). Risk yüksekse mesaja `supheli` işareti konur, alıcıya uyarı bandı çıkar ve `mesaj.uyari` olayı
 * yazılır. Mesaj gizlenmez, hesap kısıtlanmaz; karar kural ve insanda kalır.
 */
@Injectable()
export class MessageSafety {
  private readonly box: SecretBox;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
    private readonly flags: FeatureFlagService,
    private readonly ai: AiGateway,
    private readonly outbox: OutboxService,
  ) {
    this.box = SecretBox.forMessages(env);
  }

  async kontrol(messageId: string): Promise<'kapali' | 'islem_yok' | 'temiz' | 'supheli'> {
    if (!(await this.flags.isOn('mesaj_guvenligi'))) return 'kapali';
    const m = await this.db.message.findUnique({ where: { id: messageId } });
    if (m?.side !== 'satici' || m.kind !== 'metin' || m.hiddenAt || m.flags.includes('supheli'))
      return 'islem_yok';
    let metin = '';
    try {
      metin = this.box.open(m.body);
    } catch {
      return 'islem_yok';
    }
    if (!SAFETY_PREFILTER.test(metin)) return 'temiz';

    const kural = SAFETY_RISK.test(metin)
      ? { risk: 'yuksek', neden: 'Bilinen dolandırıcılık kalıbı' }
      : { risk: 'dusuk', neden: '' };
    const r = await this.ai.run({
      task: 'mesaj_guvenligi',
      promptVersion: 'mesaj-guvenligi-v1',
      size: 'kucuk',
      system:
        'İkinci el araç alım satımında satıcının alıcıya yazdığı mesajda dolandırıcılık riskini sınıflandır: aracı görmeden ödeme, kargo ile teslim, yurt dışı ya da askerlik bahanesi, avans, teminat, platform dışı ödeme ya da iletişime yönlendirme. Yalnızca JSON döndür: {"risk":"yuksek"|"dusuk","neden":"kısa gerekçe"}.',
      prompt: metin.slice(0, 1200),
      taslak: JSON.stringify(kural),
      maxOutputTokens: 80,
    });
    let risk = kural.risk;
    if (r.kaynak === 'yz') {
      const j = r.text.match(/"risk"\s*:\s*"(yuksek|dusuk)"/);
      // Yapay zekâ riski yükseltebilir; kuralın yakaladığını düşüremez
      if (j?.[1] === 'yuksek') risk = 'yuksek';
    }
    if (risk !== 'yuksek') return 'temiz';

    const flags = [...(m.flags as MessageFlag[]), 'supheli' as const];
    await this.db.$transaction(async (tx) => {
      await tx.message.update({ where: { id: m.id }, data: { flags } });
      await tx.conversation.update({ where: { id: m.conversationId }, data: { warned: true } });
      await this.outbox.add(tx, 'mesaj.uyari', {
        conversationId: m.conversationId,
        messageId: m.id,
        flags,
        side: 'satici',
      });
    });
    return 'supheli';
  }
}
