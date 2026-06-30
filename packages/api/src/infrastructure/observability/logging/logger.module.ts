// src/infrastructure/observability/logging/logger.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule, Params } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { IncomingMessage, ServerResponse } from 'http';

interface SerializedRequest {
  id: string;
  method: string;
  url: string;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
}

interface SerializedResponse {
  statusCode: number;
}

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Params => {
        const isProduction = configService.get('NODE_ENV') === 'production';

        return {
          pinoHttp: {
            // Nivel de log según ambiente
            level: isProduction ? 'info' : 'debug',

            // Formato legible en desarrollo, JSON en producción
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: false,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                },

            // Generar request ID para tracing
            genReqId: (req: IncomingMessage): string => {
              const request = req as Request;
              return (request.headers['x-request-id'] as string) || randomUUID();
            },

            // Campos personalizados en cada log
            customProps: (req: IncomingMessage): Record<string, unknown> => {
              const request = req as Request;
              return {
                requestId: (request as Request & { id?: string }).id,
                userAgent: request.headers['user-agent'],
                ip: request.ip,
              };
            },

            // Redactar información sensible
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.apiKey',
              ],
              censor: '[REDACTED]',
            },

            // Serializers personalizados
            serializers: {
              req: (req: IncomingMessage): SerializedRequest => {
                const request = req as Request & { id?: string };
                return {
                  id: request.id || '',
                  method: request.method || '',
                  url: request.url || '',
                  query: (request.query as Record<string, unknown>) || {},
                  params: (request.params as Record<string, unknown>) || {},
                };
              },
              res: (res: ServerResponse): SerializedResponse => {
                const response = res as Response;
                return {
                  statusCode: response.statusCode,
                };
              },
            },

            // Nivel de log automático según status code
            customLogLevel: (
              _req: IncomingMessage,
              res: ServerResponse,
              err: Error | undefined,
            ): 'error' | 'warn' | 'info' => {
              if (res.statusCode >= 500 || err) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },

            // Mensaje de log personalizado
            customSuccessMessage: (req: IncomingMessage, res: ServerResponse): string => {
              const request = req as Request;
              return `${request.method ?? 'UNKNOWN'} ${request.url ?? '/'} completed with ${
                res.statusCode
              }`;
            },
            customErrorMessage: (
              req: IncomingMessage,
              _res: ServerResponse,
              err: Error,
            ): string => {
              const request = req as Request;
              return `${request.method ?? 'UNKNOWN'} ${request.url ?? '/'} failed: ${err.message}`;
            },
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
