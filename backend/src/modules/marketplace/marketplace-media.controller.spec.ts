import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceMediaController } from './marketplace-media.controller';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'stream';

describe('MarketplaceMediaController', () => {
  let controller: MarketplaceMediaController;
  let mockR2Storage: Partial<StrictR2StorageService>;

  beforeEach(async () => {
    mockR2Storage = {
      getObjectStream: jest.fn().mockImplementation(async (key: string) => {
        const stream = new Readable({
          read() {
            this.push(Buffer.from('marketplace-mock-image'));
            this.push(null);
          },
        });
        return {
          stream,
          contentType: 'image/png',
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceMediaController],
      providers: [
        {
          provide: StrictR2StorageService,
          useValue: mockR2Storage,
        },
      ],
    }).compile();

    controller = module.get<MarketplaceMediaController>(MarketplaceMediaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('streamImageByQuery', () => {
    it('should stream image when key query is provided', async () => {
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const pipeSpy = jest.fn();
      (mockR2Storage.getObjectStream as jest.Mock).mockResolvedValueOnce({
        stream: { pipe: pipeSpy },
        contentType: 'image/png',
      });

      await controller.streamImageByQuery('marketplace-images/listing-1.png', res);

      expect(mockR2Storage.getObjectStream).toHaveBeenCalledWith('marketplace-images/listing-1.png');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(pipeSpy).toHaveBeenCalledWith(res);
    });

    it('should throw BadRequestException when query key is empty', async () => {
      const res = {} as Response;
      await expect(controller.streamImageByQuery('', res)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('streamImageByPath', () => {
    it('should stream image when string key is provided', async () => {
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const pipeSpy = jest.fn();
      (mockR2Storage.getObjectStream as jest.Mock).mockResolvedValueOnce({
        stream: { pipe: pipeSpy },
        contentType: 'image/jpeg',
      });

      await controller.streamImageByPath('listing.jpg', res);

      expect(mockR2Storage.getObjectStream).toHaveBeenCalledWith('listing.jpg');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(pipeSpy).toHaveBeenCalledWith(res);
    });

    it('should handle multi-segment array path params', async () => {
      const res = {
        setHeader: jest.fn(),
      } as unknown as Response;

      const pipeSpy = jest.fn();
      (mockR2Storage.getObjectStream as jest.Mock).mockResolvedValueOnce({
        stream: { pipe: pipeSpy },
        contentType: 'image/jpeg',
      });

      await controller.streamImageByPath(['marketplace-images', 'subfolder', 'item.jpg'], res);

      expect(mockR2Storage.getObjectStream).toHaveBeenCalledWith(
        'marketplace-images/subfolder/item.jpg',
      );
      expect(pipeSpy).toHaveBeenCalledWith(res);
    });

    it('should throw BadRequestException when path key is empty', async () => {
      const res = {} as Response;
      await expect(controller.streamImageByPath('', res)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.streamImageByPath([], res)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

