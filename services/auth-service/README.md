# Authentication Service

JWT-based authentication and authorization service for the dried fruits inventory management system.

## Features

- JWT-based authentication with access and refresh tokens
- Role-based access control (RBAC)
- Branch-level data isolation
- Session management with Redis caching
- Password hashing with bcrypt
- Comprehensive security measures
- Real-time session tracking and cleanup

## User Roles

- **Super Admin**: Full system access
- **Admin**: Administrative access across multiple branches
- **Branch Manager**: Management access to assigned branches
- **Warehouse Staff**: Inventory management access
- **Branch Staff**: Basic branch operations access
- **Driver**: Delivery and shipping access
- **Customer Service**: Customer management access

## API Endpoints

### Public Endpoints

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token

### Protected Endpoints

- `POST /auth/logout` - Logout (invalidate refresh token)
- `POST /auth/logout-all` - Logout from all devices
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile
- `POST /auth/change-password` - Change user password

### Admin Endpoints

- `POST /auth/assign-branches` - Assign branches to user
- `POST /auth/grant-permissions` - Grant permissions to user
- `POST /auth/revoke-permissions` - Revoke permissions from user

## Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/dried_fruits_db
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Security Configuration
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_MAX=10
MAX_CONCURRENT_SESSIONS=5
SESSION_INACTIVITY_TIMEOUT=1800

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3100
```

## Usage Examples

### User Registration

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+66812345678"
  }'
```

### User Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "branchId": "branch-uuid"
  }'
```

### Refresh Token

```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

### Get Profile (with Authorization)

```bash
curl -X GET http://localhost:3001/auth/profile \
  -H "Authorization: Bearer your-access-token"
```

## Security Features

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)

### Session Management

- Maximum 5 concurrent sessions per user
- Automatic session cleanup for expired/inactive sessions
- Session invalidation on password change
- Redis-based session caching for performance

### Rate Limiting

- 10 requests per 15-minute window for authentication endpoints
- IP-based rate limiting
- Stricter limits on sensitive operations

### Branch-Level Security

- Users can only access data from their assigned branches
- Super Admin and Admin roles have cross-branch access
- Branch assignment requires admin privileges
- Automatic access validation on protected routes

## Database Schema

### Users Table (`auth.users`)
- User account information
- Password hashes (bcrypt)
- Role and status management
- Profile information

### Sessions Table (`auth.sessions`)
- Active session tracking
- Refresh token storage
- Activity monitoring
- Device/IP tracking

### Permissions Table (`auth.permissions`)
- Granular permission definitions
- Resource-action based permissions
- Permission descriptions

### User Permissions (`auth.user_permissions`)
- User-specific permission assignments
- Permission granting audit trail

## Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Docker Support

```bash
# Build Docker image
docker build -t dried-fruits-auth-service .

# Run with Docker Compose
docker-compose up auth-service
```

## Default Super Admin

A default super admin user is created during database initialization:

- **Email**: admin@driedfruits.com
- **Password**: Admin123!@#
- **Role**: super_admin

**⚠️ Important**: Change the default password immediately after setup!

## Error Handling

The service provides comprehensive error handling with:

- Validation error messages
- Authentication failure details
- Rate limiting notifications
- Database error handling
- Request ID tracking for debugging

## Logging

Structured logging with Winston:

- Request/response logging
- Authentication events
- Error tracking
- Performance monitoring
- Security audit trail

## Performance Considerations

- Redis caching for session data
- Database connection pooling
- Efficient query optimization
- Token verification caching
- Session cleanup scheduling