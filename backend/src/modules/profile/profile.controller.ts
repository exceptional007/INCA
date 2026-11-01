import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ProfileService } from './profile.service';
import {
  IsString,
  MaxLength,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import type { Response } from 'express';

class ProfileRequestDto {
  @IsString() @MaxLength(10000) changes: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) revision: string;
}
class DecisionDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(2000) reason?: string;
}
@Controller({ path: 'profile', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly service: ProfileService) {}
  @Get() me(@Req() req: any) {
    return this.service.me(req.user.id);
  }
  @Get('requests') history(@Req() req: any) {
    return this.service.history(req.user.id);
  }
  @Get('review-queue') queue(@Req() req: any) {
    return this.service.queue(req.user.id);
  }
  @Post('requests')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 },
    }),
  )
  submit(
    @Req() req: any,
    @Body() dto: ProfileRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let changes: unknown;
    try {
      changes = JSON.parse(dto.changes);
    } catch {
      throw new BadRequestException('Invalid changes JSON.');
    }
    return this.service.submit(req.user.id, changes, dto.revision, file);
  }
  @Post('requests/:id/approve') approve(
    @Req() req: any,
    @Param('id') id: string,
    @Body() _dto: DecisionDto,
  ) {
    return this.service.decide(req.user.id, id, 'APPROVED');
  }
  @Post('requests/:id/reject') reject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.service.decide(req.user.id, id, 'REJECTED', dto.reason);
  }
  @Post('requests/:id/cancel') cancel(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.service.cancel(req.user.id, id);
  }
  @Get('photo') async photo(@Req() req: any, @Res() res: Response) {
    return this.stream(req.user.id, res);
  }
  @Get('requests/:id/photo') async proposedPhoto(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.stream(req.user.id, res, id);
  }
  private async stream(actorId: string, res: Response, id?: string) {
    const file = await this.service.photo(actorId, id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    file.stream.on('error', () => res.destroy());
    file.stream.pipe(res);
  }
}
