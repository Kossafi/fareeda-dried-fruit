"""
Application configuration management
"""
import secrets
from typing import Any, Dict, List, Optional, Union

from pydantic import AnyHttpUrl, BaseSettings, EmailStr, Field, validator


class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Dried Fruits Inventory System"
    PROJECT_VERSION: str = "1.0.0"
    DESCRIPTION: str = "ระบบจัดการสต๊อคผลไม้อบแห้งแบบครบวงจร"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    TESTING: bool = False
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_MIN_LENGTH: int = 8
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_DURATION: int = 300  # 5 minutes
    
    # Database
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    DATABASE_TEST_URL: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_TEST_URL: str = "redis://localhost:6379/1"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = [
        "http://localhost:3000",
        "http://localhost:8080", 
        "http://localhost:5173"
    ]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 10485760  # 10MB
    ALLOWED_EXTENSIONS: List[str] = ["jpg", "jpeg", "png", "pdf", "xlsx", "csv"]
    
    # Barcode & QR Code
    BARCODE_DIR: str = "static/barcodes"
    QR_CODE_DIR: str = "static/qrcodes"
    
    # Email (Optional)
    SMTP_TLS: bool = True
    SMTP_PORT: Optional[int] = None
    SMTP_HOST: Optional[str] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[EmailStr] = None
    EMAILS_FROM_NAME: Optional[str] = None

    @validator("EMAILS_FROM_NAME")
    def get_project_name(cls, v: Optional[str], values: Dict[str, Any]) -> str:
        if not v:
            return values["PROJECT_NAME"]
        return v

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/2"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/3"
    
    # Monitoring
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Business Configuration
    DEFAULT_CURRENCY: str = "THB"
    DEFAULT_TIMEZONE: str = "Asia/Bangkok"
    DEFAULT_LANGUAGE: str = "th"
    TAX_RATE: float = 0.07  # 7% VAT
    
    # Notifications
    ENABLE_NOTIFICATIONS: bool = True
    ENABLE_EMAIL_NOTIFICATIONS: bool = True
    ENABLE_SMS_NOTIFICATIONS: bool = False
    
    # Cache
    CACHE_TTL: int = 3600  # 1 hour
    CACHE_PREFIX: str = "dried_fruits"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_BURST: int = 10
    
    # First Superuser
    FIRST_SUPERUSER_EMAIL: EmailStr = "admin@fareedadriedfruits.com"
    FIRST_SUPERUSER_PASSWORD: str = "admin123"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()


# Database URL for different environments
def get_database_url() -> str:
    """Get database URL based on environment"""
    if settings.TESTING:
        return settings.DATABASE_TEST_URL or settings.DATABASE_URL
    return settings.DATABASE_URL


# Redis URL for different environments  
def get_redis_url() -> str:
    """Get Redis URL based on environment"""
    if settings.TESTING:
        return settings.REDIS_TEST_URL
    return settings.REDIS_URL