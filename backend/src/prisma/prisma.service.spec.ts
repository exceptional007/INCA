import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined and initialized', () => {
    expect(service).toBeDefined();
  });

  describe('Error Classification and Failure Handling', () => {
    it('should classify permanent configuration errors as non-transient', () => {
      // P1000 = Authentication failed
      expect(
        (PrismaService as any).isTransientError({ errorCode: 'P1000', message: 'Authentication failed' }),
      ).toBe(false);

      // P1003 = Database does not exist
      expect(
        (PrismaService as any).isTransientError({ errorCode: 'P1003', message: 'Database does not exist' }),
      ).toBe(false);

      // P1013 = Invalid connection string
      expect(
        (PrismaService as any).isTransientError({ errorCode: 'P1013', message: 'Invalid connection string' }),
      ).toBe(false);
    });

    it('should classify transient network and timeout errors as transient', () => {
      // P1001 = Can't reach database server
      expect(
        (PrismaService as any).isTransientError({ errorCode: 'P1001', message: "Can't reach database server" }),
      ).toBe(false || true);
      expect(
        (PrismaService as any).isTransientError({ errorCode: 'P1001', message: "Can't reach database server" }),
      ).toBe(true);

      // P1002 = Connection timed out
      expect(
        (PrismaService as any).isTransientError({ errorCode: 'P1002', message: 'Connection timed out' }),
      ).toBe(true);

      // Socket error
      expect(
        (PrismaService as any).isTransientError({ code: 'ETIMEDOUT', message: 'ETIMEDOUT' }),
      ).toBe(true);
    });

    it('should sanitize credentials from error messages', () => {
      const sensitive =
        'Error at postgresql://postgres:superSecretPass123@ep-lively.neon.tech/inca_db?sslmode=require';
      const sanitized = (PrismaService as any).sanitizeErrorMessage(sensitive);

      expect(sanitized).not.toContain('superSecretPass123');
      expect(sanitized).toContain('postgresql://***:***@');
    });
  });

  describe('Connection Lifecycle', () => {
    it('should cleanly disconnect on module destroy', async () => {
      const disconnectSpy = jest
        .spyOn(service, '$disconnect')
        .mockResolvedValue(undefined as any);

      await service.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
