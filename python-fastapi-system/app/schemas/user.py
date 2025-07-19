"""
User schemas for API requests and responses
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, validator

from app.models.user import UserRole, UserStatus


# Base user schema
class UserBase(BaseModel):
    """Base user schema with common fields"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: UserRole = UserRole.STAFF
    status: UserStatus = UserStatus.ACTIVE
    branch_id: Optional[str] = None
    department: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    timezone: str = Field("Asia/Bangkok", max_length=50)
    language: str = Field("th", max_length=10)


# User creation schema
class UserCreate(UserBase):
    """Schema for creating new users"""
    password: str = Field(..., min_length=8, max_length=100)
    employee_id: Optional[str] = Field(None, max_length=20)
    hire_date: Optional[datetime] = None
    salary: Optional[float] = Field(None, gt=0)
    emergency_contact: Optional[dict] = None
    
    @validator('password')
    def validate_password(cls, v):
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isalpha() for c in v):
            raise ValueError('Password must contain at least one letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        return v


# User update schema
class UserUpdate(BaseModel):
    """Schema for updating users"""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    branch_id: Optional[str] = None
    department: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    salary: Optional[float] = Field(None, gt=0)
    emergency_contact: Optional[dict] = None
    preferences: Optional[dict] = None
    timezone: Optional[str] = Field(None, max_length=50)
    language: Optional[str] = Field(None, max_length=10)
    is_active: Optional[bool] = None


# User password update schema
class UserPasswordUpdate(BaseModel):
    """Schema for updating user password"""
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


# User response schema
class UserResponse(UserBase):
    """Schema for user responses"""
    id: str
    employee_id: Optional[str] = None
    hire_date: Optional[datetime] = None
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    is_active: bool = True
    is_email_verified: bool = False
    is_2fa_enabled: bool = False
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# User list response schema
class UserListResponse(BaseModel):
    """Schema for user list responses"""
    users: list[UserResponse]
    total: int
    page: int
    size: int
    pages: int


# User profile schema
class UserProfile(BaseModel):
    """Schema for user profile"""
    id: str
    username: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: UserRole
    status: UserStatus
    branch_id: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    employee_id: Optional[str] = None
    hire_date: Optional[datetime] = None
    last_login: Optional[datetime] = None
    preferences: Optional[dict] = None
    timezone: str
    language: str
    is_active: bool
    is_email_verified: bool
    is_2fa_enabled: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Login schema
class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str = Field(..., min_length=1)
    remember_me: bool = False


# Token schema
class Token(BaseModel):
    """Schema for authentication tokens"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfile


# Token refresh schema
class TokenRefresh(BaseModel):
    """Schema for token refresh"""
    refresh_token: str = Field(..., min_length=1)


# Password reset request schema
class PasswordResetRequest(BaseModel):
    """Schema for password reset request"""
    email: EmailStr


# Password reset schema
class PasswordReset(BaseModel):
    """Schema for password reset"""
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


# Email verification schema
class EmailVerification(BaseModel):
    """Schema for email verification"""
    token: str = Field(..., min_length=1)


# User activity log schema
class UserActivityLog(BaseModel):
    """Schema for user activity log"""
    id: str
    user_id: str
    action: str
    resource: Optional[str] = None
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# User session schema
class UserSession(BaseModel):
    """Schema for user session"""
    id: str
    user_id: str
    session_token: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    last_activity: datetime
    expires_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True


# User statistics schema
class UserStatistics(BaseModel):
    """Schema for user statistics"""
    total_users: int
    active_users: int
    inactive_users: int
    users_by_role: dict
    users_by_status: dict
    users_by_branch: dict
    recent_logins: int
    locked_accounts: int


# User preferences schema
class UserPreferences(BaseModel):
    """Schema for user preferences"""
    theme: str = "light"
    notifications: dict = {}
    dashboard_layout: dict = {}
    language: str = "th"
    timezone: str = "Asia/Bangkok"
    date_format: str = "DD/MM/YYYY"
    time_format: str = "24h"
    currency: str = "THB"