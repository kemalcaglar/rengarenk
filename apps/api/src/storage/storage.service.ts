import type { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';

/**
 * Dosya deposu: SeaweedFS (S3 uyumlu, Türkiye'deki sunucuda; Karar 37). Katalog fotoğrafları (Karar 34) ve ileride
 * portföy görselleri burada durur. Dosyalar herkese açık değildir; API üzerinden sunulur.
 */
export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Readable; contentType: string | undefined; length: number | undefined }>;
}

export const STORAGE = Symbol('STORAGE');

@Injectable()
export class S3Storage implements Storage {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private ready: Promise<void> | null = null;

  constructor(@Inject(ENV) env: Env) {
    this.bucket = env.S3_BUCKET;
    this.s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    });
  }

  /** Kova yoksa bir kez açılır (yerel ve prova ortamı). */
  private ensureBucket() {
    this.ready ??= this.s3
      .send(new HeadBucketCommand({ Bucket: this.bucket }))
      .then(() => undefined)
      .catch(async () => {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      })
      .catch((err: unknown) => {
        this.ready = null;
        throw err;
      });
    return this.ready;
  }

  async put(key: string, body: Uint8Array, contentType: string) {
    await this.ensureBucket();
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string) {
    const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return { body: r.Body as Readable, contentType: r.ContentType, length: r.ContentLength };
  }
}

@Global()
@Module({ providers: [{ provide: STORAGE, useClass: S3Storage }], exports: [STORAGE] })
export class StorageModule {}
