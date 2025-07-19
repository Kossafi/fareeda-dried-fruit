"""
Base CRUD operations for all models
"""
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.base import BaseModel as DBModel

ModelType = TypeVar("ModelType", bound=DBModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base class for CRUD operations"""
    
    def __init__(self, model: Type[ModelType]):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).
        
        **Parameters**
        * `model`: A SQLAlchemy model class
        * `schema`: A Pydantic model (schema) class
        """
        self.model = model

    def get(self, db: Session, id: Union[UUID, str]) -> Optional[ModelType]:
        """Get a single record by ID"""
        return db.query(self.model).filter(self.model.id == id).first()

    def get_multi(
        self, 
        db: Session, 
        *, 
        skip: int = 0, 
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[ModelType]:
        """Get multiple records with pagination and filters"""
        query = db.query(self.model)
        
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    query = query.filter(getattr(self.model, key) == value)
        
        return query.offset(skip).limit(limit).all()

    def count(
        self, 
        db: Session, 
        filters: Optional[Dict[str, Any]] = None
    ) -> int:
        """Count records with optional filters"""
        query = db.query(self.model)
        
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    query = query.filter(getattr(self.model, key) == value)
        
        return query.count()

    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record"""
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """Update an existing record"""
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, *, id: Union[UUID, str]) -> ModelType:
        """Delete a record by ID"""
        obj = db.query(self.model).get(id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj

    def soft_delete(self, db: Session, *, id: Union[UUID, str]) -> ModelType:
        """Soft delete a record by ID (if model supports it)"""
        obj = db.query(self.model).get(id)
        if obj and hasattr(obj, 'is_deleted'):
            obj.is_deleted = True
            db.add(obj)
            db.commit()
            db.refresh(obj)
        return obj

    def restore(self, db: Session, *, id: Union[UUID, str]) -> ModelType:
        """Restore a soft-deleted record"""
        obj = db.query(self.model).get(id)
        if obj and hasattr(obj, 'is_deleted'):
            obj.is_deleted = False
            db.add(obj)
            db.commit()
            db.refresh(obj)
        return obj

    def get_by_field(
        self, 
        db: Session, 
        field_name: str, 
        field_value: Any
    ) -> Optional[ModelType]:
        """Get a record by any field"""
        if hasattr(self.model, field_name):
            return db.query(self.model).filter(
                getattr(self.model, field_name) == field_value
            ).first()
        return None

    def get_multi_by_field(
        self,
        db: Session,
        field_name: str,
        field_value: Any,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """Get multiple records by field value"""
        if hasattr(self.model, field_name):
            return db.query(self.model).filter(
                getattr(self.model, field_name) == field_value
            ).offset(skip).limit(limit).all()
        return []

    def search(
        self,
        db: Session,
        *,
        search_query: str,
        search_fields: List[str],
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """Search records across multiple fields"""
        query = db.query(self.model)
        
        if search_query and search_fields:
            search_conditions = []
            for field in search_fields:
                if hasattr(self.model, field):
                    attr = getattr(self.model, field)
                    if hasattr(attr.type, 'python_type') and attr.type.python_type == str:
                        search_conditions.append(
                            attr.ilike(f"%{search_query}%")
                        )
            
            if search_conditions:
                from sqlalchemy import or_
                query = query.filter(or_(*search_conditions))
        
        return query.offset(skip).limit(limit).all()

    def get_active(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """Get active records (if model supports is_active field)"""
        query = db.query(self.model)
        
        if hasattr(self.model, 'is_active'):
            query = query.filter(self.model.is_active == True)
        
        if hasattr(self.model, 'is_deleted'):
            query = query.filter(self.model.is_deleted == False)
        
        return query.offset(skip).limit(limit).all()

    def bulk_create(
        self,
        db: Session,
        *,
        objs_in: List[CreateSchemaType]
    ) -> List[ModelType]:
        """Create multiple records at once"""
        db_objs = []
        for obj_in in objs_in:
            obj_in_data = jsonable_encoder(obj_in)
            db_obj = self.model(**obj_in_data)
            db_objs.append(db_obj)
        
        db.add_all(db_objs)
        db.commit()
        
        for db_obj in db_objs:
            db.refresh(db_obj)
        
        return db_objs

    def exists(self, db: Session, *, id: Union[UUID, str]) -> bool:
        """Check if record exists"""
        return db.query(self.model).filter(self.model.id == id).first() is not None

    def exists_by_field(
        self,
        db: Session,
        field_name: str,
        field_value: Any
    ) -> bool:
        """Check if record exists by field value"""
        if hasattr(self.model, field_name):
            return db.query(self.model).filter(
                getattr(self.model, field_name) == field_value
            ).first() is not None
        return False