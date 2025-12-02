import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '@/email/email.service';
import { InvitationService } from '@/invitation/invitation.service';

jest.mock('bcryptjs');

describe('UserService', () => {
  let service: UserService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    username: 'testuser',
    phone: '+1234567890',
    avatarUrl: null,
    subscriptionTier: SubscriptionTier.FREE,
    subscriptionExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    isActive: true,
    emailVerified: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            resume: {
              findMany: jest.fn(),
            },
            job: {
              findMany: jest.fn(),
            },
            optimization: {
              findMany: jest.fn(),
            },
            generatedPDF: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
        {
          provide: InvitationService,
          useValue: {
            validateCode: jest.fn().mockResolvedValue(true),
            markAsUsed: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        username: 'newuser',
        phone: '+1234567890',
        invitationCode: 'INVITE123',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        username: registerDto.username,
      });
      (jwtService.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe('jwt-token');
      expect(result.user.email).toBe(registerDto.email);
      expect(prismaService.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        invitationCode: 'INVITE123',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('jwt-token');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'SecurePassword123!',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify token and return user', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        email: 'test@example.com',
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.verifyToken('valid-token');

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyToken('invalid-token')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        email: 'test@example.com',
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.verifyToken('valid-token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('deleteAccount', () => {
    it('should delete user account successfully', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.delete as jest.Mock).mockResolvedValue(mockUser);

      await service.deleteAccount('user-1');

      expect(prismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteAccount('nonexistent-user')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateSubscription', () => {
    it('should update user subscription to PRO', async () => {
      const updatedUser = {
        ...mockUser,
        subscriptionTier: SubscriptionTier.PRO,
        subscriptionExpiresAt: expect.any(Date),
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateSubscription(
        'user-1',
        SubscriptionTier.PRO
      );

      expect(result.subscriptionTier).toBe(SubscriptionTier.PRO);
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('should set subscriptionExpiresAt to null for FREE tier', async () => {
      const updatedUser = {
        ...mockUser,
        subscriptionTier: SubscriptionTier.FREE,
        subscriptionExpiresAt: null,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        subscriptionTier: SubscriptionTier.PRO,
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateSubscription(
        'user-1',
        SubscriptionTier.FREE
      );

      expect(result.subscriptionExpiresAt).toBeNull();
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateSubscription('nonexistent-user', SubscriptionTier.PRO)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent-user')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('exportUserData', () => {
    it('should export all user data successfully', async () => {
      const mockResumes = [
        {
          id: 'resume-1',
          title: 'Resume 1',
          version: 1,
          isPrimary: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          parsedData: { name: 'John Doe' },
        },
      ];

      const mockJobs = [
        {
          id: 'job-1',
          title: 'Software Engineer',
          company: 'Tech Corp',
          location: 'San Francisco',
          jobDescription: 'We are hiring...',
          requirements: 'Requirements...',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockOptimizations = [
        {
          id: 'opt-1',
          resumeId: 'resume-1',
          jobId: 'job-1',
          matchScore: { overall: 85 },
          suggestions: [],
          status: 'COMPLETED',
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ];

      const mockPdfs = [
        {
          id: 'pdf-1',
          templateId: 'template-1',
          downloadCount: 2,
          createdAt: new Date(),
        },
      ];

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.resume.findMany as jest.Mock).mockResolvedValue(
        mockResumes
      );
      (prismaService.job.findMany as jest.Mock).mockResolvedValue(mockJobs);
      (prismaService.optimization.findMany as jest.Mock).mockResolvedValue(
        mockOptimizations
      );
      (prismaService.generatedPDF.findMany as jest.Mock).mockResolvedValue(
        mockPdfs
      );

      const result = await service.exportUserData('user-1');

      expect(result.user.id).toBe('user-1');
      expect(result.user.email).toBe('test@example.com');
      expect(result.resumes).toEqual(mockResumes);
      expect(result.jobs).toEqual(mockJobs);
      expect(result.optimizations).toEqual(mockOptimizations);
      expect(result.generatedPdfs).toEqual(mockPdfs);
      expect(result.exportedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.exportUserData('nonexistent-user')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should return empty arrays if user has no data', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.resume.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.job.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.optimization.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.generatedPDF.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.exportUserData('user-1');

      expect(result.resumes).toEqual([]);
      expect(result.jobs).toEqual([]);
      expect(result.optimizations).toEqual([]);
      expect(result.generatedPdfs).toEqual([]);
    });
  });
  describe('validateOAuthLogin', () => {
    const oauthProfile = {
      email: 'oauth@example.com',
      username: 'OAuth User',
      avatarUrl: 'http://example.com/avatar.jpg',
      provider: 'google',
      providerId: '123456',
    };

    it('should return existing user if found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateOAuthLogin(oauthProfile);

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: oauthProfile.email },
      });
    });

    it('should create new user if not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: oauthProfile.email,
        username: oauthProfile.username,
        avatarUrl: oauthProfile.avatarUrl,
      });

      const result = await service.validateOAuthLogin(oauthProfile);

      expect(result.email).toBe(oauthProfile.email);
      expect(prismaService.user.create).toHaveBeenCalled();
    });
  });
});
