"""
Authentication schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, validator

from app.schemas.user import UserProfile


# Login request schema
class LoginRequest(BaseModel):
    """Schema for login request"""
    email: EmailStr
    password: str = Field(..., min_length=1)
    remember_me: bool = False
    
    class Config:
        schema_extra = {
            "example": {
                "email": "admin@fareedadriedfruits.com",
                "password": "admin123",
                "remember_me": False
            }
        }


# Login response schema
class LoginResponse(BaseModel):
    """Schema for login response"""
    success: bool = True
    message: str = "Login successful"
    data: dict
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "Login successful",
                "data": {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer",
                    "expires_in": 1800,
                    "user": {
                        "id": "uuid",
                        "username": "admin",
                        "email": "admin@fareedadriedfruits.com",
                        "full_name": "System Administrator",
                        "role": "admin"
                    }
                }
            }
        }


# Token data schema
class TokenData(BaseModel):
    """Schema for token data"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfile


# Token refresh request schema
class TokenRefreshRequest(BaseModel):
    """Schema for token refresh request"""
    refresh_token: str = Field(..., min_length=1)
    
    class Config:
        schema_extra = {
            "example": {
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }


# Token refresh response schema
class TokenRefreshResponse(BaseModel):
    """Schema for token refresh response"""
    success: bool = True
    message: str = "Token refreshed successfully"
    data: dict
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "Token refreshed successfully",
                "data": {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer",
                    "expires_in": 1800
                }
            }
        }


# Logout request schema
class LogoutRequest(BaseModel):
    """Schema for logout request"""
    refresh_token: Optional[str] = None
    logout_all_devices: bool = False


# Logout response schema
class LogoutResponse(BaseModel):
    """Schema for logout response"""
    success: bool = True
    message: str = "Logout successful"


# Password reset request schema
class PasswordResetRequest(BaseModel):
    """Schema for password reset request"""
    email: EmailStr
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@fareedadriedfruits.com"
            }
        }


# Password reset response schema
class PasswordResetResponse(BaseModel):
    """Schema for password reset response"""
    success: bool = True
    message: str = "Password reset email sent"


# Password reset confirm schema
class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation"""
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)
    
    @validator('new_password')
    def validate_new_password(cls, v):
        """Validate new password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isalpha() for c in v):
            raise ValueError('Password must contain at least one letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        return v
    
    @validator('confirm_password')
    def validate_password_match(cls, v, values):
        """Validate that passwords match"""
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "token": "reset_token_here",
                "new_password": "newpassword123",
                "confirm_password": "newpassword123"
            }
        }


# Change password schema
class ChangePasswordRequest(BaseModel):
    """Schema for change password request"""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)
    
    @validator('new_password')
    def validate_new_password(cls, v):
        """Validate new password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isalpha() for c in v):
            raise ValueError('Password must contain at least one letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        return v
    
    @validator('confirm_password')
    def validate_password_match(cls, v, values):
        """Validate that passwords match"""
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "current_password": "oldpassword123",
                "new_password": "newpassword123",
                "confirm_password": "newpassword123"
            }
        }


# Email verification request schema
class EmailVerificationRequest(BaseModel):
    """Schema for email verification request"""
    email: EmailStr
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@fareedadriedfruits.com"
            }
        }


# Email verification confirm schema
class EmailVerificationConfirm(BaseModel):
    """Schema for email verification confirmation"""
    token: str = Field(..., min_length=1)
    
    class Config:
        schema_extra = {
            "example": {
                "token": "verification_token_here"
            }
        }


# Two-factor authentication setup schema
class TwoFactorSetupRequest(BaseModel):
    """Schema for 2FA setup request"""
    password: str = Field(..., min_length=1)


# Two-factor authentication setup response schema
class TwoFactorSetupResponse(BaseModel):
    """Schema for 2FA setup response"""
    success: bool = True
    message: str = "2FA setup initiated"
    data: dict
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "2FA setup initiated",
                "data": {
                    "qr_code_url": "data:image/png;base64,iVBORw0KGgoAAAANS...",
                    "secret": "JBSWY3DPEHPK3PXP",
                    "backup_codes": ["123456", "789012", "345678"]
                }
            }
        }


# Two-factor authentication verify schema
class TwoFactorVerifyRequest(BaseModel):
    """Schema for 2FA verification request"""
    token: str = Field(..., min_length=6, max_length=6)
    
    class Config:
        schema_extra = {
            "example": {
                "token": "123456"
            }
        }


# Two-factor authentication login schema
class TwoFactorLoginRequest(BaseModel):
    """Schema for 2FA login request"""
    email: EmailStr
    password: str = Field(..., min_length=1)
    totp_token: str = Field(..., min_length=6, max_length=6)
    remember_me: bool = False
    
    class Config:
        schema_extra = {
            "example": {
                "email": "admin@fareedadriedfruits.com",
                "password": "admin123",
                "totp_token": "123456",
                "remember_me": False
            }
        }


# Session information schema
class SessionInfo(BaseModel):
    """Schema for session information"""
    session_id: str
    user_id: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    last_activity: datetime
    expires_at: datetime
    is_current: bool = False
    
    class Config:
        from_attributes = True


# User sessions list schema
class UserSessionsList(BaseModel):
    """Schema for user sessions list"""
    sessions: list[SessionInfo]
    total: int
    current_session_id: str


# Revoke session schema
class RevokeSessionRequest(BaseModel):
    """Schema for revoke session request"""
    session_id: str = Field(..., min_length=1)


# Account verification status schema
class AccountVerificationStatus(BaseModel):
    """Schema for account verification status"""
    is_email_verified: bool
    is_phone_verified: bool
    is_2fa_enabled: bool
    verification_level: str  # basic, verified, premium
    required_actions: list[str]


# Login attempt schema
class LoginAttempt(BaseModel):
    """Schema for login attempt"""
    email: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    success: bool
    failure_reason: Optional[str] = None
    attempted_at: datetime
    
    class Config:
        from_attributes = True


# Security settings schema
class SecuritySettings(BaseModel):
    """Schema for security settings"""
    password_expires_days: int = 90
    max_login_attempts: int = 5
    lockout_duration_minutes: int = 30
    require_2fa: bool = False
    session_timeout_minutes: int = 30
    password_history_count: int = 5
    password_min_length: int = 8
    password_require_uppercase: bool = True
    password_require_lowercase: bool = True
    password_require_numbers: bool = True
    password_require_symbols: bool = False