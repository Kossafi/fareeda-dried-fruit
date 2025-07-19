"""
Database configuration and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import redis

from app.core.config import get_database_url, get_redis_url, settings

# Database Engine
engine = create_engine(
    get_database_url(),
    pool_pre_ping=True,
    echo=settings.DEBUG,
    # For SQLite testing compatibility
    poolclass=StaticPool if "sqlite" in get_database_url() else None,
    connect_args={"check_same_thread": False} if "sqlite" in get_database_url() else {},
)

# Session Factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()

# Redis Connection
redis_client = redis.from_url(get_redis_url(), decode_responses=True)


def get_db():
    """
    Database dependency for FastAPI endpoints
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_redis():
    """
    Redis dependency for FastAPI endpoints
    """
    return redis_client


async def init_db():
    """
    Initialize database tables
    """
    # Import all models to ensure they are registered with SQLAlchemy
    from app.models import (
        user,
        branch,
        product,
        inventory,
        sales,
        barcode,
        repack,
        shipping,
        alert,
        sampling,
        procurement,
        analytics
    )
    
    # Create all tables
    Base.metadata.create_all(bind=engine)


async def close_db():
    """
    Close database connections
    """
    engine.dispose()
    redis_client.close()


# Database utilities
class DatabaseManager:
    """Database management utilities"""
    
    @staticmethod
    def create_tables():
        """Create all database tables"""
        Base.metadata.create_all(bind=engine)
    
    @staticmethod
    def drop_tables():
        """Drop all database tables"""
        Base.metadata.drop_all(bind=engine)
    
    @staticmethod
    def reset_database():
        """Reset database - drop and recreate all tables"""
        DatabaseManager.drop_tables()
        DatabaseManager.create_tables()


# Redis utilities
class CacheManager:
    """Redis cache management utilities"""
    
    def __init__(self, redis_client: redis.Redis = None):
        self.redis = redis_client or get_redis()
        self.prefix = settings.CACHE_PREFIX
        self.ttl = settings.CACHE_TTL
    
    def make_key(self, key: str) -> str:
        """Generate cache key with prefix"""
        return f"{self.prefix}:{key}"
    
    async def get(self, key: str):
        """Get value from cache"""
        cache_key = self.make_key(key)
        return self.redis.get(cache_key)
    
    async def set(self, key: str, value: str, ttl: int = None):
        """Set value in cache"""
        cache_key = self.make_key(key)
        ttl = ttl or self.ttl
        return self.redis.setex(cache_key, ttl, value)
    
    async def delete(self, key: str):
        """Delete value from cache"""
        cache_key = self.make_key(key)
        return self.redis.delete(cache_key)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        cache_key = self.make_key(key)
        return bool(self.redis.exists(cache_key))
    
    async def clear_pattern(self, pattern: str):
        """Clear all keys matching pattern"""
        pattern_key = self.make_key(pattern)
        keys = self.redis.keys(pattern_key)
        if keys:
            return self.redis.delete(*keys)
        return 0
    
    async def get_stats(self) -> dict:
        """Get cache statistics"""
        info = self.redis.info()
        return {
            "used_memory": info.get("used_memory_human"),
            "connected_clients": info.get("connected_clients"),
            "total_commands_processed": info.get("total_commands_processed"),
            "keyspace_hits": info.get("keyspace_hits"),
            "keyspace_misses": info.get("keyspace_misses"),
        }


# Global cache manager instance
cache_manager = CacheManager()