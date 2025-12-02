import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ParseStatus } from '@prisma/client';
import { ResumeService } from './resume.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIEngine } from '../ai/ai.engine';
import { StorageService } from '../storage/storage.service';
import { AIQueueService } from '../ai/queue/ai-queue.service';
import * as fs from 'fs';

jest.mock('fs');

describe('ResumeService', () => {
  let service: ResumeService;
  let prismaService: PrismaService;

  const mockResume = {
    id: 'resume-1',
    userId: 'user-1',
    title: 'My Resume',
    originalFilename: 'resume.pdf',
    fileUrl: '/uploads/resume.pdf',
    fileType: 'pdf',
    fileSize: 1024000,
    parsedData: null,
    version: 1,
    isPrimary: false,
    parseStatus: ParseStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFile = {
    fieldname: 'file',
    originalname: 'resume.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024000,
    destination: '/uploads',
    filename: 'resume.pdf',
    path: '/uploads/resume.pdf',
    buffer: Buffer.from('test'),
  } as Express.Multer.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeService,
        {
          provide: PrismaService,
          useValue: {
            resume: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: AIEngine,
          useValue: {
            extractTextFromFile: jest.fn(),
            parseResumeContent: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadFile: jest.fn().mockResolvedValue({
              id: 'file-1',
              filename: 'resume.pdf',
              originalName: 'resume.pdf',
              fileSize: 1024000,
              mimeType: 'application/pdf',
              url: '/uploads/resume.pdf',
              fileType: 'DOCUMENT',
              createdAt: new Date(),
              updatedAt: new Date(),
              userId: 'user-1',
              isPublic: false,
            }),
            deleteFile: jest.fn(),
            getFile: jest.fn(),
          },
        },
        {
          provide: AIQueueService,
          useValue: {
            addJob: jest.fn(),
            getJob: jest.fn(),
            addResumeParsingJob: jest.fn().mockResolvedValue({
              id: 'job-1',
              finished: jest.fn().mockResolvedValue({
                personalInfo: { name: 'John Doe', email: 'john@example.com' },
                education: [],
                experience: [],
                skills: [],
                projects: [],
              }),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ResumeService>(ResumeService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadResume', () => {
    it('should upload a PDF file successfully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => { });
      (prismaService.resume.create as jest.Mock).mockResolvedValue(mockResume);

      const result = await service.uploadResume(
        'user-1',
        mockFile,
        'My Resume'
      );

      expect(result.id).toBe('resume-1');
      expect(result.fileType).toBe('pdf');
      expect(prismaService.resume.create).toHaveBeenCalled();
    });

    it('should upload a DOCX file successfully', async () => {
      const docxFile = {
        ...mockFile,
        originalname: 'resume.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => { });
      (prismaService.resume.create as jest.Mock).mockResolvedValue({
        ...mockResume,
        fileType: 'docx',
      });

      const result = await service.uploadResume('user-1', docxFile);

      expect(result.fileType).toBe('docx');
    });

    it('should upload a TXT file successfully', async () => {
      const txtFile = {
        ...mockFile,
        originalname: 'resume.txt',
        mimetype: 'text/plain',
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => { });
      (prismaService.resume.create as jest.Mock).mockResolvedValue({
        ...mockResume,
        fileType: 'txt',
      });

      const result = await service.uploadResume('user-1', txtFile);

      expect(result.fileType).toBe('txt');
    });

    it('should throw BadRequestException if no file provided', async () => {
      await expect(
        service.uploadResume('user-1', null as unknown)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file exceeds size limit', async () => {
      const largeFile = {
        ...mockFile,
        size: 11 * 1024 * 1024, // 11MB
      };

      await expect(service.uploadResume('user-1', largeFile)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if file format is not supported', async () => {
      const unsupportedFile = {
        ...mockFile,
        originalname: 'resume.exe',
        mimetype: 'application/x-msdownload',
      };

      await expect(
        service.uploadResume('user-1', unsupportedFile)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file extension is not supported', async () => {
      const unsupportedFile = {
        ...mockFile,
        originalname: 'resume.jpg',
        mimetype: 'image/jpeg',
      };

      await expect(
        service.uploadResume('user-1', unsupportedFile)
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload resume using storage service', async () => {
      (prismaService.resume.create as jest.Mock).mockResolvedValue(mockResume);

      const result = await service.uploadResume('user-1', mockFile);

      expect(result.id).toBe('resume-1');
      expect(prismaService.resume.create).toHaveBeenCalled();
    });
  });

  describe('getResume', () => {
    it('should get resume by ID', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );

      const result = await service.getResume('resume-1', 'user-1');

      expect(result.id).toBe('resume-1');
    });

    it('should throw NotFoundException if resume not found', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getResume('nonexistent-resume', 'user-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own resume', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );

      await expect(
        service.getResume('resume-1', 'different-user')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listResumes', () => {
    it('should list all resumes for a user', async () => {
      const mockResumes = [mockResume, { ...mockResume, id: 'resume-2' }];
      (prismaService.resume.findMany as jest.Mock).mockResolvedValue(
        mockResumes
      );

      const result = await service.listResumes('user-1');

      expect(result).toHaveLength(2);
      expect(prismaService.resume.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array if user has no resumes', async () => {
      (prismaService.resume.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.listResumes('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('updateResume', () => {
    it('should update resume parsed data and increment version', async () => {
      const parsedData = {
        personalInfo: { name: 'John Doe', email: 'john@example.com' },
        education: [],
        experience: [],
        skills: ['JavaScript', 'TypeScript'],
      };

      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );
      (prismaService.resume.update as jest.Mock).mockResolvedValue({
        ...mockResume,
        parsedData,
        parseStatus: ParseStatus.COMPLETED,
        version: 2,
      });

      const result = await service.updateResume('resume-1', 'user-1', {
        parsedData,
      });

      expect(result.parseStatus).toBe(ParseStatus.COMPLETED);
      expect(result.version).toBe(2);
      expect(prismaService.resume.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
          }),
        })
      );
    });

    it('should throw ForbiddenException if user does not own resume', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );

      await expect(
        service.updateResume('resume-1', 'different-user', {})
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteResume', () => {
    it('should delete resume and file', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.unlinkSync as jest.Mock).mockImplementation(() => { });
      (prismaService.resume.delete as jest.Mock).mockResolvedValue(mockResume);

      await service.deleteResume('resume-1', 'user-1');

      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(prismaService.resume.delete).toHaveBeenCalledWith({
        where: { id: 'resume-1' },
      });
    });

    it('should delete resume even if file does not exist', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (prismaService.resume.delete as jest.Mock).mockResolvedValue(mockResume);

      await service.deleteResume('resume-1', 'user-1');

      expect(prismaService.resume.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user does not own resume', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );

      await expect(
        service.deleteResume('resume-1', 'different-user')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setPrimaryResume', () => {
    it('should set resume as primary', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );
      (prismaService.resume.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prismaService.resume.update as jest.Mock).mockResolvedValue({
        ...mockResume,
        isPrimary: true,
      });

      const result = await service.setPrimaryResume('resume-1', 'user-1');

      expect(result.isPrimary).toBe(true);
      expect(prismaService.resume.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', isPrimary: true },
        })
      );
    });

    it('should throw ForbiddenException if user does not own resume', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );

      await expect(
        service.setPrimaryResume('resume-1', 'different-user')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('parseResume', () => {
    it('should return cached parsed data if already completed', async () => {
      const parsedData = {
        personalInfo: { name: 'John Doe', email: 'john@example.com' },
        education: [],
        experience: [],
        skills: [],
        projects: [],
      };

      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue({
        ...mockResume,
        parseStatus: ParseStatus.COMPLETED,
        parsedData,
      });

      const result = await service.parseResume('resume-1', 'user-1');

      expect(result).toEqual(parsedData);
    });

    it('should parse resume and update database', async () => {
      const parsedData = {
        personalInfo: { name: 'John Doe', email: 'john@example.com' },
        education: [],
        experience: [],
        skills: ['JavaScript', 'TypeScript'],
        projects: [],
      };

      const aiEngine = service['aiEngine'];
      const aiQueueService = service['aiQueueService'];

      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        Buffer.from('test content')
      );
      (aiEngine.extractTextFromFile as jest.Mock).mockResolvedValue(
        'John Doe\\njohn@example.com'
      );
      (aiQueueService.addResumeParsingJob as jest.Mock).mockResolvedValue({
        id: 'job-1',
        finished: jest.fn().mockResolvedValue(parsedData),
      });
      (prismaService.resume.update as jest.Mock).mockResolvedValue({
        ...mockResume,
        parseStatus: ParseStatus.PROCESSING,
      });

      const result = await service.parseResume('resume-1', 'user-1');

      expect(result).toEqual(parsedData);
      expect(aiQueueService.addResumeParsingJob).toHaveBeenCalledWith(
        'resume-1',
        'user-1',
        'John Doe\\njohn@example.com'
      );
      // Verify status was updated to PROCESSING when job started
      expect(prismaService.resume.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'resume-1' },
          data: expect.objectContaining({
            parseStatus: ParseStatus.PROCESSING,
          }),
        })
      );
    });

    it('should update status to PROCESSING when parsing starts', async () => {
      const aiEngine = service['aiEngine'];

      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('test'));
      (aiEngine.extractTextFromFile as jest.Mock).mockResolvedValue('content');
      (aiEngine.parseResumeContent as jest.Mock).mockResolvedValue({
        personalInfo: { name: 'John', email: 'john@example.com' },
        education: [],
        experience: [],
        skills: [],
        projects: [],
      });
      (prismaService.resume.update as jest.Mock).mockResolvedValue({
        ...mockResume,
        parseStatus: ParseStatus.COMPLETED,
      });

      await service.parseResume('resume-1', 'user-1');

      // Check that status was updated to PROCESSING
      expect(prismaService.resume.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parseStatus: ParseStatus.PROCESSING,
          }),
        })
      );
    });

    it('should set status to FAILED if parsing fails', async () => {
      const aiEngine = service['aiEngine'];

      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('test'));
      (aiEngine.extractTextFromFile as jest.Mock).mockRejectedValue(
        new Error('Parse error')
      );
      (prismaService.resume.update as jest.Mock).mockResolvedValue({
        ...mockResume,
        parseStatus: ParseStatus.FAILED,
      });

      await expect(service.parseResume('resume-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );

      // Check that status was updated to FAILED
      expect(prismaService.resume.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parseStatus: ParseStatus.FAILED,
          }),
        })
      );
    });

    it('should throw error if resume file not found', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (prismaService.resume.update as jest.Mock).mockResolvedValue({
        ...mockResume,
        parseStatus: ParseStatus.FAILED,
      });

      await expect(service.parseResume('resume-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw ForbiddenException if user does not own resume', async () => {
      (prismaService.resume.findUnique as jest.Mock).mockResolvedValue(
        mockResume
      );

      await expect(
        service.parseResume('resume-1', 'different-user')
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
