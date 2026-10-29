import { Controller, Get, Query, Param, Res, BadRequestException, VERSION_NEUTRAL } from '@nestjs/common';
import type { Response } from 'express';
import { StrictR2StorageService } from './strict-r2-storage.service';

@Controller({ path: 'storage', version: [VERSION_NEUTRAL, '1'] })
export class StorageController {
  constructor(private readonly r2Storage: StrictR2StorageService) {}

  @Get('stream')
  async streamByQuery(
    @Query('key') key: string,
    @Res() res: Response,
  ) {
    if (!key) {
      throw new BadRequestException('Storage key is required');
    }
    const { stream, contentType } = await this.r2Storage.getObjectStream(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    stream.pipe(res);
  }

  @Get('photo/*key')
  async streamPhoto(
    @Param('key') key: string | string[],
    @Res() res: Response,
  ) {
    const resolvedKey = Array.isArray(key) ? key.join('/') : (key || '');
    if (!resolvedKey) {
      throw new BadRequestException('Storage key is required');
    }
    const { stream, contentType } = await this.r2Storage.getObjectStream(resolvedKey);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    stream.pipe(res);
  }
}

