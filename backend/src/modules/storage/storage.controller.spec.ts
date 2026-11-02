import { Test, TestingModule } from '@nestjs/testing';
import { StorageController } from './storage.controller';
import { StrictR2StorageService } from './strict-r2-storage.service';
import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'stream';

describe('StorageController', () => {
  let controller: StorageController;
  let mockR2Storage: Partial<StrictR2StorageService>;

  beforeEach(async () => {
    mockR2Storage = {
      getPublicImageStream: jest.fn().mockImplementation(async (key: string) => {
        const stream = new Readable({
          read() {
            this.push(Buffer.from('mock-data'));
            this.push(null);
          },
        });
        return {
          stream,
          contentType: 'image/jpeg',
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        {
          provide: StrictR2StorageService,
          useValue: mockR2Storage,
        },
      ],
    }).compile();

    controller = module.get<StorageController>(StorageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('streamByQuery', () => {
    it('should stream object when key query is provided', async () => {
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const pipeSpy = jest.fn();
      (mockR2Storage.getPublicImageStream as jest.Mock).mockResolvedValueOnce({
        stream: { pipe: pipeSpy },
        contentType: 'image/png',
      });

      await controller.streamByQuery('lost-found/nested/image.png', res);

      expect(mockR2Storage.getPublicImageStream).toHaveBeenCalledWith('lost-found/nested/image.png', 'campus');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=86400, stale-while-revalidate=604800',
      );
      expect(pipeSpy).toHaveBeenCalledWith(res);
    });

    it('should throw BadRequestException when key query is empty', async () => {
      const res = {} as Response;
      await expect(controller.streamByQuery('', res)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('streamPhoto', () => {
    it('should stream photo when single-segment string key is provided', async () => {
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const pipeSpy = jest.fn();
      (mockR2Storage.getPublicImageStream as jest.Mock).mockResolvedValueOnce({
        stream: { pipe: pipeSpy },
        contentType: 'image/jpeg',
      });

      await controller.streamPhoto('student-photos/photo123.jpg', res);

      expect(mockR2Storage.getPublicImageStream).toHaveBeenCalledWith('student-photos/photo123.jpg', 'campus');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(pipeSpy).toHaveBeenCalledWith(res);
    });

    it('should correctly join multi-segment array key from Express 5 wildcard parameter', async () => {
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const pipeSpy = jest.fn();
      (mockR2Storage.getPublicImageStream as jest.Mock).mockResolvedValueOnce({
        stream: { pipe: pipeSpy },
        contentType: 'image/webp',
      });

      await controller.streamPhoto(['lost-found', 'items', 'wallet.webp'], res);

      expect(mockR2Storage.getPublicImageStream).toHaveBeenCalledWith(
        'lost-found/items/wallet.webp', 'campus',
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
      expect(pipeSpy).toHaveBeenCalledWith(res);
    });

    it('should throw BadRequestException when key is missing or empty', async () => {
      const res = {} as Response;
      await expect(controller.streamPhoto('', res)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.streamPhoto([], res)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

