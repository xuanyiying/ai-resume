import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OssFactory } from './providers/oss.factory';
import { OssService } from './providers/oss.interface';
import { FileType, OssType } from './interfaces/storage.interface';
import { OssConfigService } from './config/oss.config';
import { ChunkUploadSessionService } from './services/chunk-upload-session.service';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

@Injectable()
export class DirectUploadService {
  private readonly logger = new Logger(DirectUploadService.name);
  private ossService: OssService;

  constructor(
    private prisma: PrismaService,
    private ossConfigService: OssConfigService,
    private chunkUploadSessionService: ChunkUploadSessionService
  ) {
    const config = this.ossConfigService.getConfig();
    this.ossService = OssFactory.getInstance(config);
  }

  /**
   * Generate presigned upload URL for direct upload
   */
  async generatePresignedUrl(request: {
    userId: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    fileType: FileType;
    category?: string;
    expires?: number;
  }) {
    const {
      userId,
      fileName,
      fileSize,
      contentType,
      fileType,
      category,
      expires = 3600,
    } = request;

    this.validateFile(fileName, fileSize, contentType, fileType);

    const ossKey = this.generateOssKey(userId, fileName, fileType, category);
    const presignedUrl = await this.ossService.getPresignedUploadUrl(
      ossKey,
      expires,
      contentType
    );

    const sessionId = uuidv4();

    this.logger.log(`Presigned URL generated: ${sessionId}`);

    return {
      presignedUrl,
      uploadSessionId: sessionId,
      ossKey,
      expires,
    };
  }

  /**
   * Initialize chunk upload session
   */
  async initializeChunkUpload(request: {
    userId: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    fileType: FileType;
    category?: string;
    totalChunks: number;
    chunkSize: number;
  }) {
    const {
      userId,
      fileName,
      fileSize,
      contentType,
      fileType,
      category = 'other',
      totalChunks,
      chunkSize,
    } = request;

    this.validateFile(fileName, fileSize, contentType, fileType);

    const ossKey = this.generateOssKey(userId, fileName, fileType, category);

    const session = await this.chunkUploadSessionService.createSession(
      userId,
      fileName,
      fileSize,
      contentType,
      fileType,
      category,
      ossKey,
      totalChunks,
      { chunkSize }
    );

    this.logger.log(`Chunk upload session initialized: ${session.id}`);

    return {
      uploadSessionId: session.id,
      ossKey,
      totalChunks,
      chunkSize,
    };
  }

  /**
   * Generate presigned URL for chunk upload
   */
  async generateChunkUploadUrl(request: {
    uploadSessionId: string;
    userId: string;
    chunkIndex: number;
    expires?: number;
  }) {
    const { uploadSessionId, userId, chunkIndex, expires = 3600 } = request;

    const session =
      await this.chunkUploadSessionService.getSession(uploadSessionId);

    if (!session) {
      throw new Error('Upload session not found');
    }

    if (session.userId !== userId) {
      throw new Error('Permission denied');
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new Error(`Upload session is ${session.status}`);
    }

    // Generate chunk-specific key
    const chunkKey = `${session.ossKey}.part${chunkIndex}`;
    const presignedUrl = await this.ossService.getPresignedUploadUrl(
      chunkKey,
      expires,
      session.contentType
    );

    return {
      presignedUrl,
      chunkIndex,
      chunkKey,
      expires,
    };
  }

  /**
   * Confirm chunk uploaded
   */
  async confirmChunkUploaded(request: {
    uploadSessionId: string;
    userId: string;
    chunkIndex: number;
  }) {
    const { uploadSessionId, userId, chunkIndex } = request;

    const session =
      await this.chunkUploadSessionService.getSession(uploadSessionId);

    if (!session) {
      throw new Error('Upload session not found');
    }

    if (session.userId !== userId) {
      throw new Error('Permission denied');
    }

    await this.chunkUploadSessionService.markChunkUploaded(
      uploadSessionId,
      chunkIndex
    );

    // Check if all chunks are uploaded
    const isComplete =
      await this.chunkUploadSessionService.isUploadComplete(uploadSessionId);

    if (isComplete) {
      await this.chunkUploadSessionService.updateSessionStatus(
        uploadSessionId,
        'completed'
      );
      this.logger.log(`All chunks uploaded for session: ${uploadSessionId}`);
    }

    return {
      chunkIndex,
      uploaded: true,
      isComplete,
    };
  }

  /**
   * Complete chunk upload and merge chunks
   */
  async completeChunkUpload(request: {
    uploadSessionId: string;
    userId: string;
  }) {
    const { uploadSessionId, userId } = request;

    const session =
      await this.chunkUploadSessionService.getSession(uploadSessionId);

    if (!session) {
      throw new Error('Upload session not found');
    }

    if (session.userId !== userId) {
      throw new Error('Permission denied');
    }

    const isComplete =
      await this.chunkUploadSessionService.isUploadComplete(uploadSessionId);

    if (!isComplete) {
      throw new Error('Not all chunks have been uploaded');
    }

    // Calculate MD5 hash based on file metadata
    // Since the file is uploaded in chunks to OSS, calculating content MD5 would be expensive
    // Using metadata (filename, size, content type, user, ossKey) to generate a unique hash
    const md5 = this.calculateMetadataMd5({
      fileName: session.fileName,
      fileSize: session.fileSize,
      contentType: session.contentType,
      userId: session.userId,
      ossKey: session.ossKey,
    });

    // Create file record in database
    const file = await this.prisma.storage.create({
      data: {
        filename: session.fileName,
        originalName: session.fileName,
        mimeType: session.contentType,
        fileSize: session.fileSize,
        fileUrl: this.ossService.getFileUrl(session.ossKey),
        filePath: session.ossKey,
        hashMd5: md5,
        fileType: this.mapFileTypeToEnum(session.fileType),
        userId: session.userId,
        ossType: this.ossConfigService.getOssType() as OssType,
        isPublic: false,
        category: session.category,
      },
    });

    // Clean up session
    await this.chunkUploadSessionService.deleteSession(uploadSessionId);

    this.logger.log(`Chunk upload completed: ${file.id}`);

    return {
      fileId: file.id,
      filename: file.filename,
      originalName: file.originalName,
      fileSize: file.fileSize,
      fileUrl: file.fileUrl,
      uploadedAt: file.createdAt,
    };
  }

  /**
   * Confirm upload completion
   */
  async confirmUpload(request: {
    uploadSessionId: string;
    userId: string;
    actualFileSize?: number;
  }) {
    const { uploadSessionId, userId, actualFileSize } = request;

    // Create file record in database
    const file = await this.prisma.storage.create({
      data: {
        filename: uploadSessionId,
        originalName: uploadSessionId,
        mimeType: 'application/octet-stream',
        fileSize: actualFileSize || 0,
        fileUrl: '',
        filePath: uploadSessionId,
        hashMd5: uuidv4(),
        fileType: FileType.OTHER,
        userId,
        ossType: this.ossConfigService.getOssType() as OssType,
        isPublic: false,
      },
    });

    this.logger.log(`Upload confirmed: ${uploadSessionId}`);

    return {
      fileId: file.id,
      filename: file.filename,
      originalName: file.originalName,
      fileSize: file.fileSize,
      uploadedAt: file.createdAt,
    };
  }

  /**
   * Cancel upload
   */
  async cancelUpload(userId: string, uploadSessionId: string): Promise<void> {
    const session =
      await this.chunkUploadSessionService.getSession(uploadSessionId);

    if (session) {
      if (session.userId !== userId) {
        throw new Error('Permission denied');
      }

      await this.chunkUploadSessionService.updateSessionStatus(
        uploadSessionId,
        'cancelled'
      );
    }

    this.logger.log(`Upload cancelled: ${uploadSessionId}`);
  }

  /**
   * Get upload progress
   */
  async getUploadProgress(userId: string, uploadSessionId: string) {
    const progress =
      await this.chunkUploadSessionService.getProgress(uploadSessionId);

    if (!progress) {
      return {
        uploadSessionId,
        status: 'not_found',
        fileName: 'unknown',
        fileSize: 0,
        fileType: 'image',
      };
    }

    return progress;
  }

  /**
   * Private helper methods
   */

  private validateFile(
    fileName: string,
    fileSize: number,
    contentType: string,
    fileType: string
  ): void {
    // Define file type configurations
    const fileTypeConfigs: Record<
      string,
      { maxSize: number; allowedTypes: string[] }
    > = {
      image: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
        ],
      },
      video: {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedTypes: [
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
          'video/x-msvideo',
        ],
      },
      document: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
      },
      audio: {
        maxSize: 20 * 1024 * 1024, // 20MB
        allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
      },
      other: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['*'],
      },
    };

    const config = fileTypeConfigs[fileType];

    if (!config) {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    if (fileSize > config.maxSize) {
      throw new Error(
        `File size exceeds limit: ${Math.round(config.maxSize / 1024 / 1024)}MB`
      );
    }

    if (
      !config.allowedTypes.includes('*') &&
      !config.allowedTypes.includes(contentType)
    ) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    if (!fileName || fileName.length > 255) {
      throw new Error('Invalid filename');
    }
  }

  private generateOssKey(
    userId: string,
    fileName: string,
    fileType: FileType,
    category?: string
  ): string {
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 8);
    const ext = fileName.split('.').pop();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

    return `${fileType}s/${category}/${userId}/${timestamp}_${randomId}_${sanitizedName}.${ext}`;
  }

  private mapFileTypeToEnum(fileType: string): FileType {
    const mapping: Record<string, FileType> = {
      video: FileType.VIDEO,
      image: FileType.IMAGE,
      document: FileType.DOCUMENT,
      audio: FileType.AUDIO,
    };
    return mapping[fileType] || FileType.OTHER;
  }

  /**
   * Calculate MD5 hash based on file metadata
   * This provides a unique identifier for the file without needing to download/read the entire file
   */
  private calculateMetadataMd5(metadata: {
    fileName: string;
    fileSize: number;
    contentType: string;
    userId: string;
    ossKey: string;
  }): string {
    const dataToHash = JSON.stringify({
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      contentType: metadata.contentType,
      userId: metadata.userId,
      ossKey: metadata.ossKey,
      timestamp: Date.now(),
    });

    return createHash('md5').update(dataToHash).digest('hex');
  }
}
