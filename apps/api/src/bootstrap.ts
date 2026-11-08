import helmet from '@fastify/helmet';
import type { INestApplication } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { registerXlsxBody } from './catalog/xlsx-body.js';
import { loadEnv } from './config/env.js';
import { initSentry, ReportingExceptionFilter } from './observability/sentry.js';

export async function createApp(): Promise<NestFastifyApplication> {
  const env = loadEnv();
  const reporting = initSentry(env.SENTRY_DSN, env.NODE_ENV);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    {
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  registerXlsxBody(app);
  if (reporting) app.useGlobalFilters(new ReportingExceptionFilter(app.get(HttpAdapterHost).httpAdapter));
  await app.register(helmet);
  // Fastify'ın varsayılanı yalnızca GET, HEAD, POST; tarayıcıdan PATCH (profil, talep taslağı) ve DELETE de gelir.
  app.enableCors({
    origin: [env.WEB_ORIGIN, env.ADMIN_ORIGIN],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  app.enableShutdownHooks();
  if (env.NODE_ENV !== 'production') setupDocs(app);
  return app;
}

function setupDocs(app: INestApplication) {
  const config = new DocumentBuilder().setTitle('Rengarenk API').setVersion('0.1').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
