import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIMES } from '@rengarenk/shared';

/**
 * Belge ve fotoğraf yüklemesi (galeri başvurusu belgeleri): dosya istek gövdesinde ham bayt olarak gelir, en çok
 * 10 MB. Gerçek tür ilgili hizmette dosyanın ilk baytlarından denetlenir. Uygulama başlamadan önce çağrılır.
 */
export function registerUploadBodies(app: NestFastifyApplication) {
  const fastify = app.getHttpAdapter().getInstance();
  for (const mime of DOCUMENT_MIMES) {
    if (fastify.hasContentTypeParser(mime)) continue;
    fastify.addContentTypeParser(
      mime,
      { parseAs: 'buffer', bodyLimit: DOCUMENT_MAX_BYTES },
      (_req, body, done) => done(null, body),
    );
  }
}
