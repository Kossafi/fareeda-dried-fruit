"""
Common dependencies for API endpoints
"""
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_token
from app.crud.crud_user import user_crud
from app.models.user import User, UserRole

security = HTTPBearer()


# Authentication dependencies
async def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(security)
) -> User:
    """
    Get current authenticated user from JWT token
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = user_crud.get(db, id=user_id)
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (not disabled)
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


# Permission dependencies
async def check_admin_permission(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Check if user has admin permissions
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def check_manager_permission(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Check if user has manager or admin permissions
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def check_sales_permission(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Check if user has sales permissions
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def check_inventory_permission(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Check if user has inventory permissions
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def check_delivery_permission(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Check if user has delivery permissions
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.DELIVERY]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def check_reporting_permission(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Check if user has reporting permissions
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def check_user_management_permission(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Check if user has user management permissions
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


# Pagination dependencies
async def get_pagination_params(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return")
) -> Dict[str, int]:
    """
    Get pagination parameters
    """
    return {"skip": skip, "limit": limit}


# Date range dependencies
async def get_date_range_params(
    date_from: Optional[datetime] = Query(None, description="Start date"),
    date_to: Optional[datetime] = Query(None, description="End date")
) -> Dict[str, Optional[datetime]]:
    """
    Get date range parameters
    """
    # Default to last 30 days if no dates provided
    if not date_to:
        date_to = datetime.utcnow()
    if not date_from:
        date_from = date_to - timedelta(days=30)
    
    # Validate date range
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before end date"
        )
    
    # Limit to 1 year maximum
    if (date_to - date_from).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range cannot exceed 1 year"
        )
    
    return {"date_from": date_from, "date_to": date_to}


# Search dependencies
async def get_search_params(
    q: Optional[str] = Query(None, description="Search query"),
    sort_by: Optional[str] = Query(None, description="Sort field"),
    sort_order: str = Query("asc", regex="^(asc|desc)$", description="Sort order")
) -> Dict[str, Any]:
    """
    Get search and sort parameters
    """
    return {
        "query": q,
        "sort_by": sort_by,
        "sort_order": sort_order
    }


# Filter dependencies
async def get_filter_params(
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    branch_id: Optional[str] = Query(None, description="Filter by branch"),
    created_after: Optional[datetime] = Query(None, description="Created after date"),
    created_before: Optional[datetime] = Query(None, description="Created before date")
) -> Dict[str, Any]:
    """
    Get filter parameters
    """
    filters = {}
    
    if status:
        filters["status"] = status
    
    if category:
        filters["category"] = category
    
    if branch_id:
        try:
            filters["branch_id"] = UUID(branch_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid branch ID format"
            )
    
    if created_after:
        filters["created_after"] = created_after
    
    if created_before:
        filters["created_before"] = created_before
    
    return filters


# Branch access dependency
async def get_user_branches(
    current_user: User = Depends(get_current_active_user)
) -> Optional[list]:
    """
    Get list of branches user has access to
    """
    if current_user.role in [UserRole.ADMIN, UserRole.MANAGER]:
        # Admin and managers have access to all branches
        return None
    
    # Other users are limited to their assigned branches
    return current_user.branch_ids if hasattr(current_user, 'branch_ids') else []


# Rate limiting dependency (basic implementation)
class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = {}
    
    def is_allowed(self, key: str) -> bool:
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.window_seconds)
        
        # Clean old requests
        self.requests = {
            k: v for k, v in self.requests.items()
            if v > window_start
        }
        
        # Count requests in current window
        user_requests = [
            timestamp for timestamp in self.requests.values()
            if timestamp > window_start
        ]
        
        if len(user_requests) >= self.max_requests:
            return False
        
        # Add current request
        self.requests[f"{key}_{now.timestamp()}"] = now
        return True


# Global rate limiter instance
rate_limiter = RateLimiter()


async def check_rate_limit(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Check rate limit for current user
    """
    if not rate_limiter.is_allowed(str(current_user.id)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded"
        )
    return current_user