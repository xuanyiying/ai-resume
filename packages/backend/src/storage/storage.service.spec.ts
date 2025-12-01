import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { OssConfigService } from './config/oss.config';
import { OssFactory } from './providers/oss.factory';
import { FileType, OssType } from './interfaces/storage.interface';

// Mock dependencies
const mockPrismaService = {
  storage: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
};

const mockOssConfigService = {
  getConfig: jest.fn().mockReturnValue({
    type: OssType.MINIO,
    config: {},
  }),
};

const mockOssService = {
  uploadFile: jest.fn(),
  downloadFile: jest.fn(),
  deleteFile: jest.fn(),
};

describe('StorageService', () => {
  let service: StorageService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    // Mock OssFactory.getInstance before creating the module
    jest
      .spyOn(OssFactory, 'getInstance')
      .mockReturnValue(mockOssService as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OssConfigService, useValue: mockOssConfigService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      const uploadData = {
        originalName: 'test.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('test'),
        userId: 'user-1',
        fileType: FileType.IMAGE,
      };

      const uploadResult = {
        key: 'images/test.png',
        url: 'http://localhost:9000/bucket/images/test.png',
        size: 1024,
        contentType: 'image/png',
      };

      const storageRecord = {
        id: 'file-1',
        filename: 'test.png',
        originalName: 'test.png',
        mimeType: 'image/png',
        fileSize: 1024,
        fileUrl: uploadResult.url,
        filePath: uploadResult.key,
        hashMd5: '098f6bcd4621d373cade4e832627b4f6',
        fileType: FileType.IMAGE,
        userId: 'user-1',
        ossType: OssType.MINIO,
        isPublic: false,
        downloadCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOssService.uploadFile.mockResolvedValue(uploadResult);
      prisma.storage.findFirst.mockResolvedValue(null);
      prisma.storage.create.mockResolvedValue(storageRecord);

      const result = await service.uploadFile(uploadData);

      expect(mockOssService.uploadFile).toHaveBeenCalled();
      expect(prisma.storage.create).toHaveBeenCalled();
      expect(result.id).toBe('file-1');
      expect(result.url).toBe(uploadResult.url);
    });

    it('should return existing file if duplicate found', async () => {
      const uploadData = {
        originalName: 'test.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('test'),
        userId: 'user-1',
        fileType: FileType.IMAGE,
      };

      const existingFile = {
        id: 'file-existing',
        filename: 'test.png',
        originalName: 'test.png',
        mimeType: 'image/png',
        fileSize: 1024,
        fileUrl: 'http://existing-url',
        filePath: 'images/test.png',
        hashMd5: '098f6bcd4621d373cade4e832627b4f6',
        fileType: FileType.IMAGE,
        userId: 'user-1',
        ossType: OssType.MINIO,
        isPublic: false,
        downloadCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.storage.findFirst.mockResolvedValue(existingFile);

      const result = await service.uploadFile(uploadData);

      expect(mockOssService.uploadFile).not.toHaveBeenCalled();
      expect(prisma.storage.create).not.toHaveBeenCalled();
      expect(result.id).toBe('file-existing');
    });
  });
});
