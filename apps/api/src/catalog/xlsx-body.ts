import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_UPLOAD = 30 * 1024 * 1024;

/**
 * Excel dosyasının istek gövdesi olarak gelebilmesi için (konsoldan TSB yükleme). Gövde ham bayt olarak okunur;
 * sınır yalnızca bu tür için 30 MB'tır, diğer istekler Fastify'ın varsayılan 1 MB sınırında kalır.
 * Uygulama başlatılmadan önce çağrılır (bootstrap ve testler).
 */
export function registerXlsxBody(app: NestFastifyApplication) {
  const fastify = app.getHttpAdapter().getInstance();
  if (fastify.hasContentTypeParser(XLSX_MIME)) return;
  fastify.addContentTypeParser(XLSX_MIME, { parseAs: 'buffer', bodyLimit: MAX_UPLOAD }, (_req, body, done) =>
    done(null, body),
  );
}
