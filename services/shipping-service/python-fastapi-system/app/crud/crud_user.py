"""
CRUD operations for User model
"""
from typing import Dict, List, Optional, Union
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.crud.base import CRUDBase
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    """CRUD operations for User model"""
    
    def get_by_email(self, db: Session, *, email: str) -> Optional[User]:
        """Get user by email"""
        return db.query(User).filter(User.email == email).first()
    
    def get_by_username(self, db: Session, *, username: str) -> Optional[User]:
        """Get user by username"""
        return db.query(User).filter(User.username == username).first()
    
    def get_by_employee_id(self, db: Session, *, employee_id: str) -> Optional[User]:
        """Get user by employee ID"""
        return db.query(User).filter(User.employee_id == employee_id).first()
    
    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        """Create new user with hashed password"""
        create_data = obj_in.dict()
        create_data.pop("password")
        
        db_obj = User(**create_data)
        db_obj.hashed_password = get_password_hash(obj_in.password)
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update(
        self,
        db: Session,
        *,
        db_obj: User,
        obj_in: Union[UserUpdate, Dict[str, any]]
    ) -> User:
        """Update user"""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        
        # Handle password update separately
        if "password" in update_data:
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]
            update_data["hashed_password"] = hashed_password
        
        return super().update(db, db_obj=db_obj, obj_in=update_data)
    
    def authenticate(self, db: Session, *, email: str, password: str) -> Optional[User]:
        """Authenticate user by email and password"""
        user = self.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
    
    def is_active(self, user: User) -> bool:
        """Check if user is active"""
        return user.is_active and user.status == UserStatus.ACTIVE
    
    def is_admin(self, user: User) -> bool:
        """Check if user is admin"""
        return user.role == UserRole.ADMIN
    
    def is_manager(self, user: User) -> bool:
        """Check if user is manager or admin"""
        return user.role in [UserRole.ADMIN, UserRole.MANAGER]
    
    def get_by_role(
        self,
        db: Session,
        *,
        role: UserRole,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """Get users by role"""
        return db.query(User).filter(
            User.role == role
        ).offset(skip).limit(limit).all()
    
    def get_by_branch(
        self,
        db: Session,
        *,
        branch_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """Get users by branch"""
        return db.query(User).filter(
            User.branch_id == branch_id
        ).offset(skip).limit(limit).all()
    
    def get_by_status(
        self,
        db: Session,
        *,
        status: UserStatus,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """Get users by status"""
        return db.query(User).filter(
            User.status == status
        ).offset(skip).limit(limit).all()
    
    def search_users(
        self,
        db: Session,
        *,
        search_query: str,
        role: Optional[UserRole] = None,
        branch_id: Optional[str] = None,
        status: Optional[UserStatus] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """Search users with filters"""
        query = db.query(User)
        
        # Apply search query
        if search_query:
            search_filter = or_(
                User.username.ilike(f"%{search_query}%"),
                User.email.ilike(f"%{search_query}%"),
                User.first_name.ilike(f"%{search_query}%"),
                User.last_name.ilike(f"%{search_query}%"),
                User.employee_id.ilike(f"%{search_query}%")
            )
            query = query.filter(search_filter)
        
        # Apply filters
        if role:
            query = query.filter(User.role == role)
        
        if branch_id:
            query = query.filter(User.branch_id == branch_id)
        
        if status:
            query = query.filter(User.status == status)
        
        return query.offset(skip).limit(limit).all()
    
    def get_active_users(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """Get active users only"""
        return db.query(User).filter(
            and_(
                User.is_active == True,
                User.status == UserStatus.ACTIVE
            )
        ).offset(skip).limit(limit).all()
    
    def get_locked_users(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """Get locked users"""
        return db.query(User).filter(
            User.is_locked == True
        ).offset(skip).limit(limit).all()
    
    def lock_user(self, db: Session, *, user_id: Union[UUID, str]) -> Optional[User]:
        """Lock user account"""
        user = self.get(db, id=user_id)
        if user:
            user.is_locked = True
            user.locked_at = user.get_current_time()
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    
    def unlock_user(self, db: Session, *, user_id: Union[UUID, str]) -> Optional[User]:
        """Unlock user account"""
        user = self.get(db, id=user_id)
        if user:
            user.is_locked = False
            user.locked_at = None
            user.failed_login_attempts = 0
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    
    def increment_failed_login(self, db: Session, *, user: User) -> User:
        """Increment failed login attempts"""
        user.failed_login_attempts += 1
        user.last_failed_login = user.get_current_time()
        
        # Auto-lock after max attempts
        if user.failed_login_attempts >= 5:  # configurable
            user.is_locked = True
            user.locked_at = user.get_current_time()
        
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def reset_failed_login(self, db: Session, *, user: User) -> User:
        """Reset failed login attempts"""
        user.failed_login_attempts = 0
        user.last_failed_login = None
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def update_last_login(self, db: Session, *, user: User) -> User:
        """Update last login timestamp"""
        user.last_login = user.get_current_time()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def change_password(
        self,
        db: Session,
        *,
        user: User,
        current_password: str,
        new_password: str
    ) -> bool:
        """Change user password"""
        # Verify current password
        if not verify_password(current_password, user.hashed_password):
            return False
        
        # Update password
        user.hashed_password = get_password_hash(new_password)
        user.password_changed_at = user.get_current_time()
        
        db.add(user)
        db.commit()
        return True
    
    def reset_password(
        self,
        db: Session,
        *,
        user: User,
        new_password: str
    ) -> User:
        """Reset user password (admin function)"""
        user.hashed_password = get_password_hash(new_password)
        user.password_changed_at = user.get_current_time()
        user.must_change_password = True
        
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def activate_user(self, db: Session, *, user_id: Union[UUID, str]) -> Optional[User]:
        """Activate user account"""
        user = self.get(db, id=user_id)
        if user:
            user.is_active = True
            user.status = UserStatus.ACTIVE
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    
    def deactivate_user(self, db: Session, *, user_id: Union[UUID, str]) -> Optional[User]:
        """Deactivate user account"""
        user = self.get(db, id=user_id)
        if user:
            user.is_active = False
            user.status = UserStatus.SUSPENDED
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    
    def verify_email(self, db: Session, *, user: User) -> User:
        """Verify user email"""
        user.is_email_verified = True
        user.email_verified_at = user.get_current_time()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def enable_2fa(self, db: Session, *, user: User, secret: str) -> User:
        """Enable 2FA for user"""
        user.is_2fa_enabled = True
        user.two_factor_secret = secret
        user.two_factor_backup_tokens = user.generate_backup_tokens()
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def disable_2fa(self, db: Session, *, user: User) -> User:
        """Disable 2FA for user"""
        user.is_2fa_enabled = False
        user.two_factor_secret = None
        user.two_factor_backup_tokens = None
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def get_user_statistics(self, db: Session) -> Dict:
        """Get user statistics"""
        total_users = db.query(User).count()
        active_users = db.query(User).filter(
            and_(User.is_active == True, User.status == UserStatus.ACTIVE)
        ).count()
        locked_users = db.query(User).filter(User.is_locked == True).count()
        
        # Users by role
        users_by_role = {}
        for role in UserRole:
            count = db.query(User).filter(User.role == role).count()
            users_by_role[role.value] = count
        
        # Users by status
        users_by_status = {}
        for status in UserStatus:
            count = db.query(User).filter(User.status == status).count()
            users_by_status[status.value] = count
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": total_users - active_users,
            "locked_users": locked_users,
            "users_by_role": users_by_role,
            "users_by_status": users_by_status
        }


# Create the user CRUD instance
user_crud = CRUDUser(User)