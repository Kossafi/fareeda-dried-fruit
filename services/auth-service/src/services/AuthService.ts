import { UserModel } from '../models/User';
import { SessionModel } from '../models/Session';
import { CryptoUtils } from '../utils/crypto';
import { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  ChangePasswordRequest,
  User,
  UserRole,
  UserStatus 
} from '@dried-fruits/types';
import { validateEmail, validatePassword } from '@dried-fruits/utils';
import logger from '../utils/logger';

export class AuthService {
  private userModel = new UserModel();
  private sessionModel = new SessionModel();

  async register(request: RegisterRequest, registeredBy?: string): Promise<User> {
    // Validate input
    if (!validateEmail(request.email)) {
      throw new Error('Invalid email format');
    }

    if (!validatePassword(request.password)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
    }

    // Check if user already exists
    const existingUser = await this.userModel.findByEmail(request.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const existingUsername = await this.userModel.findByUsername(request.email);
    if (existingUsername) {
      throw new Error('Username already taken');
    }

    // Hash password
    const passwordHash = await CryptoUtils.hashPassword(request.password);

    // Create user
    const userData = {
      email: request.email,
      username: request.email, // Use email as username by default
      passwordHash,
      firstName: request.firstName,
      lastName: request.lastName,
      phoneNumber: request.phoneNumber,
      role: UserRole.STAFF, // Default role
      status: UserStatus.ACTIVE,
    };

    const user = await this.userModel.create(userData);
    
    logger.info('User registered successfully', { 
      userId: user.id, 
      email: user.email,
      registeredBy 
    });

    return user;
  }

  async login(request: LoginRequest, ipAddress: string, userAgent: string): Promise<LoginResponse> {
    // Find user by email
    const user = await this.userModel.findByEmail(request.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('Account is not active');
    }

    // Get password hash
    const userWithPassword = await this.getUserWithPassword(user.id);
    if (!userWithPassword) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await CryptoUtils.comparePassword(
      request.password, 
      userWithPassword.passwordHash
    );

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Check branch access if branchId is provided
    if (request.branchId && !user.branchIds.includes(request.branchId)) {
      if (![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(user.role)) {
        throw new Error('Access denied to this branch');
      }
    }

    // Generate tokens
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchIds: user.branchIds,
      permissions: user.permissions.map(p => `${p.resource}:${p.action}`),
    };

    const accessToken = CryptoUtils.generateAccessToken(tokenPayload);
    const refreshToken = CryptoUtils.generateRefreshToken(tokenPayload);
    const expiresAt = CryptoUtils.getTokenExpiry(refreshToken);

    if (!expiresAt) {
      throw new Error('Failed to generate tokens');
    }

    // Create session
    await this.sessionModel.create({
      userId: user.id,
      branchId: request.branchId,
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt,
    });

    // Update last login
    await this.userModel.updateLastLogin(user.id);

    logger.info('User logged in successfully', { 
      userId: user.id, 
      email: user.email,
      branchId: request.branchId,
      ipAddress 
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        branchIds: user.branchIds,
        permissions: user.permissions.map(p => `${p.resource}:${p.action}`),
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
      },
    };
  }

  async refreshToken(refreshToken: string, ipAddress: string): Promise<LoginResponse> {
    // Validate refresh token
    let tokenPayload;
    try {
      tokenPayload = CryptoUtils.verifyToken(refreshToken);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    // Find session
    const session = await this.sessionModel.findByRefreshToken(refreshToken);
    if (!session || !session.isActive) {
      throw new Error('Invalid or expired session');
    }

    // Get current user data
    const user = await this.userModel.findById(tokenPayload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new Error('User not found or inactive');
    }

    // Generate new tokens
    const newTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchIds: user.branchIds,
      permissions: user.permissions.map(p => `${p.resource}:${p.action}`),
    };

    const newAccessToken = CryptoUtils.generateAccessToken(newTokenPayload);
    const newRefreshToken = CryptoUtils.generateRefreshToken(newTokenPayload);

    // Invalidate old session and create new one
    await this.sessionModel.invalidateByRefreshToken(refreshToken);
    
    const expiresAt = CryptoUtils.getTokenExpiry(newRefreshToken);
    if (!expiresAt) {
      throw new Error('Failed to generate tokens');
    }

    await this.sessionModel.create({
      userId: user.id,
      branchId: session.branchId,
      refreshToken: newRefreshToken,
      ipAddress,
      userAgent: session.userAgent,
      expiresAt,
    });

    logger.info('Token refreshed successfully', { userId: user.id, ipAddress });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        branchIds: user.branchIds,
        permissions: user.permissions.map(p => `${p.resource}:${p.action}`),
      },
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessionModel.invalidateByRefreshToken(refreshToken);
    logger.info('User logged out successfully');
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionModel.invalidateAllUserSessions(userId);
    logger.info('All user sessions terminated', { userId });
  }

  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    const userWithPassword = await this.getUserWithPassword(userId);
    if (!userWithPassword) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await CryptoUtils.comparePassword(
      request.currentPassword,
      userWithPassword.passwordHash
    );

    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (!validatePassword(request.newPassword)) {
      throw new Error('New password must be at least 8 characters with uppercase, lowercase, number, and special character');
    }

    // Hash new password
    const newPasswordHash = await CryptoUtils.hashPassword(request.newPassword);

    // Update password
    await this.updateUserPassword(userId, newPasswordHash);

    // Invalidate all sessions to force re-login
    await this.sessionModel.invalidateAllUserSessions(userId);

    logger.info('Password changed successfully', { userId });
  }

  async assignBranches(userId: string, branchIds: string[], assignedBy: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userModel.assignBranches(userId, branchIds, assignedBy);
    
    // Invalidate all sessions to refresh permissions
    await this.sessionModel.invalidateAllUserSessions(userId);

    logger.info('User branches assigned successfully', { userId, branchIds, assignedBy });
  }

  private async getUserWithPassword(userId: string): Promise<{ passwordHash: string } | null> {
    const query = 'SELECT password_hash FROM auth.users WHERE id = $1';
    const db = new UserModel()['db']; // Access the db instance
    const result = await db.query(query, [userId]);
    
    return result.rows.length > 0 ? { passwordHash: result.rows[0].password_hash } : null;
  }

  private async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    const query = `
      UPDATE auth.users 
      SET password_hash = $1, updated_at = $2 
      WHERE id = $3
    `;
    
    const db = new UserModel()['db']; // Access the db instance
    await db.query(query, [passwordHash, new Date(), userId]);
  }
}