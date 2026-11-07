import helmet from '@fastify/helmet';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

export async function createApp(): Promise<NestFastifyApplication> {
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    {
      logger: env.NODE_ENV === 'test' ? ['error'] : undefined,
    },
  );
  await app.register(helmet);
  app.enableCors({ origin: [env.WEB_ORIGIN, env.ADMIN_ORIGIN], credentials: true });
  app.enableShutdownHooks();
  if (env.NODE_ENV !== 'production') setupDocs(app);
  return app;
}

function setupDocs(app: INestApplication) {
  const config = new DocumentBuilder().setTitle('Rengarenk API').setVersion('0.1').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
