import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { hideDemandText, MESSAGE_MAX, scanMessage } from '@rengarenk/shared';
import { AiGateway } from '../ai/ai-gateway.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { vehicleNames } from '../portfolio/vehicle-names.js';

const YAKIT: Record<string, string> = {
  benzin: 'benzinli',
  dizel: 'dizel',
  lpg_benzin: 'LPG ve benzinli',
  hibrit: 'hibrit',
  elektrik: 'elektrikli',
};
const VITES: Record<string, string> = {
  otomatik: 'otomatik',
  manuel: 'manuel',
  yari_otomatik: 'yarı otomatik',
};
const km = (n: number) => `${new Intl.NumberFormat('tr-TR').format(n)} km`;

/**
 * İlk mesaj taslağı (Karar 42; GaleriMobil.dc.html › İlk mesaj, "✦ Taslağı yeniden yaz"). Galeri adına yazılıyorsa
 * eşleştirmenin bu talebe en yüksek puanı verdiği yayındaki portföy aracı önerilir ve taslak o araçla yazılır. Gönderen
 * her zaman satıcının kendisidir. Metin yapay zekâdan (maskeli) gelirse güvenlik kurallarına takılan (telefon, IBAN,
 * bağlantı, kapora) taslak kullanılmaz, kural metni döner.
 */
@Injectable()
export class FirstMessageDraft {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly ai: AiGateway,
  ) {}

  async taslak(userId: string, no: number, b: { hesap?: string; aracId?: string; sira?: number }) {
    const d = await this.db.demand.findUnique({
      where: { no: BigInt(no) },
      select: { id: true, userId: true, status: true, title: true, headline: true },
    });
    if (d?.status !== 'PUBLISHED') throw new NotFoundException('Talep yayında değil');
    if (d.userId === userId) throw new ForbiddenException('Kendi talebine yazamazsın');
    const uye = b.hesap
      ? await this.db.accountMember.findUnique({
          where: { accountId_userId: { accountId: b.hesap, userId } },
          include: { account: { select: { gallery: { select: { accountId: true } } } } },
        })
      : null;
    if (b.hesap && !uye) throw new ForbiddenException('Bu hesap adına yazamazsın');
    const galeri = Boolean(uye?.account.gallery);

    // Araç: seçilen ya da eşleştirmenin en yüksek puanlı aracı (yalnızca galeri, yalnızca yayında)
    let aracId = galeri ? b.aracId : undefined;
    if (galeri && !aracId) {
      const m = await this.db.match.findFirst({
        where: { demandId: d.id, accountId: b.hesap, active: true },
        orderBy: { score: 'desc' },
        select: { vehicleId: true },
      });
      aracId = m?.vehicleId;
    }
    const v = aracId
      ? await this.db.portfolioVehicle.findFirst({
          where: { id: aracId, accountId: b.hesap, status: 'PUBLISHED' },
        })
      : null;
    const ad = v ? (await vehicleNames(this.db, [v]))(v).ad : null;
    const talep = hideDemandText(d.headline) || d.title || 'talebiniz';
    const sira = (b.sira ?? 0) % 3;

    let kural: string;
    if (v && ad) {
      const ozellik = [km(v.km), v.fuel ? YAKIT[v.fuel] : null, v.gearbox ? VITES[v.gearbox] : null]
        .filter(Boolean)
        .join(', ');
      const rapor = v.reportKey ? ' Ekspertiz raporu hazır.' : '';
      kural = [
        `Merhaba, aradığınız kriterlere uyan ${ad} portföyümüzde: ${ozellik}.${rapor} Görmek isterseniz yazmanız yeterli.`,
        `Merhaba, talebinizi gördük. ${ad} aradığınız özelliklere uyuyor: ${ozellik}.${rapor} Ayrıntıları ve fotoğrafları paylaşabiliriz.`,
        `Merhaba, ${ad} için yazıyoruz: ${ozellik}.${rapor} Uygun olduğunuz bir zamanda aracı yerinde görebilirsiniz.`,
      ][sira] as string;
    } else if (galeri) {
      kural = [
        `Merhaba, “${talep}” talebinizi gördük; portföyümüzde aradığınız özelliklere uyan araçlar var. Ayrıntıları paylaşmamızı ister misiniz?`,
        'Merhaba, talebinize uygun araçlarımız için yazıyoruz. Kilometre, bakım geçmişi ve fotoğrafları paylaşabiliriz.',
        `Merhaba, “${talep}” için size uygun seçeneklerimiz var. Sorularınızı yanıtlamaktan memnuniyet duyarız.`,
      ][sira] as string;
    } else {
      kural = [
        `Merhaba, “${talep}” talebinizi gördüm; aradığınız özelliklere uyan bir aracım var. Ayrıntıları paylaşmamı ister misiniz?`,
        'Merhaba, talebinize uygun bir araç için yazıyorum. Kilometre, bakım geçmişi ve fotoğrafları paylaşabilirim.',
        `Merhaba, “${talep}” için elimde uygun bir araç var. Sorularınızı yanıtlamaktan memnuniyet duyarım.`,
      ][sira] as string;
    }

    const r = await this.ai.run({
      task: 'talep_asistani',
      promptVersion: 'ilk-mesaj-v1',
      size: 'kucuk',
      system: `${galeri ? 'Bir galeri adına' : 'Bir satıcı olarak'} alıcının talebine kısa ve kibar bir ilk mesaj yaz. Taslaktaki araç bilgilerini koru, yeni bilgi uydurma. Telefon, IBAN, bağlantı yazma, kapora ya da ön ödeme isteme. Türkçe, en çok üç cümle.${sira ? ' Taslaktan farklı bir anlatım kullan.' : ''}`,
      prompt: JSON.stringify({ talep, arac: ad }),
      taslak: kural,
      maxOutputTokens: 200,
    });
    const yz = r.text.trim().slice(0, MESSAGE_MAX);
    const guvenli = r.kaynak === 'yz' && yz.length >= 20 && scanMessage(yz).length === 0;
    return {
      metin: guvenli ? yz : kural,
      arac: v && ad ? { id: v.id, ad } : null,
      kaynak: guvenli ? 'yz' : 'kural',
    };
  }
}
