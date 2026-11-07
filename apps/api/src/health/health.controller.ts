import { Controller, Get, Inject } from '@nestjs/common';
import { type Db, PRISMA } from '../database/prisma.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  @Get()
  async check() {
    const started = Date.now();
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'ok', dbMs: Date.now() - started, version: process.env.APP_VERSION ?? 'dev' };
  }
}
