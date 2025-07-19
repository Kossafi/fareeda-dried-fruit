"""
Authentication endpoints for login, logout, token refresh, password reset
"""
from datetime import timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from jose import JWTError

from app.core.database import get_db
from app.core.security import (
    create_access_token, 
    create_refresh_token, 
    verify_token, 
    verify_refresh_token,
    generate_password_reset_token,
    verify_password_reset_token,
    get_password_hash
)
from app.core.config import settings
from app.crud.crud_user import user_crud
from app.schemas.auth import (
    LoginRequest, LoginResponse, 
    TokenRefreshRequest, TokenRefreshResponse,
    LogoutRequest, LogoutResponse,
    PasswordResetRequest, PasswordResetResponse,
    PasswordResetConfirm, ChangePasswordRequest,
    EmailVerificationRequest, EmailVerificationConfirm,
    TwoFactorSetupRequest, TwoFactorSetupResponse,
    TwoFactorVerifyRequest, TwoFactorLoginRequest,
    SessionInfo, UserSessionsList, RevokeSessionRequest,
    AccountVerificationStatus, LoginAttempt
)
from app.schemas.user import UserProfile
from app.api.dependencies import get_current_user, get_current_active_user
from app.models.user import User

router = APIRouter()
security = HTTPBearer()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    user_credentials: LoginRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    User login endpoint
    """
    # Get user by email
    user = user_crud.get_by_email(db, email=user_credentials.email)
    
    if not user:
        # Log failed login attempt
        await log_login_attempt(
            db, 
            email=user_credentials.email,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent"),
            success=False,
            failure_reason="User not found"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Check if user is locked
    if user.is_locked:
        await log_login_attempt(
            db,
            email=user_credentials.email,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent"),
            success=False,
            failure_reason="Account locked"
        )
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is locked. Please contact administrator."
        )
    
    # Authenticate user
    authenticated_user = user_crud.authenticate(
        db, 
        email=user_credentials.email, 
        password=user_credentials.password
    )
    
    if not authenticated_user:
        # Increment failed login attempts
        user_crud.increment_failed_login(db, user=user)
        
        await log_login_attempt(
            db,
            email=user_credentials.email,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent"),
            success=False,
            failure_reason="Invalid password"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Check if user is active
    if not user_crud.is_active(authenticated_user):
        await log_login_attempt(
            db,
            email=user_credentials.email,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent"),
            success=False,
            failure_reason="Account inactive"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive"
        )
    
    # Check if 2FA is enabled
    if authenticated_user.is_2fa_enabled:
        # Return temporary token for 2FA verification
        temp_token = create_access_token(
            subject=str(authenticated_user.id),
            expires_delta=timedelta(minutes=5),
            token_type="2fa_temp"
        )
        
        return {
            "success": True,
            "message": "2FA verification required",
            "data": {
                "requires_2fa": True,
                "temp_token": temp_token,
                "user_id": str(authenticated_user.id)
            }
        }
    
    # Reset failed login attempts
    user_crud.reset_failed_login(db, user=authenticated_user)
    
    # Update last login
    user_crud.update_last_login(db, user=authenticated_user)
    
    # Create tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    if user_credentials.remember_me:
        refresh_token_expires = timedelta(days=30)  # Extended for remember me
    
    access_token = create_access_token(
        subject=str(authenticated_user.id),
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(
        subject=str(authenticated_user.id),
        expires_delta=refresh_token_expires
    )
    
    # Create user session
    await create_user_session(
        db,
        user=authenticated_user,
        access_token=access_token,
        refresh_token=refresh_token,
        ip_address=request.client.host,
        user_agent=request.headers.get("User-Agent")
    )
    
    # Log successful login
    await log_login_attempt(
        db,
        email=user_credentials.email,
        ip_address=request.client.host,
        user_agent=request.headers.get("User-Agent"),
        success=True
    )
    
    # Create user profile
    user_profile = UserProfile(
        id=str(authenticated_user.id),
        username=authenticated_user.username,
        email=authenticated_user.email,
        first_name=authenticated_user.first_name,
        last_name=authenticated_user.last_name,
        full_name=authenticated_user.full_name,
        phone=authenticated_user.phone,
        avatar_url=authenticated_user.avatar_url,
        role=authenticated_user.role,
        status=authenticated_user.status,
        branch_id=str(authenticated_user.branch_id) if authenticated_user.branch_id else None,
        department=authenticated_user.department,
        position=authenticated_user.position,
        employee_id=authenticated_user.employee_id,
        hire_date=authenticated_user.hire_date,
        last_login=authenticated_user.last_login,
        preferences=authenticated_user.preferences,
        timezone=authenticated_user.timezone,
        language=authenticated_user.language,
        is_active=authenticated_user.is_active,
        is_email_verified=authenticated_user.is_email_verified,
        is_2fa_enabled=authenticated_user.is_2fa_enabled,
        created_at=authenticated_user.created_at,
        updated_at=authenticated_user.updated_at
    )
    
    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": int(access_token_expires.total_seconds()),
            "user": user_profile
        }
    }


@router.post("/2fa/login", response_model=LoginResponse)
async def two_factor_login(
    request: Request,
    user_credentials: TwoFactorLoginRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Two-factor authentication login endpoint
    """
    # Get user by email
    user = user_crud.get_by_email(db, email=user_credentials.email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Authenticate user
    authenticated_user = user_crud.authenticate(
        db, 
        email=user_credentials.email, 
        password=user_credentials.password
    )
    
    if not authenticated_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify 2FA token
    if not authenticated_user.verify_totp_token(user_credentials.totp_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA token"
        )
    
    # Create tokens and proceed with normal login flow
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    if user_credentials.remember_me:
        refresh_token_expires = timedelta(days=30)
    
    access_token = create_access_token(
        subject=str(authenticated_user.id),
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(
        subject=str(authenticated_user.id),
        expires_delta=refresh_token_expires
    )
    
    # Update last login
    user_crud.update_last_login(db, user=authenticated_user)
    
    # Create user profile
    user_profile = UserProfile.from_orm(authenticated_user)
    
    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": int(access_token_expires.total_seconds()),
            "user": user_profile
        }
    }


@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(
    token_request: TokenRefreshRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Refresh access token using refresh token
    """
    try:
        # Verify refresh token
        user_id = verify_refresh_token(token_request.refresh_token)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Get user
        user = user_crud.get(db, id=user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        # Check if user is active
        if not user_crud.is_active(user):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User is inactive"
            )
        
        # Create new tokens
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        access_token = create_access_token(
            subject=str(user.id),
            expires_delta=access_token_expires
        )
        
        new_refresh_token = create_refresh_token(
            subject=str(user.id),
            expires_delta=refresh_token_expires
        )
        
        return {
            "success": True,
            "message": "Token refreshed successfully",
            "data": {
                "access_token": access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": int(access_token_expires.total_seconds())
            }
        }
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    logout_request: LogoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    User logout endpoint
    """
    # TODO: Implement token blacklisting
    # For now, just return success
    # In production, you would:
    # 1. Add token to blacklist
    # 2. Remove user session
    # 3. If logout_all_devices is True, invalidate all user sessions
    
    return {
        "success": True,
        "message": "Logout successful"
    }


@router.post("/password/reset", response_model=PasswordResetResponse)
async def request_password_reset(
    reset_request: PasswordResetRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Request password reset
    """
    user = user_crud.get_by_email(db, email=reset_request.email)
    
    if user:
        # Generate password reset token
        reset_token = generate_password_reset_token(email=user.email)
        
        # TODO: Send email with reset token
        # For now, just return success
        # In production, you would send an email with the reset link
        
        # Log the reset request
        await log_user_activity(
            db,
            user_id=str(user.id),
            action="password_reset_requested",
            details={"email": user.email}
        )
    
    # Always return success to prevent email enumeration
    return {
        "success": True,
        "message": "Password reset email sent"
    }


@router.post("/password/reset/confirm")
async def confirm_password_reset(
    reset_confirm: PasswordResetConfirm,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Confirm password reset with token
    """
    # Verify reset token
    email = verify_password_reset_token(reset_confirm.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Get user
    user = user_crud.get_by_email(db, email=email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Reset password
    user_crud.reset_password(db, user=user, new_password=reset_confirm.new_password)
    
    # Log password reset
    await log_user_activity(
        db,
        user_id=str(user.id),
        action="password_reset_completed",
        details={"email": user.email}
    )
    
    return {
        "success": True,
        "message": "Password reset successful"
    }


@router.post("/password/change")
async def change_password(
    password_change: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Change user password
    """
    # Change password
    success = user_crud.change_password(
        db,
        user=current_user,
        current_password=password_change.current_password,
        new_password=password_change.new_password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Log password change
    await log_user_activity(
        db,
        user_id=str(current_user.id),
        action="password_changed",
        details={"user_id": str(current_user.id)}
    )
    
    return {
        "success": True,
        "message": "Password changed successfully"
    }


@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user)
) -> UserProfile:
    """
    Get current user profile
    """
    return UserProfile.from_orm(current_user)


@router.get("/verification/status", response_model=AccountVerificationStatus)
async def get_verification_status(
    current_user: User = Depends(get_current_active_user)
) -> AccountVerificationStatus:
    """
    Get account verification status
    """
    required_actions = []
    
    if not current_user.is_email_verified:
        required_actions.append("verify_email")
    
    if not current_user.is_2fa_enabled and current_user.role in ["admin", "manager"]:
        required_actions.append("enable_2fa")
    
    verification_level = "basic"
    if current_user.is_email_verified:
        verification_level = "verified"
    if current_user.is_email_verified and current_user.is_2fa_enabled:
        verification_level = "premium"
    
    return AccountVerificationStatus(
        is_email_verified=current_user.is_email_verified,
        is_phone_verified=False,  # TODO: Implement phone verification
        is_2fa_enabled=current_user.is_2fa_enabled,
        verification_level=verification_level,
        required_actions=required_actions
    )


# Helper functions
async def log_login_attempt(
    db: Session,
    email: str,
    ip_address: str = None,
    user_agent: str = None,
    success: bool = False,
    failure_reason: str = None
):
    """Log login attempt"""
    # TODO: Implement login attempt logging
    # This would store login attempts in the database
    pass


async def create_user_session(
    db: Session,
    user: User,
    access_token: str,
    refresh_token: str,
    ip_address: str = None,
    user_agent: str = None
):
    """Create user session"""
    # TODO: Implement user session creation
    # This would store active sessions in the database
    pass


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