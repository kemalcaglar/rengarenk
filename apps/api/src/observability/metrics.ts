import { Global, Injectable, Module } from '@nestjs/common';
import { Counter, collectDefaultMetrics, Histogram, Registry } from 'prom-client';

/** Prometheus ölçümleri (Teknik tasarım §13). Kişisel veri etiket olarak kullanılmaz. */
@Injectable()
export class Metrics {
  readonly registry = new Registry();
  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP istek süresi',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });
  readonly smsSent = new Counter({
    name: 'sms_sent_total',
    help: 'Gönderilen SMS sayısı',
    labelNames: ['provider', 'result'],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}

@Global()
@Module({ providers: [Metrics], exports: [Metrics] })
export class MetricsModule {}
