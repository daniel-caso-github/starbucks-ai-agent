import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { HealthController } from '@infrastructure/http/controllers/health.controller';
import { EnvConfigService } from '@infrastructure/config';

describe('HealthController', () => {
  let controller: HealthController;
  let mockEnvConfigService: { nodeEnv: string; chromaHost: string };
  let mockMongoConnection: {
    readyState: number;
    db: { admin: () => { ping: jest.Mock } };
  };

  beforeEach(async () => {
    mockEnvConfigService = {
      nodeEnv: 'development',
      chromaHost: 'http://localhost:8000',
    };

    mockMongoConnection = {
      readyState: 1,
      db: {
        admin: () => ({
          ping: jest.fn().mockResolvedValue(true),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: EnvConfigService,
          useValue: mockEnvConfigService,
        },
        {
          provide: getConnectionToken(),
          useValue: mockMongoConnection,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services are up', async () => {
      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.services.mongodb.status).toBe('healthy');
      expect(result.services.chromadb.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return degraded status when MongoDB is down', async () => {
      // Arrange
      mockMongoConnection.readyState = 0; // Not connected

      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.services.mongodb.status).toBe('unhealthy');
      expect(result.services.chromadb.status).toBe('healthy');
    });

    it('should return degraded status when ChromaDB is not configured', async () => {
      // Arrange - chromaHost is empty/falsy
      mockEnvConfigService.chromaHost = '';

      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.services.chromadb.status).toBe('unhealthy');
    });

    it('should return unhealthy status when all services are down', async () => {
      // Arrange
      mockMongoConnection.readyState = 0;
      mockEnvConfigService.chromaHost = '';

      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result.status).toBe('unhealthy');
    });

    it('should include response time for MongoDB', async () => {
      // Act
      const result = await controller.healthCheck();

      // Assert
      expect(result.services.mongodb.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('live', () => {
    it('should return alive status', () => {
      // Act
      const result = controller.live();

      // Assert
      expect(result.status).toBe('alive');
    });
  });

  describe('ready', () => {
    it('should return ready when MongoDB is connected', async () => {
      // Act
      const result = await controller.ready();

      // Assert
      expect(result.status).toBe('ready');
    });

    it('should return not_ready when MongoDB is disconnected', async () => {
      // Arrange
      mockMongoConnection.readyState = 0;

      // Act
      const result = await controller.ready();

      // Assert
      expect(result.status).toBe('not_ready');
      expect(result.reason).toContain('MongoDB');
    });
  });
});
