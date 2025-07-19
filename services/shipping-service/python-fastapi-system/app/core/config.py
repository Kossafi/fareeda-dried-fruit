"""
Configuration settings
"""
import secrets
from typing import List, Optional

class Settings:
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Dried Fruits Inventory System"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "ระบบจัดการสินค้าผลไม้แห้ง"
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database
    DATABASE_URL: str = "sqlite:///./dried_fruits.db"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    # Host settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    # Optional settings
    ALLOWED_HOSTS: Optional[List[str]] = None

settings = Settings()