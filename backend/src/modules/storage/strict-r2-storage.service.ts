import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const DEFAULT_PLACEHOLDER_KEY = 'defaults/student-placeholder.png';

// 1x1 transparent PNG fallback or standard default avatar buffer if placeholder isn't in R2 yet
const DEFAULT_AVATAR_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAF0SURBVHic7dAxTgMxEEBhNykoUCAaOhpKSslVqByCE3IFLsABuALHIbiCghIJKAhRQggoIOTE/5aVn2x5Z71ee3dd10VRFMVv8zL7ACw2h1g6hNL9F27v7+/v102apqnruk3TNE/TNG/btt3tPn6Lne/7/v319fXt6+urO4fQnUPIOYRO5xALnUMsdA6x0DnEQucQC51DLHQOsdA5xELnEAuNQyw0DrHQOcRC5xALnUMsdA6x0DnEQucQC51DLHQOsdA5xELnEAuNQyw0DrHQOcRC5xALnUMsdA6x0DnEQucQC51DLHQOsdA5xELnEAudQyx0DrHQOcRC5xALnUMsdA6x0DnEQucQC51DLHQOsdA5xELnEAuNQyw0DrHQOcRC5xALnUMsdA6x0DnEQucQC51DLHQOsdA5xELnEAuNQyw0DrHQOcRC5xALnUMsdA6x0DnEQucQC51DLHQOsdA5xELnEAuNQyw0DrHQOcRC5xAL/QY7v3yV9P2F3gAAAABJRU5ErkJggg==',
  'base64'
);

@Injectable()
export class StrictR2StorageService {
  private readonly logger = new Logger(StrictR2StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKey = this.configService.get<string>('R2_ACCESS_KEY');
    const secretKey = this.configService.get<string>('R2_SECRET_KEY');
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || null;

    if (accountId && accessKey && secretKey && this.bucketName) {
      this.logger.log('Initializing Strict Cloudflare R2 Client (No Local Disk Fallback)...');
      this.s3Client = new S3Client({
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        region: 'auto',
      });
    } else {
      this.logger.warn('Strict R2 Storage: R2 Credentials missing in environment variables.');
    }
  }

  private assertR2Client(): { client: S3Client; bucket: string } {
    if (!this.s3Client || !this.bucketName) {
      throw new InternalServerErrorException(
        'Cloudflare R2 Storage is not configured. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, or R2_BUCKET_NAME.',
      );
    }
    return { client: this.s3Client, bucket: this.bucketName };
  }

  getDefaultPlaceholderKey(): string {
    return DEFAULT_PLACEHOLDER_KEY;
  }

  async uploadStudentPhoto(
    fileBuffer: Buffer,
    originalFilename: string,
    contentType: string,
  ): Promise<string> {
    const { client, bucket } = this.assertR2Client();

    const ext = originalFilename.split('.').pop() || 'png';
    const key = `student-photos/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
        }),
      );
      this.logger.log(`Strict R2 Upload Success: ${key}`);
      return key;
    } catch (err: any) {
      this.logger.error(`Strict R2 Upload Failed for key: ${key}`, err?.stack || err);
      throw new InternalServerErrorException(
        `Failed to upload student photo to Cloudflare R2: ${err?.message || 'Upload error'}`,
      );
    }
  }

  async ensureDefaultPlaceholder(): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      return DEFAULT_PLACEHOLDER_KEY;
    }

    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: DEFAULT_PLACEHOLDER_KEY,
        }),
      );
    } catch {
      // Placeholder doesn't exist in R2 yet, upload default avatar
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: DEFAULT_PLACEHOLDER_KEY,
            Body: DEFAULT_AVATAR_PNG,
            ContentType: 'image/png',
          }),
        );
        this.logger.log(`Uploaded default student placeholder image to R2: ${DEFAULT_PLACEHOLDER_KEY}`);
      } catch (err: any) {
        this.logger.warn(`Failed to seed default placeholder in R2: ${err?.message}`);
      }
    }

    return DEFAULT_PLACEHOLDER_KEY;
  }

  async getObjectStream(key: string): Promise<{ stream: Readable; contentType: string }> {
    const safeKey = key || DEFAULT_PLACEHOLDER_KEY;
    
    if (!this.s3Client || !this.bucketName) {
      // Return inline default avatar stream if R2 is not configured
      const readable = new Readable();
      readable.push(DEFAULT_AVATAR_PNG);
      readable.push(null);
      return { stream: readable, contentType: 'image/png' };
    }

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: safeKey,
        }),
      );

      if (!response.Body) {
        throw new NotFoundException(`File body not found for key: ${safeKey}`);
      }

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType || 'image/png',
      };
    } catch (err: any) {
      if (safeKey !== DEFAULT_PLACEHOLDER_KEY) {
        // Fallback to placeholder if specific key fails
        return this.getObjectStream(DEFAULT_PLACEHOLDER_KEY);
      }
      
      const readable = new Readable();
      readable.push(DEFAULT_AVATAR_PNG);
      readable.push(null);
      return { stream: readable, contentType: 'image/png' };
    }
  }
}
