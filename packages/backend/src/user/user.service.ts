import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, SubscriptionTier } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { Sanitizer } from '@/common/utils/sanitizer';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { EmailService } from '@/email/email.service';
import { InvitationService } from '@/invitation/invitation.service';
import * as crypto from 'crypto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly invitationService: InvitationService
  ) {}

  /**
   * Register a new user
   * Requirement 1.1: Create new user account with valid email and password
   * Requirement 1.5: Use bcrypt to hash passwords
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, username, phone, invitationCode } = registerDto;

    // Validate invitation code
    const isCodeValid =
      await this.invitationService.validateCode(invitationCode);
    if (!isCodeValid) {
      throw new BadRequestException('Invalid or used invitation code');
    }

    // Sanitize email
    const sanitizedEmail = Sanitizer.sanitizeEmail(email);

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password using bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Sanitize optional fields
    const sanitizedUsername = username
      ? Sanitizer.sanitizeString(username)
      : undefined;
    const sanitizedPhone = phone ? Sanitizer.sanitizeString(phone) : undefined;

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user
    const user = await this.prisma.user.create({
      data: {
        email: sanitizedEmail,
        passwordHash,
        username: sanitizedUsername,
        phone: sanitizedPhone,
        subscriptionTier: SubscriptionTier.FREE,
        isActive: true,
        emailVerified: false,
        verificationToken,
      },
    });

    // Mark invitation code as used
    await this.invitationService.markAsUsed(invitationCode, user.id);

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        verificationToken,
        user.username || undefined
      );
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Don't fail registration if email fails, user can resend later
    }

    // Generate JWT token
    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username ?? undefined,
        subscriptionTier: user.subscriptionTier,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    };
  }

  /**
   * Login user
   * Requirement 1.2: Verify credentials and return authentication token
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Sanitize email
    const sanitizedEmail = Sanitizer.sanitizeEmail(email);

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = user.passwordHash && await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login time
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username ?? undefined,
        subscriptionTier: user.subscriptionTier,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    };
  }

  /**
   * Verify JWT token and return user
   * Requirement 1.3: Verify authentication token
   */
  async verifyToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid token');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Delete user account
   * Requirement 1.4: Delete all associated data
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cascade delete will handle related records
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Update user subscription
   */
  async updateSubscription(
    userId: string,
    tier: SubscriptionTier
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tier,
        subscriptionExpiresAt:
          tier !== SubscriptionTier.FREE
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
            : null,
      },
    });
  }

  /**
   * Generate JWT token for user
   */
  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Export user data for GDPR compliance
   * Requirement 1.4: Provide data export functionality
   */
  async exportUserData(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Fetch all user-related data
    const [resumes, jobs, optimizations, generatedPdfs] = await Promise.all([
      this.prisma.resume.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          version: true,
          isPrimary: true,
          createdAt: true,
          updatedAt: true,
          parsedData: true,
        },
      }),
      this.prisma.job.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          jobDescription: true,
          requirements: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.optimization.findMany({
        where: { userId },
        select: {
          id: true,
          resumeId: true,
          jobId: true,
          matchScore: true,
          suggestions: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      this.prisma.generatedPDF.findMany({
        where: { userId },
        select: {
          id: true,
          templateId: true,
          downloadCount: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        subscriptionTier: user.subscriptionTier,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      resumes,
      jobs,
      optimizations,
      generatedPdfs,
      exportedAt: new Date(),
    };
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new NotFoundException('Invalid verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null, // Clear token after usage
      },
    });
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        resetToken,
        user.username || undefined
      );
    } catch (error) {
      console.error('Failed to send password reset email:', error);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });
  }

  /**
   * Validate OAuth login
   */
  async validateOAuthLogin(profile: {
    email: string;
    username: string;
    avatarUrl?: string;
    provider: string;
    providerId: string;
  }): Promise<User> {
    // Check if user exists by email
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      // Create new user if not exists
      // Generate random password since they use OAuth
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          username: profile.username,
          passwordHash,
          subscriptionTier: SubscriptionTier.FREE,
          isActive: true,
          emailVerified: true, // OAuth emails are verified
          avatarUrl: profile.avatarUrl,
        },
      });
    } else {
      // Update existing user info if needed
      // For example, update avatar if not set
      if (!user.avatarUrl && profile.avatarUrl) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl: profile.avatarUrl },
        });
      }
    }

    return user;
  }
}
