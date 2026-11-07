import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from '../config/env.js';
import { PRISMA, PrismaLifecycle, prismaProvider } from './prisma.js';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }, prismaProvider, PrismaLifecycle],
  exports: [ENV, PRISMA],
})
export class DatabaseModule {}
