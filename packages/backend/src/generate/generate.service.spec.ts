import { Test, TestingModule } from '@nestjs/testing';
import GenerateService, {
  PDFOptions,
  ParsedResumeData,
} from './generate.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { QuotaService } from '../quota/quota.service';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

// Mock Puppeteer to avoid launching browser during tests
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setViewport: jest.fn(),
      setContent: jest.fn(),
      pdf: jest.fn().mockResolvedValue(Buffer.from('PDF content')),
      close: jest.fn(),
    }),
    close: jest.fn(),
  }),
}));

describe('GenerateService', () => {
  let service: GenerateService;

  const mockPrismaService = {
    optimization: {
      findUnique: jest.fn(),
    },
    template: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    generatedPDF: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockStorageService = {
    uploadFile: jest.fn().mockResolvedValue({
      id: 'pdf-1',
      filename: 'resume.pdf',
      originalName: 'resume.pdf',
      fileSize: 102400,
      mimeType: 'application/pdf',
      url: '/uploads/resume.pdf',
      fileType: 'DOCUMENT',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-1',
      isPublic: false,
    }),
    downloadFile: jest.fn().mockResolvedValue({
      buffer: Buffer.from('PDF content'),
      filename: 'resume.pdf',
    }),
    deleteFile: jest.fn(),
    getFileById: jest.fn(),
    cleanupExpiredFiles: jest.fn(),
  };

  const mockQuotaService = {
    enforcePDFGenerationQuota: jest.fn(),
    incrementPDFCount: jest.fn(),
  };

  const mockTemplate = {
    id: 'template-1',
    name: 'classic',
    category: 'basic',
    description: 'Classic resume template',
    previewUrl: 'https://example.com/preview.png',
    isPremium: false,
    isActive: true,
    configuration: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOptimization = {
    id: 'opt-1',
    userId: 'user-1',
    resumeId: 'resume-1',
    jobId: 'job-1',
    matchScore: null,
    suggestions: [],
    optimizedContent: null,
    status: 'COMPLETED',
    createdAt: new Date(),
    completedAt: new Date(),
  };

  const mockResumeData: ParsedResumeData = {
    personalInfo: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-1234',
      location: 'New York, NY',
    },
    summary: 'Experienced software engineer',
    education: [
      {
        institution: 'MIT',
        degree: 'Bachelor',
        field: 'Computer Science',
        startDate: '2015',
        endDate: '2019',
      },
    ],
    experience: [
      {
        company: 'Tech Corp',
        position: 'Senior Engineer',
        startDate: '2019',
        description: ['Led team of 5 engineers', 'Improved performance by 40%'],
        achievements: ['Shipped new feature', 'Mentored 3 junior engineers'],
      },
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    projects: [
      {
        name: 'Project A',
        description: 'A cool project',
        technologies: ['React', 'Node.js'],
        highlights: ['Achieved 99.9% uptime'],
      },
    ],
  };

  const mockPDFOptions: PDFOptions = {
    fontSize: 11,
    colorTheme: 'blue',
    includePhoto: false,
    margin: 'normal',
    visibleSections: ['summary', 'experience', 'education', 'skills'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: QuotaService,
          useValue: mockQuotaService,
        },
      ],
    }).compile();

    service = module.get<GenerateService>(GenerateService);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up browser instance
    await service.onModuleDestroy();
  });

  describe('generatePDF', () => {
    it('should generate PDF successfully', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue(
        mockOptimization
      );
      mockPrismaService.template.findUnique.mockResolvedValue(mockTemplate);
      mockPrismaService.generatedPDF.create.mockResolvedValue({
        id: 'pdf-1',
        userId: 'user-1',
        optimizationId: 'opt-1',
        templateId: 'template-1',
        fileUrl: '/pdfs/resume-opt-1-123456.pdf',
        fileSize: 1024000,
        downloadCount: 0,
        createdAt: new Date(),
        expiresAt: null,
      });

      const result = await service.generatePDF(
        'opt-1',
        'user-1',
        'template-1',
        mockResumeData,
        mockPDFOptions
      );

      expect(result).toBeDefined();
      expect(result.fileUrl).toContain('/pdfs/');
      expect(mockPrismaService.optimization.findUnique).toHaveBeenCalledWith({
        where: { id: 'opt-1' },
      });
      expect(mockPrismaService.template.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });

    it('should throw ForbiddenException if user does not own optimization', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue({
        ...mockOptimization,
        userId: 'different-user',
      });

      await expect(
        service.generatePDF(
          'opt-1',
          'user-1',
          'template-1',
          mockResumeData,
          mockPDFOptions
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if template not found', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue(
        mockOptimization
      );
      mockPrismaService.template.findUnique.mockResolvedValue(null);

      await expect(
        service.generatePDF(
          'opt-1',
          'user-1',
          'template-1',
          mockResumeData,
          mockPDFOptions
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if optimization not found', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue(null);

      await expect(
        service.generatePDF(
          'opt-1',
          'user-1',
          'template-1',
          mockResumeData,
          mockPDFOptions
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('previewPDF', () => {
    it('should return HTML preview successfully', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue(
        mockOptimization
      );
      mockPrismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.previewPDF(
        'opt-1',
        'user-1',
        'template-1',
        mockResumeData,
        mockPDFOptions
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('John Doe');
    });

    it('should throw ForbiddenException if user does not own optimization', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue({
        ...mockOptimization,
        userId: 'different-user',
      });

      await expect(
        service.previewPDF(
          'opt-1',
          'user-1',
          'template-1',
          mockResumeData,
          mockPDFOptions
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getTemplate', () => {
    it('should return template by ID', async () => {
      mockPrismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.getTemplate('template-1');

      expect(result).toEqual(mockTemplate);
      expect(mockPrismaService.template.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });

    it('should throw NotFoundException if template not found', async () => {
      mockPrismaService.template.findUnique.mockResolvedValue(null);

      await expect(service.getTemplate('template-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('listTemplates', () => {
    it('should return list of active templates', async () => {
      const templates = [mockTemplate, { ...mockTemplate, id: 'template-2' }];
      mockPrismaService.template.findMany.mockResolvedValue(templates);

      const result = await service.listTemplates();

      expect(result).toEqual(templates);
      expect(mockPrismaService.template.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array if no templates found', async () => {
      mockPrismaService.template.findMany.mockResolvedValue([]);

      const result = await service.listTemplates();

      expect(result).toEqual([]);
    });
  });

  describe('Template rendering', () => {
    it('should render classic template with resume data', async () => {
      const html = await (service as any).renderTemplate(
        mockTemplate,
        mockResumeData,
        mockPDFOptions
      );

      expect(html).toContain('John Doe');
      expect(html).toContain('john@example.com');
      expect(html).toContain('Tech Corp');
      expect(html).toContain('Senior Engineer');
    });

    it('should render modern template', async () => {
      const modernTemplate = { ...mockTemplate, name: 'modern' };
      const html = await (service as any).renderTemplate(
        modernTemplate,
        mockResumeData,
        mockPDFOptions
      );

      expect(html).toContain('John Doe');
      expect(html).toContain('john@example.com');
    });

    it('should render professional template', async () => {
      const professionalTemplate = { ...mockTemplate, name: 'professional' };
      const html = await (service as any).renderTemplate(
        professionalTemplate,
        mockResumeData,
        mockPDFOptions
      );

      expect(html).toContain('John Doe');
      expect(html).toContain('john@example.com');
    });

    it('should throw BadRequestException for unknown template', () => {
      const unknownTemplate = { ...mockTemplate, name: 'unknown' };

      expect(() => {
        (service as any).renderTemplate(
          unknownTemplate,
          mockResumeData,
          mockPDFOptions
        );
      }).toThrow(BadRequestException);
    });
  });

  describe('Theme colors', () => {
    it('should return correct theme colors for blue', () => {
      const colors = (service as any).getThemeColors('blue');

      expect(colors.primary).toBe('#0066cc');
      expect(colors.secondary).toBe('#e6f0ff');
      expect(colors.accent).toBe('#0052a3');
    });

    it('should return correct theme colors for green', () => {
      const colors = (service as any).getThemeColors('green');

      expect(colors.primary).toBe('#00a86b');
      expect(colors.secondary).toBe('#e6f9f0');
      expect(colors.accent).toBe('#008c5a');
    });

    it('should default to blue for unknown theme', () => {
      const colors = (service as any).getThemeColors('unknown');

      expect(colors.primary).toBe('#0066cc');
    });
  });

  describe('Margin values', () => {
    it('should return correct margins for normal', () => {
      const margins = (service as any).getMarginValues('normal');

      expect(margins.top).toBe(10);
      expect(margins.right).toBe(10);
      expect(margins.bottom).toBe(10);
      expect(margins.left).toBe(10);
    });

    it('should return correct margins for compact', () => {
      const margins = (service as any).getMarginValues('compact');

      expect(margins.top).toBe(8);
      expect(margins.right).toBe(8);
      expect(margins.bottom).toBe(8);
      expect(margins.left).toBe(8);
    });

    it('should return correct margins for wide', () => {
      const margins = (service as any).getMarginValues('wide');

      expect(margins.top).toBe(15);
      expect(margins.right).toBe(15);
      expect(margins.bottom).toBe(15);
      expect(margins.left).toBe(15);
    });

    it('should default to normal for unknown margin', () => {
      const margins = (service as any).getMarginValues('unknown');

      expect(margins.top).toBe(10);
    });
  });

  describe('downloadPDF', () => {
    it('should download PDF and increment download count', async () => {
      const mockPDF = {
        id: 'pdf-1',
        userId: 'user-1',
        optimizationId: 'opt-1',
        templateId: 'template-1',
        fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
        fileSize: 1024000,
        downloadCount: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };

      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(mockPDF);
      mockStorageService.downloadFile.mockResolvedValue({
        buffer: Buffer.from('PDF content'),
        filename: 'resume.pdf',
      });
      mockPrismaService.generatedPDF.update.mockResolvedValue({
        ...mockPDF,
        downloadCount: 1,
      });

      const result = await service.downloadPDF('pdf-1', 'user-1');

      expect(result).toBeDefined();
      expect(mockStorageService.downloadFile).toHaveBeenCalled();
      expect(mockPrismaService.generatedPDF.update).toHaveBeenCalledWith({
        where: { id: 'pdf-1' },
        data: { downloadCount: { increment: 1 } },
      });
    });

    it('should throw NotFoundException if PDF not found', async () => {
      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(null);

      await expect(service.downloadPDF('pdf-1', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if user does not own PDF', async () => {
      const mockPDF = {
        id: 'pdf-1',
        userId: 'different-user',
        optimizationId: 'opt-1',
        templateId: 'template-1',
        fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
        fileSize: 1024000,
        downloadCount: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };

      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(mockPDF);

      await expect(service.downloadPDF('pdf-1', 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw BadRequestException if PDF has expired', async () => {
      const mockPDF = {
        id: 'pdf-1',
        userId: 'user-1',
        optimizationId: 'opt-1',
        templateId: 'template-1',
        fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
        fileSize: 1024000,
        downloadCount: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(mockPDF);

      await expect(service.downloadPDF('pdf-1', 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getGeneratedPDF', () => {
    it('should return PDF details', async () => {
      const mockPDF = {
        id: 'pdf-1',
        userId: 'user-1',
        optimizationId: 'opt-1',
        templateId: 'template-1',
        fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
        fileSize: 1024000,
        downloadCount: 5,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };

      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(mockPDF);

      const result = await service.getGeneratedPDF('pdf-1', 'user-1');

      expect(result).toEqual(mockPDF);
    });

    it('should throw NotFoundException if PDF not found', async () => {
      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(null);

      await expect(service.getGeneratedPDF('pdf-1', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if user does not own PDF', async () => {
      const mockPDF = {
        id: 'pdf-1',
        userId: 'different-user',
        optimizationId: 'opt-1',
        templateId: 'template-1',
        fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
        fileSize: 1024000,
        downloadCount: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };

      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(mockPDF);

      await expect(service.getGeneratedPDF('pdf-1', 'user-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('listGeneratedPDFs', () => {
    it('should list all PDFs for an optimization', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue(
        mockOptimization
      );

      const mockPDFs = [
        {
          id: 'pdf-1',
          userId: 'user-1',
          optimizationId: 'opt-1',
          templateId: 'template-1',
          fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
          fileSize: 1024000,
          downloadCount: 5,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      ];

      mockPrismaService.generatedPDF.findMany.mockResolvedValue(mockPDFs);

      const result = await service.listGeneratedPDFs('opt-1', 'user-1');

      expect(result).toEqual(mockPDFs);
      expect(mockPrismaService.generatedPDF.findMany).toHaveBeenCalledWith({
        where: { optimizationId: 'opt-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw ForbiddenException if user does not own optimization', async () => {
      mockPrismaService.optimization.findUnique.mockResolvedValue({
        ...mockOptimization,
        userId: 'different-user',
      });

      await expect(
        service.listGeneratedPDFs('opt-1', 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteGeneratedPDF', () => {
    it('should delete PDF and remove from storage', async () => {
      const mockPDF = {
        id: 'pdf-1',
        userId: 'user-1',
        optimizationId: 'opt-1',
        templateId: 'template-1',
        fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
        fileSize: 1024000,
        downloadCount: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };

      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(mockPDF);
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      mockPrismaService.generatedPDF.delete.mockResolvedValue(mockPDF);

      await service.deleteGeneratedPDF('pdf-1', 'user-1');

      expect(mockStorageService.deleteFile).toHaveBeenCalled();
      expect(mockPrismaService.generatedPDF.delete).toHaveBeenCalledWith({
        where: { id: 'pdf-1' },
      });
    });

    it('should throw NotFoundException if PDF not found', async () => {
      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteGeneratedPDF('pdf-1', 'user-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own PDF', async () => {
      const mockPDF = {
        id: 'pdf-1',
        userId: 'different-user',
        optimizationId: 'opt-1',
        templateId: 'template-1',
        fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
        fileSize: 1024000,
        downloadCount: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };

      mockPrismaService.generatedPDF.findUnique.mockResolvedValue(mockPDF);

      await expect(
        service.deleteGeneratedPDF('pdf-1', 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cleanupExpiredPDFs', () => {
    it('should delete expired PDFs', async () => {
      const expiredPDF = {
        id: 'pdf-1',
        userId: 'user-1',
        optimizationId: 'opt-1',
        templateId: 'template-1',
        fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
        fileSize: 1024000,
        downloadCount: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      mockPrismaService.generatedPDF.findMany.mockResolvedValue([expiredPDF]);
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      mockPrismaService.generatedPDF.delete.mockResolvedValue(expiredPDF);

      const result = await service.cleanupExpiredPDFs();

      expect(result).toBe(1);
      expect(mockStorageService.deleteFile).toHaveBeenCalled();
      expect(mockPrismaService.generatedPDF.delete).toHaveBeenCalledWith({
        where: { id: 'pdf-1' },
      });
    });

    it('should handle multiple expired PDFs', async () => {
      const expiredPDFs = [
        {
          id: 'pdf-1',
          userId: 'user-1',
          optimizationId: 'opt-1',
          templateId: 'template-1',
          fileUrl: '/uploads/pdfs/resume-opt-1-123456.pdf',
          fileSize: 1024000,
          downloadCount: 0,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() - 1000),
        },
        {
          id: 'pdf-2',
          userId: 'user-1',
          optimizationId: 'opt-2',
          templateId: 'template-1',
          fileUrl: '/uploads/pdfs/resume-opt-2-123457.pdf',
          fileSize: 1024000,
          downloadCount: 0,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() - 1000),
        },
      ];

      mockPrismaService.generatedPDF.findMany.mockResolvedValue(expiredPDFs);
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      mockPrismaService.generatedPDF.delete.mockResolvedValue({});

      const result = await service.cleanupExpiredPDFs();

      expect(result).toBe(2);
      expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.generatedPDF.delete).toHaveBeenCalledTimes(2);
    });

    it('should return 0 if no expired PDFs found', async () => {
      mockPrismaService.generatedPDF.findMany.mockResolvedValue([]);

      const result = await service.cleanupExpiredPDFs();

      expect(result).toBe(0);
    });
  });
});
