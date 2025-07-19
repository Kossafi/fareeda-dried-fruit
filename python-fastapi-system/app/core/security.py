"""
Security utilities for authentication and authorization
"""
from datetime import datetime, timedelta
from typing import Any, Union, Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from passlib.hash import bcrypt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(
    subject: Union[str, Any], 
    expires_delta: timedelta = None
) -> str:
    """
    Create JWT access token
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(
    subject: Union[str, Any],
    expires_delta: timedelta = None
) -> str:
    """
    Create JWT refresh token
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
    
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_token(token: str) -> Optional[str]:
    """
    Verify JWT token and return subject
    """
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        token_data = payload.get("sub")
        token_type = payload.get("type", "access")
        
        if token_data is None:
            return None
        
        # Check token type
        if token_type not in ["access", "refresh"]:
            return None
            
        return str(token_data)
    except JWTError:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against its hash
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Generate password hash
    """
    return pwd_context.hash(password)


def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password strength
    """
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters"
    
    # Check for at least one letter and one number
    has_letter = any(c.isalpha() for c in password)
    has_number = any(c.isdigit() for c in password)
    
    if not has_letter:
        return False, "Password must contain at least one letter"
    
    if not has_number:
        return False, "Password must contain at least one number"
    
    return True, "Password is valid"


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Authenticate user with email and password
    """
    from app.crud.crud_user import user_crud
    
    user = user_crud.get_by_email(db, email=email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


class PermissionChecker:
    """
    Permission checking utilities
    """
    
    @staticmethod
    def can_access_branch(user: User, branch_id: str) -> bool:
        """
        Check if user can access specific branch
        """
        # Admin and managers can access all branches
        if user.role in ["admin", "manager"]:
            return True
        
        # Staff can only access their assigned branch
        if user.role == "staff":
            return str(user.branch_id) == str(branch_id)
        
        # Drivers can access branches in their delivery routes
        if user.role == "driver":
            # TODO: Implement delivery route checking
            return True
        
        return False
    
    @staticmethod
    def can_modify_inventory(user: User) -> bool:
        """
        Check if user can modify inventory
        """
        return user.role in ["admin", "manager", "staff"]
    
    @staticmethod
    def can_process_sales(user: User) -> bool:
        """
        Check if user can process sales
        """
        return user.role in ["admin", "manager", "staff"]
    
    @staticmethod
    def can_manage_users(user: User) -> bool:
        """
        Check if user can manage other users
        """
        return user.role in ["admin"]
    
    @staticmethod
    def can_view_reports(user: User) -> bool:
        """
        Check if user can view reports
        """
        return user.role in ["admin", "manager"]
    
    @staticmethod
    def can_manage_suppliers(user: User) -> bool:
        """
        Check if user can manage suppliers
        """
        return user.role in ["admin", "manager"]
    
    @staticmethod
    def can_approve_procurement(user: User) -> bool:
        """
        Check if user can approve procurement orders
        """
        return user.role in ["admin", "manager"]
    
    @staticmethod
    def can_manage_sampling(user: User) -> bool:
        """
        Check if user can manage sampling
        """
        return user.role in ["admin", "manager", "staff"]


# Security exceptions
class SecurityException(Exception):
    """Base security exception"""
    pass


class AuthenticationError(SecurityException):
    """Authentication failed"""
    pass


class AuthorizationError(SecurityException):
    """Authorization failed"""
    pass


class TokenExpiredError(SecurityException):
    """Token has expired"""
    pass


class InvalidTokenError(SecurityException):
    """Invalid token"""
    pass