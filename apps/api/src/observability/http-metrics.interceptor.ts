import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { finalize, type Observable } from 'rxjs';
import { Metrics } from './metrics.js';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: Metrics) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ method: string; routeOptions?: { url?: string } }>();
    const reply = ctx.switchToHttp().getResponse<{ statusCode: number }>();
    const end = this.metrics.httpDuration.startTimer();
    return next.handle().pipe(
      finalize(() =>
        end({
          method: req.method,
          route: req.routeOptions?.url ?? 'bilinmiyor',
          status: String(reply.statusCode),
        }),
      ),
    );
  }
}
