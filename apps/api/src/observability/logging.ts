import { RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { loadEnv } from '../config/env.js';

/**
 * Yapılandırılmış günlük (JSON). Kişisel veri ve sırlar günlüğe yazılmaz (Karar 58): telefon, kod,
 * jetonlar, çerezler ve yetki başlığı maskelenir. Her istek bir istek kimliği taşır.
 */
export function loggingModule() {
  const env = loadEnv();
  return LoggerModule.forRoot({
    forRoutes: [{ path: '{*yol}', method: RequestMethod.ALL }],
    pinoHttp: {
      level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID(),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.phone',
          'req.body.code',
          'req.body.refreshToken',
          '*.phone',
          '*.email',
          '*.code',
          '*.refreshToken',
          '*.accessToken',
        ],
        censor: '[gizli]',
      },
      serializers: {
        req: (r: { id: string; method: string; url: string }) => ({ id: r.id, method: r.method, url: r.url }),
        res: (r: { statusCode: number }) => ({ statusCode: r.statusCode }),
      },
      customProps: () => ({ app: 'api' }),
    },
  });
}
