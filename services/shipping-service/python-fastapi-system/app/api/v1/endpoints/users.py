"""
User management endpoints for CRUD operations on users
"""
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.crud_user import user_crud
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse, UserListResponse,
    UserProfile, UserPasswordUpdate, UserStatistics
)
from app.models.user import User, UserRole, UserStatus
from app.api.dependencies import (
    get_current_user, get_current_active_user, get_current_admin_user,
    get_pagination_params, get_search_params
)

router = APIRouter()


@router.get("/", response_model=UserListResponse)
async def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    pagination: dict = Depends(get_pagination_params),
    search: dict = Depends(get_search_params),
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    status: Optional[UserStatus] = Query(None, description="Filter by status"),
    branch_id: Optional[str] = Query(None, description="Filter by branch"),
    is_active: Optional[bool] = Query(None, description="Filter by active status")
) -> UserListResponse:
    """
    Get all users with pagination and filters
    """
    # Build filters
    filters = {}
    if role:
        filters["role"] = role
    if status:
        filters["status"] = status
    if branch_id:
        filters["branch_id"] = branch_id
    if is_active is not None:
        filters["is_active"] = is_active
    
    # Search users
    if search["search_query"]:
        users = user_crud.search_users(
            db,
            search_query=search["search_query"],
            role=role,
            branch_id=branch_id,
            status=status,
            skip=pagination["skip"],
            limit=pagination["limit"]
        )
        # Get total count for search
        total = len(user_crud.search_users(
            db,
            search_query=search["search_query"],
            role=role,
            branch_id=branch_id,
            status=status,
            skip=0,
            limit=1000  # Large number to get all for count
        ))
    else:
        users = user_crud.get_multi(
            db,
            skip=pagination["skip"],
            limit=pagination["limit"],
            filters=filters
        )
        total = user_crud.count(db, filters=filters)
    
    # Convert to response format
    user_responses = [UserResponse.from_orm(user) for user in users]
    
    return UserListResponse(
        users=user_responses,
        total=total,
        page=pagination["page"],
        size=pagination["size"],
        pages=(total + pagination["size"] - 1) // pagination["size"]
    )


@router.get("/statistics", response_model=UserStatistics)
async def get_user_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
) -> UserStatistics:
    """
    Get user statistics
    """
    stats = user_crud.get_user_statistics(db)
    return UserStatistics(**stats)


@router.get("/active", response_model=List[UserResponse])
async def get_active_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params)
) -> List[UserResponse]:
    """
    Get active users only
    """
    users = user_crud.get_active_users(
        db,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [UserResponse.from_orm(user) for user in users]


@router.get("/locked", response_model=List[UserResponse])
async def get_locked_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    pagination: dict = Depends(get_pagination_params)
) -> List[UserResponse]:
    """
    Get locked users
    """
    users = user_crud.get_locked_users(
        db,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [UserResponse.from_orm(user) for user in users]


@router.get("/by-role/{role}", response_model=List[UserResponse])
async def get_users_by_role(
    role: UserRole,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params)
) -> List[UserResponse]:
    """
    Get users by role
    """
    users = user_crud.get_by_role(
        db,
        role=role,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [UserResponse.from_orm(user) for user in users]


@router.get("/by-branch/{branch_id}", response_model=List[UserResponse])
async def get_users_by_branch(
    branch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    pagination: dict = Depends(get_pagination_params)
) -> List[UserResponse]:
    """
    Get users by branch
    """
    users = user_crud.get_by_branch(
        db,
        branch_id=branch_id,
        skip=pagination["skip"],
        limit=pagination["limit"]
    )
    return [UserResponse.from_orm(user) for user in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """
    Get user by ID
    """
    user = user_crud.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check permissions - users can only see their own profile unless admin/manager
    if (str(user.id) != str(current_user.id) and 
        current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return UserResponse.from_orm(user)


@router.post("/", response_model=UserResponse)
async def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
) -> UserResponse:
    """
    Create new user
    """
    # Check if user with email already exists
    if user_crud.get_by_email(db, email=user_in.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Check if user with username already exists
    if user_crud.get_by_username(db, username=user_in.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this username already exists"
        )
    
    # Check if employee ID is provided and already exists
    if user_in.employee_id and user_crud.get_by_employee_id(db, employee_id=user_in.employee_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this employee ID already exists"
        )
    
    # Create user
    user = user_crud.create(db, obj_in=user_in)
    
    # Log user creation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="user_created",
        resource="user",
        resource_id=str(user.id),
        details={
            "created_user_email": user.email,
            "created_user_role": user.role.value
        }
    )
    
    return UserResponse.from_orm(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """
    Update user
    """
    # Get user
    user = user_crud.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check permissions
    is_self_update = str(user.id) == str(current_user.id)
    is_admin = current_user.role == UserRole.ADMIN
    is_manager = current_user.role == UserRole.MANAGER
    
    if not (is_self_update or is_admin or is_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Restrict role changes for non-admins
    if user_in.role and not is_admin:
        if is_self_update:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot change your own role"
            )
        if is_manager and user_in.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers cannot promote users to admin"
            )
    
    # Check for duplicate email
    if user_in.email and user_in.email != user.email:
        if user_crud.get_by_email(db, email=user_in.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
    
    # Check for duplicate username
    if user_in.username and user_in.username != user.username:
        if user_crud.get_by_username(db, username=user_in.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this username already exists"
            )
    
    # Update user
    user = user_crud.update(db, db_obj=user, obj_in=user_in)
    
    # Log user update
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="user_updated",
        resource="user",
        resource_id=str(user.id),
        details={
            "updated_user_email": user.email,
            "is_self_update": is_self_update
        }
    )
    
    return UserResponse.from_orm(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Delete user
    """
    # Get user
    user = user_crud.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent self-deletion
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Soft delete user
    user_crud.soft_delete(db, id=user_id)
    
    # Log user deletion
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="user_deleted",
        resource="user",
        resource_id=str(user.id),
        details={
            "deleted_user_email": user.email,
            "deleted_user_role": user.role.value
        }
    )
    
    return {"message": "User deleted successfully"}


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Activate user account
    """
    user = user_crud.activate_user(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Log user activation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="user_activated",
        resource="user",
        resource_id=str(user.id),
        details={"activated_user_email": user.email}
    )
    
    return {"message": "User activated successfully"}


@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Deactivate user account
    """
    user = user_crud.deactivate_user(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent self-deactivation
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    # Log user deactivation
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="user_deactivated",
        resource="user",
        resource_id=str(user.id),
        details={"deactivated_user_email": user.email}
    )
    
    return {"message": "User deactivated successfully"}


@router.post("/{user_id}/lock")
async def lock_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Lock user account
    """
    user = user_crud.lock_user(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent self-locking
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot lock your own account"
        )
    
    # Log user locking
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="user_locked",
        resource="user",
        resource_id=str(user.id),
        details={"locked_user_email": user.email}
    )
    
    return {"message": "User locked successfully"}


@router.post("/{user_id}/unlock")
async def unlock_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Unlock user account
    """
    user = user_crud.unlock_user(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Log user unlocking
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="user_unlocked",
        resource="user",
        resource_id=str(user.id),
        details={"unlocked_user_email": user.email}
    )
    
    return {"message": "User unlocked successfully"}


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
) -> Dict[str, Any]:
    """
    Reset user password (admin function)
    """
    user = user_crud.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Generate temporary password
    import secrets
    import string
    temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
    
    # Reset password
    user_crud.reset_password(db, user=user, new_password=temp_password)
    
    # Log password reset
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="password_reset_admin",
        resource="user",
        resource_id=str(user.id),
        details={"reset_user_email": user.email}
    )
    
    # TODO: Send email with temporary password
    # For now, return it in the response (not recommended for production)
    return {
        "message": "Password reset successfully",
        "temporary_password": temp_password,
        "note": "User must change password on next login"
    }


# Helper function
async def log_user_activity(
    db: Session,
    user_id: str,
    action: str,
    resource: str = None,
    resource_id: str = None,
    details: dict = None
):
    """Log user activity"""
    # TODO: Implement user activity logging
    # This would store user activities in the database
    pass