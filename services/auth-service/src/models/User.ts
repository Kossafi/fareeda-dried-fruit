import { v4 as uuidv4 } from 'uuid';
import DatabaseConnection from '../database/connection';
import { User, UserRole, UserStatus, Permission } from '@dried-fruits/types';
import logger from '../utils/logger';

export class UserModel {
  private db = DatabaseConnection.getInstance();

  async create(userData: {
    email: string;
    username: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    role: UserRole;
    status?: UserStatus;
  }): Promise<User> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO auth.users (
        id, email, username, password_hash, first_name, last_name, 
        phone_number, role, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      userData.email.toLowerCase(),
      userData.username,
      userData.passwordHash,
      userData.firstName,
      userData.lastName,
      userData.phoneNumber || null,
      userData.role,
      userData.status || UserStatus.ACTIVE,
      now,
      now,
    ];

    try {
      const result = await this.db.query(query, values);
      const user = this.mapRowToUser(result.rows[0]);
      
      logger.info('User created successfully', { userId: user.id, email: user.email });
      return user;
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        }
        if (error.constraint === 'users_username_key') {
          throw new Error('Username already exists');
        }
      }
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT u.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'description', p.description,
                   'resource', p.resource,
                   'action', p.action
                 )
               ) FILTER (WHERE p.id IS NOT NULL), 
               '[]'
             ) as permissions,
             COALESCE(array_agg(bs.branch_id) FILTER (WHERE bs.branch_id IS NOT NULL), '{}') as branch_ids
      FROM auth.users u
      LEFT JOIN auth.user_permissions up ON u.id = up.user_id
      LEFT JOIN auth.permissions p ON up.permission_id = p.id
      LEFT JOIN public.branch_staff bs ON u.id = bs.user_id AND bs.is_active = true
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const result = await this.db.query(query, [id]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT u.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'description', p.description,
                   'resource', p.resource,
                   'action', p.action
                 )
               ) FILTER (WHERE p.id IS NOT NULL), 
               '[]'
             ) as permissions,
             COALESCE(array_agg(bs.branch_id) FILTER (WHERE bs.branch_id IS NOT NULL), '{}') as branch_ids
      FROM auth.users u
      LEFT JOIN auth.user_permissions up ON u.id = up.user_id
      LEFT JOIN auth.permissions p ON up.permission_id = p.id
      LEFT JOIN public.branch_staff bs ON u.id = bs.user_id AND bs.is_active = true
      WHERE u.email = $1
      GROUP BY u.id
    `;

    const result = await this.db.query(query, [email.toLowerCase()]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const query = `
      SELECT u.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'description', p.description,
                   'resource', p.resource,
                   'action', p.action
                 )
               ) FILTER (WHERE p.id IS NOT NULL), 
               '[]'
             ) as permissions,
             COALESCE(array_agg(bs.branch_id) FILTER (WHERE bs.branch_id IS NOT NULL), '{}') as branch_ids
      FROM auth.users u
      LEFT JOIN auth.user_permissions up ON u.id = up.user_id
      LEFT JOIN auth.permissions p ON up.permission_id = p.id
      LEFT JOIN public.branch_staff bs ON u.id = bs.user_id AND bs.is_active = true
      WHERE u.username = $1
      GROUP BY u.id
    `;

    const result = await this.db.query(query, [username]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const allowedFields = ['firstName', 'lastName', 'phoneNumber', 'profileImage', 'status'];
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        const dbField = this.camelToSnake(key);
        setClause.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return this.findById(id);
    }

    setClause.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE auth.users 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows.length > 0 ? this.findById(id) : null;
  }

  async updateLastLogin(id: string): Promise<void> {
    const query = `
      UPDATE auth.users 
      SET last_login_at = $1, updated_at = $1
      WHERE id = $2
    `;
    
    await this.db.query(query, [new Date(), id]);
  }

  async assignBranches(userId: string, branchIds: string[], assignedBy: string): Promise<void> {
    await this.db.transaction(async (client) => {
      // Remove existing assignments
      await client.query(
        'UPDATE public.branch_staff SET is_active = false, updated_at = $1 WHERE user_id = $2',
        [new Date(), userId]
      );

      // Add new assignments
      for (const branchId of branchIds) {
        await client.query(`
          INSERT INTO public.branch_staff (
            id, branch_id, user_id, position, start_date, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (branch_id, user_id, start_date) 
          DO UPDATE SET is_active = true, updated_at = $8
        `, [
          uuidv4(),
          branchId,
          userId,
          'Staff', // Default position
          new Date(),
          true,
          new Date(),
          new Date()
        ]);
      }
    });

    logger.info('User branch assignment updated', { userId, branchIds, assignedBy });
  }

  async grantPermissions(userId: string, permissionIds: string[], grantedBy: string): Promise<void> {
    await this.db.transaction(async (client) => {
      for (const permissionId of permissionIds) {
        await client.query(`
          INSERT INTO auth.user_permissions (id, user_id, permission_id, granted_by, granted_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id, permission_id) DO NOTHING
        `, [uuidv4(), userId, permissionId, grantedBy, new Date()]);
      }
    });

    logger.info('Permissions granted to user', { userId, permissionIds, grantedBy });
  }

  async revokePermissions(userId: string, permissionIds: string[]): Promise<void> {
    const query = `
      DELETE FROM auth.user_permissions 
      WHERE user_id = $1 AND permission_id = ANY($2)
    `;
    
    await this.db.query(query, [userId, permissionIds]);
    logger.info('Permissions revoked from user', { userId, permissionIds });
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      phoneNumber: row.phone_number,
      role: row.role,
      status: row.status,
      profileImage: row.profile_image,
      lastLoginAt: row.last_login_at,
      emailVerifiedAt: row.email_verified_at,
      phoneVerifiedAt: row.phone_verified_at,
      branchIds: row.branch_ids || [],
      permissions: row.permissions || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}