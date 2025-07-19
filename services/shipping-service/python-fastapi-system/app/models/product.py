"""
Product model
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class ProductCategory(enum.Enum):
    DRIED_FRUIT = "dried_fruit"
    NUT = "nut"
    SEED = "seed"
    SPICE = "spice"
    VEGETABLE = "vegetable"

class Unit(enum.Enum):
    GRAM = "gram"
    KILOGRAM = "kilogram"
    PIECE = "piece"
    BOX = "box"

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String, index=True)
    product_name_en = Column(String)
    sku = Column(String, unique=True, index=True)
    category = Column(Enum(ProductCategory))
    unit_price = Column(Float)
    cost_price = Column(Float)
    unit = Column(Enum(Unit))
    weight_per_unit = Column(Float)
    description = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    @property
    def profit_margin(self):
        if self.unit_price and self.cost_price:
            return (self.unit_price - self.cost_price) / self.unit_price * 100
        return 0