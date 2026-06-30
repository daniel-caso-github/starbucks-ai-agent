import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { EnvConfigService } from '@infrastructure/config';

/**
 * Controller for health check endpoints.
 *
 * Provides endpoints for monitoring the health of the application
 * and its dependencies (MongoDB, ChromaDB, etc.).
 */
@ApiTags('Health')
@SkipThrottle() // Health checks should not be rate limited
@Controller('api/v1/health')
export class HealthController {
  private readonly startTime: Date;

  constructor(
    private readonly envConfig: EnvConfigService,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {
    this.startTime = new Date();
  }

  /**
   * Basic health check.
   *
   * Returns the overall health status of the application
   * including individual service statuses.
   */
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Check the health of the application and its dependencies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string', example: '1.0.0' },
        uptime: { type: 'number', description: 'Uptime in seconds' },
        services: {
          type: 'object',
          properties: {
            mongodb: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                responseTimeMs: { type: 'number' },
              },
            },
            chromadb: {
              type: 'object',
              properties: {
                status: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    version: string;
    uptime: number;
    environment: string;
    services: {
      mongodb: { status: string; responseTimeMs?: number };
      chromadb: { status: string };
    };
  }> {
    const mongoStatus = await this.checkMongoDB();
    const chromaStatus = this.checkChromaDB();

    const allHealthy = mongoStatus.status === 'healthy' && chromaStatus.status === 'healthy';
    const allUnhealthy = mongoStatus.status === 'unhealthy' && chromaStatus.status === 'unhealthy';

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (allHealthy) {
      overallStatus = 'healthy';
    } else if (allUnhealthy) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      environment: this.envConfig.nodeEnv,
      services: {
        mongodb: mongoStatus,
        chromadb: chromaStatus,
      },
    };
  }

  /**
   * Liveness probe for Kubernetes.
   */
  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Simple liveness check for container orchestration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
  })
  live(): { status: string } {
    return { status: 'alive' };
  }

  /**
   * Readiness probe for Kubernetes.
   */
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Check if the application is ready to receive traffic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
  })
  async ready(): Promise<{ status: string; reason?: string }> {
    const mongoStatus = await this.checkMongoDB();

    if (mongoStatus.status !== 'healthy') {
      return {
        status: 'not_ready',
        reason: 'MongoDB is not available',
      };
    }

    return { status: 'ready' };
  }

  /**
   * Check MongoDB connection health.
   */
  private async checkMongoDB(): Promise<{ status: string; responseTimeMs?: number }> {
    const startTime = Date.now();

    try {
      // Check if connection is ready
      if (this.mongoConnection.readyState !== 1) {
        return { status: 'unhealthy' };
      }

      // Ping the database
      await this.mongoConnection.db?.admin().ping();

      return {
        status: 'healthy',
        responseTimeMs: Date.now() - startTime,
      };
    } catch {
      return { status: 'unhealthy' };
    }
  }

  /**
   * Check ChromaDB availability.
   * Note: This is a simplified check. In production, you'd want
   * to actually ping the ChromaDB service.
   */
  private checkChromaDB(): { status: string } {
    // For now, assume ChromaDB is healthy if the environment variable is set
    const chromaHost = this.envConfig.chromaHost;
    return { status: chromaHost ? 'healthy' : 'unhealthy' };
  }
}
