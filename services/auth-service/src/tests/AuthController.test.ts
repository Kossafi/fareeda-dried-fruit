import request from 'supertest';
import express from 'express';
import { AuthController } from '../controllers/AuthController';
import authRoutes from '../routes/auth';
import { UserRole, UserStatus } from '@dried-fruits/types';

// Mock the services
jest.mock('../services/AuthService');
jest.mock('../models/User');
jest.mock('../database/connection');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('AuthController Integration Tests', () => {
  describe('POST /auth/register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '+1234567890',
    };

    it('should register user with valid data', async () => {
      const { AuthService } = require('../services/AuthService');
      const mockRegister = jest.fn().mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
      });
      
      AuthService.prototype.register = mockRegister;

      const response = await request(app)
        .post('/auth/register')
        .send(validRegisterData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        message: 'User registered successfully',
      });
    });

    it('should return 400 for invalid email', async () => {
      const invalidData = { ...validRegisterData, email: 'invalid-email' };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for weak password', async () => {
      const invalidData = { ...validRegisterData, password: 'weak' };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = { email: 'test@example.com' };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Test123!@#',
    };

    it('should login with valid credentials', async () => {
      const { AuthService } = require('../services/AuthService');
      const mockLogin = jest.fn().mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.STAFF,
          branchIds: ['branch-1'],
          permissions: ['inventory:read'],
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        },
      });
      
      AuthService.prototype.login = mockLogin;

      const response = await request(app)
        .post('/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
          tokens: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        },
        message: 'Login successful',
      });
    });

    it('should return 401 for invalid credentials', async () => {
      const { AuthService } = require('../services/AuthService');
      const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid email or password'));
      
      AuthService.prototype.login = mockLogin;

      const response = await request(app)
        .post('/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 400 for validation errors', async () => {
      const invalidData = { email: 'invalid-email' };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /auth/refresh', () => {
    const validRefreshData = {
      refreshToken: 'valid-refresh-token',
    };

    it('should refresh token successfully', async () => {
      const { AuthService } = require('../services/AuthService');
      const mockRefreshToken = jest.fn().mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.STAFF,
          branchIds: ['branch-1'],
          permissions: ['inventory:read'],
        },
        tokens: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 900,
        },
      });
      
      AuthService.prototype.refreshToken = mockRefreshToken;

      const response = await request(app)
        .post('/auth/refresh')
        .send(validRefreshData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
        message: 'Token refreshed successfully',
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      const { AuthService } = require('../services/AuthService');
      const mockRefreshToken = jest.fn().mockRejectedValue(new Error('Invalid refresh token'));
      
      AuthService.prototype.refreshToken = mockRefreshToken;

      const response = await request(app)
        .post('/auth/refresh')
        .send(validRefreshData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid refresh token');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /auth/logout', () => {
    const validLogoutData = {
      refreshToken: 'valid-refresh-token',
    };

    it('should logout successfully', async () => {
      const { AuthService } = require('../services/AuthService');
      const mockLogout = jest.fn().mockResolvedValue(undefined);
      
      AuthService.prototype.logout = mockLogout;

      const response = await request(app)
        .post('/auth/logout')
        .send(validLogoutData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});