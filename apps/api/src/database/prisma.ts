import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@rengarenk/db';
import { ENV, type Env } from '../config/env.js';

export const PRISMA = Symbol('PRISMA');
export type Db = PrismaClient;
/** Bir işlem (transaction) içindeki istemci. */
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

@Injectable()
export class PrismaLifecycle implements OnModuleDestroy {
  constructor(@Inject(PRISMA) private readonly db: Db) {}
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}

export const prismaProvider = {
  provide: PRISMA,
  inject: [ENV],
  useFactory: (env: Env) => createPrismaClient(env.DATABASE_URL),
};
