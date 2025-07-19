import { v4 as uuidv4 } from 'uuid';
import DatabaseConnection from '../database/connection';
import { SessionInfo } from '@dried-fruits/types';
import { config } from '../config';
import logger from '../utils/logger';

export class SessionModel {
  private db = DatabaseConnection.getInstance();
  private redis = this.db.getRedisClient();

  async create(sessionData: {
    userId: string;
    branchId?: string;
    refreshToken: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: Date;
  }): Promise<SessionInfo> {
    const sessionId = uuidv4();
    const now = new Date();

    // Check for concurrent session limit
    await this.enforceSessionLimit(sessionData.userId);

    const query = `
      INSERT INTO auth.sessions (
        id, user_id, branch_id, refresh_token, ip_address, user_agent,
        expires_at, created_at, last_activity_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      sessionId,
      sessionData.userId,
      sessionData.branchId || null,
      sessionData.refreshToken,
      sessionData.ipAddress,
      sessionData.userAgent,
      sessionData.expiresAt,
      now,
      now,
      true,
    ];

    const result = await this.db.query(query, values);
    const session = this.mapRowToSession(result.rows[0]);

    // Cache session in Redis for faster lookups
    await this.cacheSession(session);

    logger.info('Session created', { sessionId, userId: sessionData.userId });
    return session;
  }

  async findByRefreshToken(refreshToken: string): Promise<SessionInfo | null> {
    // Try Redis cache first
    const cached = await this.redis.get(`session:token:${refreshToken}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT * FROM auth.sessions 
      WHERE refresh_token = $1 AND is_active = true AND expires_at > NOW()
    `;

    const result = await this.db.query(query, [refreshToken]);
    if (result.rows.length === 0) {
      return null;
    }

    const session = this.mapRowToSession(result.rows[0]);
    await this.cacheSession(session);
    return session;
  }

  async findById(sessionId: string): Promise<SessionInfo | null> {
    // Try Redis cache first
    const cached = await this.redis.get(`session:${sessionId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT * FROM auth.sessions 
      WHERE id = $1 AND is_active = true
    `;

    const result = await this.db.query(query, [sessionId]);
    if (result.rows.length === 0) {
      return null;
    }

    const session = this.mapRowToSession(result.rows[0]);
    await this.cacheSession(session);
    return session;
  }

  async findActiveSessionsByUser(userId: string): Promise<SessionInfo[]> {
    const query = `
      SELECT * FROM auth.sessions 
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY last_activity_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapRowToSession(row));
  }

  async updateActivity(sessionId: string): Promise<void> {
    const now = new Date();
    
    const query = `
      UPDATE auth.sessions 
      SET last_activity_at = $1
      WHERE id = $2 AND is_active = true
    `;

    await this.db.query(query, [now, sessionId]);

    // Update cache
    const session = await this.findById(sessionId);
    if (session) {
      session.lastActivityAt = now;
      await this.cacheSession(session);
    }
  }

  async invalidate(sessionId: string): Promise<void> {
    const query = `
      UPDATE auth.sessions 
      SET is_active = false
      WHERE id = $1
    `;

    await this.db.query(query, [sessionId]);

    // Remove from cache
    await this.redis.del(`session:${sessionId}`);
    
    // Also remove token cache (we need to get the token first)
    const session = await this.db.query('SELECT refresh_token FROM auth.sessions WHERE id = $1', [sessionId]);
    if (session.rows.length > 0) {
      await this.redis.del(`session:token:${session.rows[0].refresh_token}`);
    }

    logger.info('Session invalidated', { sessionId });
  }

  async invalidateByRefreshToken(refreshToken: string): Promise<void> {
    const query = `
      UPDATE auth.sessions 
      SET is_active = false
      WHERE refresh_token = $1
    `;

    await this.db.query(query, [refreshToken]);

    // Remove from cache
    await this.redis.del(`session:token:${refreshToken}`);

    logger.info('Session invalidated by refresh token');
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    // Get all active sessions first to clean up cache
    const sessions = await this.findActiveSessionsByUser(userId);
    
    const query = `
      UPDATE auth.sessions 
      SET is_active = false
      WHERE user_id = $1 AND is_active = true
    `;

    await this.db.query(query, [userId]);

    // Remove from cache
    for (const session of sessions) {
      await this.redis.del(`session:${session.id}`);
      await this.redis.del(`session:token:${session.refreshToken}`);
    }

    logger.info('All user sessions invalidated', { userId });
  }

  async cleanupExpiredSessions(): Promise<number> {
    // Remove from database
    const query = `
      DELETE FROM auth.sessions 
      WHERE expires_at < NOW() OR 
            (last_activity_at < NOW() - INTERVAL '${config.session.inactivityTimeout} seconds')
    `;

    const result = await this.db.query(query);
    const deletedCount = result.rowCount || 0;

    logger.info(`Cleaned up ${deletedCount} expired sessions`);
    return deletedCount;
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const activeSessions = await this.findActiveSessionsByUser(userId);
    
    if (activeSessions.length >= config.session.maxConcurrent) {
      // Remove oldest sessions
      const sessionsToRemove = activeSessions.slice(config.session.maxConcurrent - 1);
      
      for (const session of sessionsToRemove) {
        await this.invalidate(session.id);
      }

      logger.info('Enforced session limit', { 
        userId, 
        removedSessions: sessionsToRemove.length 
      });
    }
  }

  private async cacheSession(session: SessionInfo): Promise<void> {
    const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    
    if (ttl > 0) {
      await this.redis.setEx(
        `session:${session.id}`,
        ttl,
        JSON.stringify(session)
      );
      
      await this.redis.setEx(
        `session:token:${session.refreshToken}`,
        ttl,
        JSON.stringify(session)
      );
    }
  }

  private mapRowToSession(row: any): SessionInfo {
    return {
      id: row.id,
      userId: row.user_id,
      branchId: row.branch_id,
      refreshToken: row.refresh_token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      expiresAt: row.expires_at,
      isActive: row.is_active,
    };
  }
}