import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationSec = (Date.now() - startTime) / 1000;
          const path = this.normalizePath(this.getRoutePath(request));

          this.metricsService.recordHttpRequest(
            request.method,
            path,
            response.statusCode,
            durationSec,
          );
        },
        error: () => {
          const durationSec = (Date.now() - startTime) / 1000;
          const path = this.normalizePath(this.getRoutePath(request));

          this.metricsService.recordHttpRequest(
            request.method,
            path,
            response.statusCode || 500,
            durationSec,
          );
        },
      }),
    );
  }

  private getRoutePath(request: Request): string {
    const route = request.route as { path?: string } | undefined;
    return route?.path ?? request.url;
  }

  private normalizePath(path: string): string {
    // Normalizar paths con IDs dinámicos
    return path
      .replace(/\/conv_[a-f0-9-]+/g, '/:conversationId')
      .replace(/\/ord_[a-f0-9-]+/g, '/:orderId')
      .replace(/\/drink_[a-f0-9-]+/g, '/:drinkId');
  }
}
