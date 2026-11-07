import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { ENV, type Env } from '../config/env.js';

/**
 * Kuyruk: PostgreSQL üzerinde pg-boss (Teknik tasarım, tek geliştirici sadeleştirmesi).
 * RabbitMQ'ya geçilirse yalnızca bu sınıf değişir.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly log = new Logger(QueueService.name);
  private boss?: PgBoss;
  constructor(@Inject(ENV) private readonly env: Env) {}

  async start(): Promise<PgBoss> {
    if (this.boss) return this.boss;
    const boss = new PgBoss({ connectionString: this.env.DATABASE_URL, schema: 'pgboss' });
    boss.on('error', (err) => this.log.error(err));
    await boss.start();
    this.boss = boss;
    return boss;
  }

  async publish(event: string, data: unknown): Promise<void> {
    const boss = await this.start();
    await boss.publish(event, { data });
  }

  async onModuleDestroy() {
    await this.boss?.stop({ graceful: true });
  }
}
