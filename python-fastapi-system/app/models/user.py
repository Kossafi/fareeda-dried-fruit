"""
User model and related tables
"""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column, String, Boolean, DateTime, Enum, Text, 
    ForeignKey, Integer, DECIMAL
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, AuditMixin


class UserRole(str, enum.Enum):
    """User roles enumeration"""
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"
    DRIVER = "driver"
    CUSTOMER = "customer"


class UserStatus(str, enum.Enum):
    """User status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class User(BaseModel, AuditMixin):
    """User model"""
    
    __tablename__ = "users"
    
    # Basic Information
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Personal Information
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Role and Status
    role = Column(Enum(UserRole), default=UserRole.STAFF, nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    
    # Employment Information
    employee_id = Column(String(20), unique=True, nullable=True)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    department = Column(String(100), nullable=True)
    position = Column(String(100), nullable=True)
    hire_date = Column(DateTime(timezone=True), nullable=True)
    salary = Column(DECIMAL(10, 2), nullable=True)
    
    # Security
    last_login = Column(DateTime(timezone=True), nullable=True)
    login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
    
    # Preferences and Settings
    preferences = Column(JSONB, nullable=True)
    timezone = Column(String(50), default="Asia/Bangkok", nullable=False)
    language = Column(String(10), default="th", nullable=False)
    
    # Emergency Contact
    emergency_contact = Column(JSONB, nullable=True)
    
    # Email Verification
    is_email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String(255), nullable=True)
    
    # Two-Factor Authentication
    is_2fa_enabled = Column(Boolean, default=False, nullable=False)
    totp_secret = Column(String(32), nullable=True)
    
    # Relationships
    branch = relationship("Branch", back_populates="users")
    sales = relationship("Sale", back_populates="staff_member")
    inventory_movements = relationship("InventoryMovement", back_populates="created_by_user")
    
    @property
    def full_name(self) -> str:
        """Get user's full name"""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def is_locked(self) -> bool:
        """Check if user account is locked"""
        if self.locked_until:
            return datetime.utcnow() < self.locked_until
        return False
    
    @property
    def is_admin(self) -> bool:
        """Check if user is admin"""
        return self.role == UserRole.ADMIN
    
    @property
    def is_manager(self) -> bool:
        """Check if user is manager"""
        return self.role == UserRole.MANAGER
    
    @property
    def can_manage_branch(self) -> bool:
        """Check if user can manage branch operations"""
        return self.role in [UserRole.ADMIN, UserRole.MANAGER]
    
    def increment_login_attempts(self):
        """Increment login attempts counter"""
        self.login_attempts += 1
    
    def reset_login_attempts(self):
        """Reset login attempts counter"""
        self.login_attempts = 0
        self.locked_until = None
    
    def lock_account(self, duration_minutes: int = 30):
        """Lock user account for specified duration"""
        self.locked_until = datetime.utcnow() + timedelta(minutes=duration_minutes)
    
    @classmethod
    def get_searchable_fields(cls) -> list:
        return ["username", "email", "first_name", "last_name", "employee_id"]
    
    @classmethod
    def get_filterable_fields(cls) -> list:
        return [
            "role", "status", "branch_id", "department", 
            "is_active", "is_email_verified", "created_at"
        ]


class UserSession(BaseModel):
    """User session tracking"""
    
    __tablename__ = "user_sessions"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False)
    refresh_token = Column(String(255), unique=True, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    last_activity = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Relationships
    user = relationship("User")
    
    @property
    def is_expired(self) -> bool:
        """Check if session is expired"""
        return datetime.utcnow() > self.expires_at
    
    @property
    def is_active_session(self) -> bool:
        """Check if session is active"""
        return not self.is_expired and self.is_active


class UserPermission(BaseModel):
    """User permissions"""
    
    __tablename__ = "user_permissions"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    permission = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    granted_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    granted_by_user = relationship("User", foreign_keys=[granted_by])
    
    @property
    def is_expired(self) -> bool:
        """Check if permission is expired"""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False


class UserActivityLog(BaseModel):
    """User activity logging"""
    
    __tablename__ = "user_activity_logs"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    details = Column(JSONB, nullable=True)
    
    # Relationships
    user = relationship("User")
    
    @classmethod
    def get_filterable_fields(cls) -> list:
        return ["user_id", "action", "resource", "created_at"]