import { AuthService } from '../services/AuthService';
import { UserModel } from '../models/User';
import { SessionModel } from '../models/Session';
import { CryptoUtils } from '../utils/crypto';
import { UserRole, UserStatus } from '@dried-fruits/types';
import DatabaseConnection from '../database/connection';

// Mock the database connection
jest.mock('../database/connection');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserModel: jest.Mocked<UserModel>;
  let mockSessionModel: jest.Mocked<SessionModel>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instance
    authService = new AuthService();
    
    // Mock the models
    mockUserModel = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updateLastLogin: jest.fn(),
      assignBranches: jest.fn(),
    } as any;

    mockSessionModel = {
      create: jest.fn(),
      findByRefreshToken: jest.fn(),
      invalidateByRefreshToken: jest.fn(),
      invalidateAllUserSessions: jest.fn(),
    } as any;

    // Replace the models in the service
    (authService as any).userModel = mockUserModel;
    (authService as any).sessionModel = mockSessionModel;
  });

  describe('register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '+1234567890',
    };

    it('should register a new user successfully', async () => {
      const expectedUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        branchIds: [],
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserModel.findByEmail.mockResolvedValue(null);
      mockUserModel.findByUsername.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue(expectedUser as any);

      const result = await authService.register(validRegisterData);

      expect(mockUserModel.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.STAFF,
          status: UserStatus.ACTIVE,
        })
      );
      expect(result).toEqual(expectedUser);
    });

    it('should throw error if email already exists', async () => {
      mockUserModel.findByEmail.mockResolvedValue({ id: 'existing-user' } as any);

      await expect(authService.register(validRegisterData))
        .rejects.toThrow('Email already registered');
    });

    it('should throw error for invalid email', async () => {
      const invalidData = { ...validRegisterData, email: 'invalid-email' };

      await expect(authService.register(invalidData))
        .rejects.toThrow('Invalid email format');
    });

    it('should throw error for weak password', async () => {
      const invalidData = { ...validRegisterData, password: 'weak' };

      await expect(authService.register(invalidData))
        .rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Test123!@#',
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      branchIds: ['branch-1'],
      permissions: [{ resource: 'inventory', action: 'read' }],
    };

    beforeEach(() => {
      // Mock getUserWithPassword
      jest.spyOn(authService as any, 'getUserWithPassword')
        .mockResolvedValue({ passwordHash: 'hashed-password' });
      
      // Mock CryptoUtils methods
      jest.spyOn(CryptoUtils, 'comparePassword').mockResolvedValue(true);
      jest.spyOn(CryptoUtils, 'generateAccessToken').mockReturnValue('access-token');
      jest.spyOn(CryptoUtils, 'generateRefreshToken').mockReturnValue('refresh-token');
      jest.spyOn(CryptoUtils, 'getTokenExpiry').mockReturnValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    });

    it('should login user successfully', async () => {
      mockUserModel.findByEmail.mockResolvedValue(mockUser as any);
      mockSessionModel.create.mockResolvedValue({} as any);
      mockUserModel.updateLastLogin.mockResolvedValue();

      const result = await authService.login(validLoginData, '127.0.0.1', 'test-agent');

      expect(result).toMatchObject({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.STAFF,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        },
      });

      expect(mockSessionModel.create).toHaveBeenCalled();
      expect(mockUserModel.updateLastLogin).toHaveBeenCalledWith('user-123');
    });

    it('should throw error for non-existent user', async () => {
      mockUserModel.findByEmail.mockResolvedValue(null);

      await expect(authService.login(validLoginData, '127.0.0.1', 'test-agent'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should throw error for inactive user', async () => {
      const inactiveUser = { ...mockUser, status: UserStatus.INACTIVE };
      mockUserModel.findByEmail.mockResolvedValue(inactiveUser as any);

      await expect(authService.login(validLoginData, '127.0.0.1', 'test-agent'))
        .rejects.toThrow('Account is not active');
    });

    it('should throw error for wrong password', async () => {
      mockUserModel.findByEmail.mockResolvedValue(mockUser as any);
      jest.spyOn(CryptoUtils, 'comparePassword').mockResolvedValue(false);

      await expect(authService.login(validLoginData, '127.0.0.1', 'test-agent'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should throw error for branch access denied', async () => {
      const loginWithBranch = { ...validLoginData, branchId: 'branch-2' };
      mockUserModel.findByEmail.mockResolvedValue(mockUser as any);

      await expect(authService.login(loginWithBranch, '127.0.0.1', 'test-agent'))
        .rejects.toThrow('Access denied to this branch');
    });
  });

  describe('refreshToken', () => {
    const mockTokenPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      role: UserRole.STAFF,
      branchIds: ['branch-1'],
      permissions: ['inventory:read'],
    };

    const mockSession = {
      id: 'session-123',
      userId: 'user-123',
      branchId: 'branch-1',
      refreshToken: 'old-refresh-token',
      userAgent: 'test-agent',
      isActive: true,
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      branchIds: ['branch-1'],
      permissions: [{ resource: 'inventory', action: 'read' }],
    };

    beforeEach(() => {
      jest.spyOn(CryptoUtils, 'verifyToken').mockReturnValue(mockTokenPayload as any);
      jest.spyOn(CryptoUtils, 'generateAccessToken').mockReturnValue('new-access-token');
      jest.spyOn(CryptoUtils, 'generateRefreshToken').mockReturnValue('new-refresh-token');
      jest.spyOn(CryptoUtils, 'getTokenExpiry').mockReturnValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    });

    it('should refresh token successfully', async () => {
      mockSessionModel.findByRefreshToken.mockResolvedValue(mockSession as any);
      mockUserModel.findById.mockResolvedValue(mockUser as any);
      mockSessionModel.invalidateByRefreshToken.mockResolvedValue();
      mockSessionModel.create.mockResolvedValue({} as any);

      const result = await authService.refreshToken('old-refresh-token', '127.0.0.1');

      expect(result).toMatchObject({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
        tokens: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      });

      expect(mockSessionModel.invalidateByRefreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(mockSessionModel.create).toHaveBeenCalled();
    });

    it('should throw error for invalid refresh token', async () => {
      jest.spyOn(CryptoUtils, 'verifyToken').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken('invalid-token', '127.0.0.1'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for inactive session', async () => {
      const inactiveSession = { ...mockSession, isActive: false };
      mockSessionModel.findByRefreshToken.mockResolvedValue(inactiveSession as any);

      await expect(authService.refreshToken('old-refresh-token', '127.0.0.1'))
        .rejects.toThrow('Invalid or expired session');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockSessionModel.invalidateByRefreshToken.mockResolvedValue();

      await authService.logout('refresh-token');

      expect(mockSessionModel.invalidateByRefreshToken).toHaveBeenCalledWith('refresh-token');
    });
  });

  describe('logoutAll', () => {
    it('should logout all sessions successfully', async () => {
      mockSessionModel.invalidateAllUserSessions.mockResolvedValue();

      await authService.logoutAll('user-123');

      expect(mockSessionModel.invalidateAllUserSessions).toHaveBeenCalledWith('user-123');
    });
  });
});