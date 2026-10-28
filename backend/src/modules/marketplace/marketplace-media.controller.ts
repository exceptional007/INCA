import { Controller, Get, Query, Param, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';

@Controller('marketplace/images')
export class MarketplaceMediaController {
  constructor(private readonly r2Storage: StrictR2StorageService) {}

  @Get('stream')
  async streamImageByQuery(
    @Query('key') key: string,
    @Res() res: Response,
  ) {
    if (!key) {
      throw new BadRequestException('Image storage key is required');
    }
    const { stream, contentType } = await this.r2Storage.getObjectStream(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    stream.pipe(res);
  }

  @Get(':key(*)')
  async streamImageByPath(
    @Param('key') key: string,
    @Res() res: Response,
  ) {
    if (!key) {
      throw new BadRequestException('Image storage key is required');
    }
    const { stream, contentType } = await this.r2Storage.getObjectStream(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    stream.pipe(res);
  }
}

