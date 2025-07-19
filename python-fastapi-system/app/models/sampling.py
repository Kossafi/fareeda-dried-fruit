"""
Sampling management models for product tasting and cost control
"""
import enum
from decimal import Decimal
from datetime import datetime, date
from typing import List, Optional

from sqlalchemy import (
    Column, String, Text, Boolean, DECIMAL, Integer, 
    ForeignKey, DateTime, Date, Enum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, AuditMixin


class SamplingStatus(str, enum.Enum):
    """Sampling status enumeration"""
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class ApprovalStatus(str, enum.Enum):
    """Approval status enumeration"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"


class SamplingOutcome(str, enum.Enum):
    """Sampling outcome enumeration"""
    PURCHASE = "purchase"
    NO_PURCHASE = "no_purchase"
    FUTURE_INTEREST = "future_interest"
    FEEDBACK_ONLY = "feedback_only"


class SamplingPolicy(BaseModel, AuditMixin):
    """Sampling policies and limits per branch and product"""
    
    __tablename__ = "sampling_policies"
    
    # Scope
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Daily Limits
    max_daily_weight_grams = Column(DECIMAL(8, 3), nullable=False)
    max_daily_sessions = Column(Integer, default=20, nullable=False)
    max_daily_cost = Column(DECIMAL(8, 2), nullable=True)
    
    # Per-Session Limits
    max_session_weight_grams = Column(DECIMAL(6, 3), default=50.0, nullable=False)
    max_customers_per_session = Column(Integer, default=10, nullable=False)
    
    # Cost Configuration
    cost_per_gram = Column(DECIMAL(8, 4), nullable=False)
    overhead_percentage = Column(DECIMAL(5, 2), default=15.0, nullable=False)
    labor_cost_per_session = Column(DECIMAL(6, 2), default=20.0, nullable=False)
    
    # Approval Thresholds
    requires_approval_above_grams = Column(DECIMAL(6, 3), default=30.0, nullable=False)
    requires_approval_above_cost = Column(DECIMAL(8, 2), default=100.0, nullable=False)
    auto_approve_regular_customers = Column(Boolean, default=True, nullable=False)
    
    # Time Restrictions
    allowed_hours_start = Column(String(5), default="10:00", nullable=False)  # "HH:MM"
    allowed_hours_end = Column(String(5), default="18:00", nullable=False)
    weekend_sampling = Column(Boolean, default=True, nullable=False)
    
    # Quality Standards
    minimum_product_grade = Column(String(10), default="A", nullable=False)
    expiry_buffer_days = Column(Integer, default=30, nullable=False)
    
    # ROI Tracking
    target_conversion_rate = Column(DECIMAL(5, 2), default=15.0, nullable=False)  # Percentage
    minimum_purchase_amount = Column(DECIMAL(8, 2), default=200.0, nullable=False)
    
    # Seasonal Adjustments
    seasonal_multiplier = Column(DECIMAL(4, 2), default=1.0, nullable=False)
    holiday_restrictions = Column(JSONB, nullable=True)
    
    # Special Conditions
    vip_customer_multiplier = Column(DECIMAL(4, 2), default=1.5, nullable=False)
    new_product_promotion = Column(Boolean, default=False, nullable=False)
    
    # Validity Period
    effective_from = Column(Date, nullable=True)
    effective_until = Column(Date, nullable=True)
    
    # Relationships
    branch = relationship("Branch")
    product = relationship("Product")
    
    @property
    def is_effective(self) -> bool:
        """Check if policy is currently effective"""
        today = date.today()
        if self.effective_from and today < self.effective_from:
            return False
        if self.effective_until and today > self.effective_until:
            return False
        return self.is_active
    
    @property
    def current_max_daily_weight(self) -> Decimal:
        """Get current max daily weight with seasonal adjustment"""
        return self.max_daily_weight_grams * self.seasonal_multiplier
    
    @property
    def current_max_session_weight(self) -> Decimal:
        """Get current max session weight with seasonal adjustment"""
        return self.max_session_weight_grams * self.seasonal_multiplier
    
    def calculate_total_cost_per_gram(self) -> Decimal:
        """Calculate total cost per gram including overhead"""
        base_cost = self.cost_per_gram
        overhead = base_cost * (self.overhead_percentage / 100)
        return base_cost + overhead
    
    def is_within_allowed_hours(self, time_str: str) -> bool:
        """Check if given time is within allowed sampling hours"""
        return self.allowed_hours_start <= time_str <= self.allowed_hours_end
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "branch_id", "product_id", "weekend_sampling",
            "new_product_promotion", "is_active"
        ]


class SamplingSession(BaseModel, AuditMixin):
    """Sampling sessions with customers"""
    
    __tablename__ = "sampling_sessions"
    
    # Session Information
    session_number = Column(String(50), unique=True, nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    
    # Timing
    session_date = Column(Date, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    
    # Staff and Customers
    staff_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    customer_count = Column(Integer, default=1, nullable=False)
    vip_customers = Column(Integer, default=0, nullable=False)
    new_customers = Column(Integer, default=0, nullable=False)
    
    # Session Summary
    total_products_sampled = Column(Integer, default=0, nullable=False)
    total_weight_grams = Column(DECIMAL(10, 3), default=0, nullable=False)
    total_cost = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Outcomes
    purchases_made = Column(Integer, default=0, nullable=False)
    total_purchase_amount = Column(DECIMAL(12, 2), default=0, nullable=False)
    conversion_rate = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # Status
    status = Column(Enum(SamplingStatus), default=SamplingStatus.PLANNED, nullable=False)
    
    # Location and Setup
    location_area = Column(String(100), nullable=True)  # Front desk, entrance, etc.
    setup_description = Column(Text, nullable=True)
    
    # Weather and Context
    weather_conditions = Column(String(100), nullable=True)
    foot_traffic_level = Column(String(20), nullable=True)  # low, medium, high
    special_events = Column(Text, nullable=True)
    
    # Quality Control
    hygiene_score = Column(Integer, nullable=True)  # 1-5 rating
    presentation_score = Column(Integer, nullable=True)  # 1-5 rating
    customer_satisfaction = Column(DECIMAL(3, 2), nullable=True)  # 1.00-5.00
    
    # Notes and Feedback
    session_notes = Column(Text, nullable=True)
    customer_feedback = Column(JSONB, nullable=True)  # Array of feedback objects
    staff_observations = Column(Text, nullable=True)
    
    # Approval (if required)
    requires_approval = Column(Boolean, default=False, nullable=False)
    approval_request_id = Column(UUID(as_uuid=True), ForeignKey("sampling_approvals.id"), nullable=True)
    
    # Marketing Integration
    promotion_campaign = Column(String(100), nullable=True)
    social_media_posts = Column(JSONB, nullable=True)
    photos_taken = Column(Integer, default=0, nullable=False)
    
    # Relationships
    branch = relationship("Branch")
    staff = relationship("User", foreign_keys=[staff_id])
    approval_request = relationship("SamplingApproval", back_populates="session")
    sampling_records = relationship("SamplingRecord", back_populates="session", cascade="all, delete-orphan")
    
    def calculate_session_metrics(self):
        """Calculate session summary metrics"""
        self.total_products_sampled = len(set(record.product_id for record in self.sampling_records))
        self.total_weight_grams = sum(record.weight_grams for record in self.sampling_records)
        self.total_cost = sum(record.total_cost for record in self.sampling_records)
        
        if self.customer_count > 0:
            self.conversion_rate = (self.purchases_made / self.customer_count) * 100
    
    def calculate_duration(self):
        """Calculate session duration"""
        if self.start_time and self.end_time:
            duration = self.end_time - self.start_time
            self.duration_minutes = int(duration.total_seconds() / 60)
    
    @property
    def roi_percentage(self) -> Decimal:
        """Calculate ROI percentage"""
        if self.total_cost > 0:
            profit = self.total_purchase_amount - self.total_cost
            return (profit / self.total_cost) * 100
        return Decimal('0')
    
    @property
    def cost_per_customer(self) -> Decimal:
        """Calculate cost per customer"""
        if self.customer_count > 0:
            return self.total_cost / self.customer_count
        return Decimal('0')
    
    @property
    def average_sample_weight(self) -> Decimal:
        """Calculate average sample weight per customer"""
        if self.customer_count > 0:
            return self.total_weight_grams / self.customer_count
        return Decimal('0')
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["session_number", "promotion_campaign"]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "branch_id", "staff_id", "session_date", "status",
            "requires_approval", "promotion_campaign"
        ]


class SamplingRecord(BaseModel):
    """Individual product sampling records"""
    
    __tablename__ = "sampling_records"
    
    # References
    session_id = Column(UUID(as_uuid=True), ForeignKey("sampling_sessions.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Sample Details
    weight_grams = Column(DECIMAL(8, 3), nullable=False)  # Precise to 3 decimal places
    cost_per_gram = Column(DECIMAL(8, 4), nullable=False)
    total_cost = Column(DECIMAL(8, 2), nullable=False)
    
    # Quality Information
    batch_number = Column(String(100), nullable=True)
    expiry_date = Column(Date, nullable=True)
    product_grade = Column(String(10), nullable=True)
    
    # Customer Response
    customer_rating = Column(Integer, nullable=True)  # 1-5 stars
    customer_comments = Column(Text, nullable=True)
    liked_aspects = Column(JSONB, nullable=True)  # Array of liked features
    disliked_aspects = Column(JSONB, nullable=True)  # Array of disliked features
    
    # Purchase Intent
    purchase_intent = Column(String(20), nullable=True)  # high, medium, low, none
    preferred_quantity = Column(DECIMAL(8, 2), nullable=True)  # Grams they'd like to buy
    price_sensitivity = Column(String(20), nullable=True)  # high, medium, low
    
    # Sample Presentation
    presentation_method = Column(String(50), nullable=True)  # tray, individual_cups, etc.
    serving_temperature = Column(String(20), nullable=True)  # room, chilled
    accompaniments = Column(JSONB, nullable=True)  # tea, water, crackers, etc.
    
    # Outcome Tracking
    resulted_in_purchase = Column(Boolean, default=False, nullable=False)
    purchase_amount = Column(DECIMAL(8, 2), nullable=True)
    purchase_date = Column(Date, nullable=True)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=True)
    
    # Staff Notes
    staff_notes = Column(Text, nullable=True)
    follow_up_required = Column(Boolean, default=False, nullable=False)
    follow_up_notes = Column(Text, nullable=True)
    
    # Timing
    sampled_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("SamplingSession", back_populates="sampling_records")
    product = relationship("Product")
    sale = relationship("Sale")
    
    def calculate_total_cost(self):
        """Calculate total cost for this sample"""
        self.total_cost = self.weight_grams * self.cost_per_gram
    
    @property
    def roi_contribution(self) -> Decimal:
        """Calculate ROI contribution if purchase was made"""
        if self.resulted_in_purchase and self.purchase_amount:
            return self.purchase_amount - self.total_cost
        return Decimal('0')
    
    @property
    def conversion_effectiveness(self) -> str:
        """Get conversion effectiveness rating"""
        if self.resulted_in_purchase:
            return "high"
        elif self.purchase_intent in ["high", "medium"]:
            return "medium"
        else:
            return "low"
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "session_id", "product_id", "resulted_in_purchase",
            "purchase_intent", "sampled_at"
        ]


class SamplingApproval(BaseModel, AuditMixin):
    """Approval requests for sampling sessions"""
    
    __tablename__ = "sampling_approvals"
    
    # Request Information
    approval_number = Column(String(50), unique=True, nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sampling_sessions.id"), nullable=True)
    
    # Request Details
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    
    # Sampling Details
    requested_products = Column(JSONB, nullable=False)  # Array of product requests
    total_estimated_weight = Column(DECIMAL(10, 3), nullable=False)
    total_estimated_cost = Column(DECIMAL(10, 2), nullable=False)
    estimated_customers = Column(Integer, nullable=False)
    
    # Justification
    business_justification = Column(Text, nullable=False)
    expected_outcomes = Column(Text, nullable=True)
    special_circumstances = Column(Text, nullable=True)
    
    # Approval Workflow
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING, nullable=False)
    approval_level = Column(Integer, default=1, nullable=False)
    
    # Level 1 Approval (Manager)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    manager_decision = Column(String(20), nullable=True)  # approved, rejected, escalated
    manager_comments = Column(Text, nullable=True)
    manager_decided_at = Column(DateTime(timezone=True), nullable=True)
    
    # Level 2 Approval (Executive) - if needed
    executive_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    executive_decision = Column(String(20), nullable=True)
    executive_comments = Column(Text, nullable=True)
    executive_decided_at = Column(DateTime(timezone=True), nullable=True)
    
    # Final Decision
    final_decision = Column(String(20), nullable=True)
    final_decision_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    final_decision_at = Column(DateTime(timezone=True), nullable=True)
    
    # Approved Limits (may differ from requested)
    approved_weight = Column(DECIMAL(10, 3), nullable=True)
    approved_cost = Column(DECIMAL(10, 2), nullable=True)
    approved_products = Column(JSONB, nullable=True)
    
    # Conditions and Restrictions
    approval_conditions = Column(Text, nullable=True)
    time_restrictions = Column(JSONB, nullable=True)
    reporting_requirements = Column(Text, nullable=True)
    
    # Urgency and Priority
    urgency_level = Column(String(20), default="normal", nullable=False)  # low, normal, high, urgent
    requested_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)
    
    # Relationships
    requested_by_user = relationship("User", foreign_keys=[requested_by])
    branch = relationship("Branch")
    manager = relationship("User", foreign_keys=[manager_id])
    executive = relationship("User", foreign_keys=[executive_id])
    final_decision_by_user = relationship("User", foreign_keys=[final_decision_by])
    session = relationship("SamplingSession", back_populates="approval_request", uselist=False)
    
    @property
    def is_pending(self) -> bool:
        """Check if approval is still pending"""
        return self.status == ApprovalStatus.PENDING
    
    @property
    def is_approved(self) -> bool:
        """Check if approval was granted"""
        return self.status == ApprovalStatus.APPROVED
    
    @property
    def processing_time_hours(self) -> Optional[float]:
        """Get processing time in hours"""
        if self.final_decision_at:
            duration = self.final_decision_at - self.created_at
            return duration.total_seconds() / 3600
        return None
    
    @property
    def days_until_expiry(self) -> Optional[int]:
        """Get days until approval expires"""
        if self.expiry_date:
            return (self.expiry_date - date.today()).days
        return None
    
    def needs_escalation(self) -> bool:
        """Check if approval needs escalation"""
        if self.total_estimated_cost > 500:  # High-value requests
            return True
        if self.urgency_level == "urgent":
            return True
        return False
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["approval_number", "business_justification"]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "requested_by", "branch_id", "status", "approval_level",
            "urgency_level", "requested_date", "manager_id", "executive_id"
        ]


class SamplingAnalytics(BaseModel):
    """Daily sampling analytics for reporting"""
    
    __tablename__ = "sampling_analytics"
    
    # Date and Scope
    analytics_date = Column(Date, nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    
    # Volume Metrics
    total_sessions = Column(Integer, default=0, nullable=False)
    total_customers = Column(Integer, default=0, nullable=False)
    total_weight_grams = Column(DECIMAL(12, 3), default=0, nullable=False)
    total_cost = Column(DECIMAL(12, 2), default=0, nullable=False)
    
    # Conversion Metrics
    customers_purchased = Column(Integer, default=0, nullable=False)
    total_purchase_amount = Column(DECIMAL(15, 2), default=0, nullable=False)
    conversion_rate = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # ROI Metrics
    roi_percentage = Column(DECIMAL(8, 2), default=0, nullable=False)
    cost_per_customer = Column(DECIMAL(8, 2), default=0, nullable=False)
    revenue_per_customer = Column(DECIMAL(10, 2), default=0, nullable=False)
    
    # Quality Metrics
    average_customer_rating = Column(DECIMAL(3, 2), nullable=True)
    average_staff_rating = Column(DECIMAL(3, 2), nullable=True)
    customer_satisfaction_score = Column(DECIMAL(5, 2), nullable=True)
    
    # Efficiency Metrics
    samples_per_session = Column(DECIMAL(6, 2), default=0, nullable=False)
    weight_per_customer = Column(DECIMAL(8, 3), default=0, nullable=False)
    cost_efficiency_score = Column(DECIMAL(5, 2), default=0, nullable=False)
    
    # Trends (compared to previous period)
    sessions_change_percent = Column(DECIMAL(6, 2), default=0, nullable=False)
    conversion_change_percent = Column(DECIMAL(6, 2), default=0, nullable=False)
    roi_change_percent = Column(DECIMAL(6, 2), default=0, nullable=False)
    
    # Relationships
    branch = relationship("Branch")
    product = relationship("Product")
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return ["analytics_date", "branch_id", "product_id"]


# Add indexes for performance
Index('idx_sampling_policy_branch_product', SamplingPolicy.branch_id, SamplingPolicy.product_id, unique=True)
Index('idx_sampling_session_branch_date', SamplingSession.branch_id, SamplingSession.session_date)
Index('idx_sampling_session_staff_date', SamplingSession.staff_id, SamplingSession.session_date)
Index('idx_sampling_record_session', SamplingRecord.session_id)
Index('idx_sampling_record_product', SamplingRecord.product_id)
Index('idx_sampling_approval_status', SamplingApproval.status)
Index('idx_sampling_approval_requested_by', SamplingApproval.requested_by)
Index('idx_sampling_analytics_date_branch', SamplingAnalytics.analytics_date, SamplingAnalytics.branch_id)