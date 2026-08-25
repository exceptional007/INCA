import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;
  private localDir = path.join(process.cwd(), 'uploads', 'timetable-imports');

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKey = this.configService.get<string>('R2_ACCESS_KEY');
    const secretKey = this.configService.get<string>('R2_SECRET_KEY');
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || null;

    if (accountId && accessKey && secretKey && this.bucketName) {
      this.logger.log('Initializing Cloudflare R2 Storage Client...');
      this.s3Client = new S3Client({
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        region: 'auto',
      });
    } else {
      this.logger.warn(
        'R2 Storage credentials not fully set. Falling back to local directory: ' +
          this.localDir,
      );
      if (!fs.existsSync(this.localDir)) {
        fs.mkdirSync(this.localDir, { recursive: true });
      }
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    contentType: string,
  ): Promise<string> {
    const key = `${Date.now()}-${filename}`;
    if (this.s3Client && this.bucketName) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType,
          }),
        );
        this.logger.log(`Uploaded file to R2: ${key}`);
        return key;
      } catch (error) {
        this.logger.error('Failed to upload file to R2, falling back to local...', error);
      }
    }

    // Local fallback
    const filePath = path.join(this.localDir, key);
    await fs.promises.writeFile(filePath, fileBuffer);
    this.logger.log(`Uploaded file to local disk: ${filePath}`);
    return `local://${key}`;
  }

  async getFile(key: string): Promise<Buffer> {
    if (key.startsWith('local://')) {
      const filename = key.replace('local://', '');
      const filePath = path.join(this.localDir, filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found on local disk: ${filePath}`);
      }
      return fs.promises.readFile(filePath);
    }

    if (this.s3Client && this.bucketName) {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      if (response.Body) {
        const chunks: Buffer[] = [];
        for await (const chunk of response.Body as any) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      }
    }

    // Attempt local if key wasn't prefixed but clients are down
    const filePath = path.join(this.localDir, key);
    if (fs.existsSync(filePath)) {
      return fs.promises.readFile(filePath);
    }

    throw new Error(`Failed to retrieve file with key: ${key}`);
  }
}
