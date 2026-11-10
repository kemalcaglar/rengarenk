import type { Prisma } from '@rengarenk/db';
import type { Db } from '../database/prisma.js';

/**
 * Galerinin izni kalkınca (izin kapatıldı, fotoğraf silindi, araç moderasyonla kaldırıldı) galeri fotoğrafı katalogdan
 * geri çekilir: aday ve seçili kayıt "geri_alindi" olur, artık gösterilmez (Karar 34, galeri sözleşmesi madde 10).
 * Değişiklikle aynı işlemde çağrılır.
 */
export async function galeriFotoGeriCek(
  tx: Prisma.TransactionClient | Db,
  where: { vehicleId?: string; photoId?: string; accountId?: string },
): Promise<number> {
  // Filtresiz çağrı bütün galeri fotoğraflarını çekerdi
  if (!where.vehicleId && !where.photoId && !where.accountId) return 0;
  const r = await tx.catalogImage.updateMany({
    where: {
      origin: 'galeri',
      status: { in: ['aday', 'secildi'] },
      ...(where.vehicleId ? { portfolioVehicleId: where.vehicleId } : {}),
      ...(where.photoId ? { portfolioPhotoId: where.photoId } : {}),
      ...(where.accountId ? { galleryAccountId: where.accountId } : {}),
    },
    data: { status: 'geri_alindi', decidedAt: new Date() },
  });
  return r.count;
}
