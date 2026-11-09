import sharp from 'sharp';

/**
 * Fotoğrafın algısal özeti (dHash, 64 bit; işaretli bigint olarak saklanır). Görsel 9×8 gri tonlamaya indirilir, her
 * satırda yan yana piksellerin parlaklık farkı bit olur. Yeniden boyutlama, sıkıştırma ve küçük renk değişikliğinde
 * özet aynı kalır ya da birkaç bit değişir. Okunamayan dosyada null.
 */
export async function photoHash(body: Uint8Array): Promise<bigint | null> {
  try {
    const px = await sharp(body).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
    let h = 0n;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) h = (h << 1n) | ((px[y * 9 + x] ?? 0) > (px[y * 9 + x + 1] ?? 0) ? 1n : 0n);
    return BigInt.asIntN(64, h);
  } catch {
    return null;
  }
}

/** Kopya sayılan en çok farklı bit (64 bitte) */
export const PHOTO_HASH_DISTANCE = 5;
