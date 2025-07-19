"""
FastAPI dependencies for authentication and authorization
"""
from typing import Optional, Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError

from app.core.database import get_db
from app.core.security import verify_token, AuthenticationError
from app.models.user import User, UserRole
from app.crud.crud_user import user_crud

# Security scheme
security = HTTPBearer()


def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """
    Get current authenticated user
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Extract token from credentials
        token = credentials.credentials
        
        # Verify token and get user ID
        user_id = verify_token(token)
        if user_id is None:
            raise credentials_exception
        
        # Get user from database
        user = user_crud.get(db, id=user_id)
        if user is None:
            raise credentials_exception
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User is inactive"
            )
        
        # Check if user is locked
        if user.is_locked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is locked"
            )
        
        return user
        
    except JWTError:
        raise credentials_exception


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (additional check)
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current admin user
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def get_current_manager_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current manager or admin user
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def get_current_staff_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current staff, manager, or admin user
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def check_branch_access(branch_id: str):
    """
    Factory function to create branch access checker
    """
    def _check_branch_access(
        current_user: User = Depends(get_current_user)
    ) -> User:
        # Admin and managers can access all branches
        if current_user.role in [UserRole.ADMIN, UserRole.MANAGER]:
            return current_user
        
        # Staff can only access their assigned branch
        if current_user.role == UserRole.STAFF:
            if str(current_user.branch_id) != branch_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied for this branch"
                )
        
        return current_user
    
    return _check_branch_access


def check_product_management_permission(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if user can manage products
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage products"
        )
    return current_user


def check_inventory_management_permission(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if user can manage inventory
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage inventory"
        )
    return current_user


def check_sales_permission(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if user can process sales
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to process sales"
        )
    return current_user


def check_reporting_permission(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if user can view reports
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view reports"
        )
    return current_user


def check_supplier_management_permission(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if user can manage suppliers
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage suppliers"
        )
    return current_user


def check_user_management_permission(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if user can manage other users
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage users"
        )
    return current_user


def check_procurement_permission(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if user can manage procurement
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage procurement"
        )
    return current_user


def check_delivery_permission(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check if user can manage deliveries
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage deliveries"
        )
    return current_user


# Optional authentication (for public endpoints that benefit from user context)
def get_current_user_optional(
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    """
    Get current user if authenticated, otherwise None
    """
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        user_id = verify_token(token)
        if user_id is None:
            return None
        
        user = user_crud.get(db, id=user_id)
        if user is None or not user.is_active:
            return None
        
        return user
        
    except (JWTError, AuthenticationError):
        return None


# Rate limiting dependency
def rate_limit_dependency():
    """
    Rate limiting dependency (placeholder)
    """
    # This would implement rate limiting logic
    # For now, just return True
    return True


# Database transaction dependency
def get_db_transaction() -> Generator:
    """
    Get database session with transaction support
    """
    db = next(get_db())
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# Pagination dependency
def get_pagination_params(
    page: int = 1,
    size: int = 20,
    max_size: int = 100
) -> dict:
    """
    Get pagination parameters
    """
    if page < 1:
        page = 1
    if size < 1:
        size = 20
    if size > max_size:
        size = max_size
    
    skip = (page - 1) * size
    
    return {
        "page": page,
        "size": size,
        "skip": skip,
        "limit": size
    }


# Search and filtering dependency
def get_search_params(
    q: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: str = "asc"
) -> dict:
    """
    Get search and sorting parameters
    """
    return {
        "search_query": q,
        "sort_by": sort_by,
        "sort_order": sort_order.lower() if sort_order else "asc"
    }


# Date range dependency
def get_date_range_params(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
) -> dict:
    """
    Get date range parameters
    """
    from datetime import datetime, date
    
    params = {}
    
    if date_from:
        try:
            params["date_from"] = datetime.strptime(date_from, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date_from format. Use YYYY-MM-DD"
            )
    
    if date_to:
        try:
            params["date_to"] = datetime.strptime(date_to, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date_to format. Use YYYY-MM-DD"
            )
    
    # Validate date range
    if params.get("date_from") and params.get("date_to"):
        if params["date_from"] > params["date_to"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date_from cannot be after date_to"
            )
    
    return params