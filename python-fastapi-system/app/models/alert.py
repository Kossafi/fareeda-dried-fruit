"""
Alert and notification models for stock monitoring
"""
import enum
from decimal import Decimal
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import (
    Column, String, Text, Boolean, DECIMAL, Integer, 
    ForeignKey, DateTime, Enum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, AuditMixin


class AlertType(str, enum.Enum):
    """Alert type enumeration"""
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"
    OVERSTOCK = "overstock"
    EXPIRY_WARNING = "expiry_warning"
    QUALITY_ISSUE = "quality_issue"
    PRICE_CHANGE = "price_change"
    SUPPLIER_ISSUE = "supplier_issue"
    SYSTEM_ERROR = "system_error"


class AlertSeverity(str, enum.Enum):
    """Alert severity enumeration"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    URGENT = "urgent"


class AlertStatus(str, enum.Enum):
    """Alert status enumeration"""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"
    EXPIRED = "expired"


class NotificationChannel(str, enum.Enum):
    """Notification channel enumeration"""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in_app"
    WEBHOOK = "webhook"
    SLACK = "slack"


class StockAlert(BaseModel, AuditMixin):
    """Stock alert model"""
    
    __tablename__ = "stock_alerts"
    
    # Alert Identification
    alert_number = Column(String(50), unique=True, nullable=False, index=True)
    alert_type = Column(Enum(AlertType), nullable=False)
    severity = Column(Enum(AlertSeverity), nullable=False)
    status = Column(Enum(AlertStatus), default=AlertStatus.ACTIVE, nullable=False)
    
    # Context Information
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Alert Data
    current_stock = Column(DECIMAL(12, 3), nullable=False)
    threshold_value = Column(DECIMAL(12, 3), nullable=True)
    threshold_type = Column(String(50), nullable=True)  # reorder_point, min_level, max_level
    
    # Stock Details
    available_stock = Column(DECIMAL(12, 3), nullable=True)
    reserved_stock = Column(DECIMAL(12, 3), nullable=True)
    suggested_quantity = Column(DECIMAL(12, 3), nullable=True)
    
    # Timing
    detected_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    first_occurrence = Column(DateTime(timezone=True), nullable=True)
    last_occurrence = Column(DateTime(timezone=True), nullable=True)
    
    # Escalation
    escalation_level = Column(Integer, default=1, nullable=False)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    auto_escalate = Column(Boolean, default=True, nullable=False)
    
    # Response Information
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledgment_notes = Column(Text, nullable=True)
    
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolution_action = Column(String(200), nullable=True)
    
    # Expiry and Auto-Resolution
    expires_at = Column(DateTime(timezone=True), nullable=True)
    auto_resolve = Column(Boolean, default=False, nullable=False)
    
    # Impact Assessment
    business_impact = Column(String(50), nullable=True)  # low, medium, high
    potential_lost_sales = Column(DECIMAL(10, 2), nullable=True)
    affected_customers = Column(Integer, nullable=True)
    
    # Additional Information
    alert_data = Column(JSONB, nullable=True)  # Additional alert-specific data
    metadata = Column(JSONB, nullable=True)
    
    # Notifications
    notification_sent = Column(Boolean, default=False, nullable=False)
    notification_count = Column(Integer, default=0, nullable=False)
    last_notification_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    branch = relationship("Branch")
    product = relationship("Product")
    acknowledged_by_user = relationship("User", foreign_keys=[acknowledged_by])
    resolved_by_user = relationship("User", foreign_keys=[resolved_by])
    notifications = relationship("AlertNotification", back_populates="alert", cascade="all, delete-orphan")
    
    @property
    def is_active(self) -> bool:
        """Check if alert is currently active"""
        return self.status == AlertStatus.ACTIVE
    
    @property
    def is_expired(self) -> bool:
        """Check if alert has expired"""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    @property
    def age_hours(self) -> float:
        """Get alert age in hours"""
        return (datetime.utcnow() - self.detected_at).total_seconds() / 3600
    
    @property
    def response_time_hours(self) -> Optional[float]:
        """Get response time in hours"""
        if self.acknowledged_at:
            return (self.acknowledged_at - self.detected_at).total_seconds() / 3600
        return None
    
    @property
    def resolution_time_hours(self) -> Optional[float]:
        """Get resolution time in hours"""
        if self.resolved_at:
            return (self.resolved_at - self.detected_at).total_seconds() / 3600
        return None
    
    @property
    def requires_escalation(self) -> bool:
        """Check if alert requires escalation"""
        if not self.auto_escalate:
            return False
        
        escalation_hours = {
            AlertSeverity.CRITICAL: 1,
            AlertSeverity.URGENT: 2,
            AlertSeverity.HIGH: 4,
            AlertSeverity.MEDIUM: 8,
            AlertSeverity.LOW: 24
        }
        
        threshold = escalation_hours.get(self.severity, 24)
        return self.age_hours >= threshold and self.status == AlertStatus.ACTIVE
    
    def calculate_suggested_quantity(self, optimal_stock: Decimal, reorder_quantity: Decimal = None) -> Decimal:
        """Calculate suggested reorder quantity"""
        if reorder_quantity:
            return reorder_quantity
        
        shortage = optimal_stock - self.current_stock
        return max(shortage, Decimal('0'))
    
    def acknowledge(self, user_id: str, notes: str = None):
        """Acknowledge the alert"""
        self.status = AlertStatus.ACKNOWLEDGED
        self.acknowledged_by = user_id
        self.acknowledged_at = datetime.utcnow()
        self.acknowledgment_notes = notes
    
    def resolve(self, user_id: str, notes: str = None, action: str = None):
        """Resolve the alert"""
        self.status = AlertStatus.RESOLVED
        self.resolved_by = user_id
        self.resolved_at = datetime.utcnow()
        self.resolution_notes = notes
        self.resolution_action = action
    
    def escalate(self):
        """Escalate the alert"""
        self.escalation_level += 1
        self.escalated_at = datetime.utcnow()
        if self.severity != AlertSeverity.CRITICAL:
            severity_order = [AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL]
            current_index = severity_order.index(self.severity)
            if current_index < len(severity_order) - 1:
                self.severity = severity_order[current_index + 1]
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["alert_number", "resolution_action"]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "alert_type", "severity", "status", "branch_id", "product_id",
            "acknowledged_by", "resolved_by", "detected_at", "business_impact"
        ]


class AlertThreshold(BaseModel, AuditMixin):
    """Alert threshold configuration"""
    
    __tablename__ = "alert_thresholds"
    
    # Scope
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    # Threshold Configuration
    reorder_point = Column(DECIMAL(12, 3), nullable=False)
    minimum_stock = Column(DECIMAL(12, 3), nullable=False)
    maximum_stock = Column(DECIMAL(12, 3), nullable=True)
    critical_stock = Column(DECIMAL(12, 3), nullable=True)
    
    # Reorder Settings
    reorder_quantity = Column(DECIMAL(12, 3), nullable=False)
    supplier_lead_time_days = Column(Integer, default=7, nullable=False)
    safety_stock_days = Column(Integer, default=3, nullable=False)
    
    # Alert Settings
    enable_low_stock_alert = Column(Boolean, default=True, nullable=False)
    enable_out_of_stock_alert = Column(Boolean, default=True, nullable=False)
    enable_overstock_alert = Column(Boolean, default=False, nullable=False)
    enable_expiry_alert = Column(Boolean, default=True, nullable=False)
    
    # Alert Timing
    expiry_warning_days = Column(Integer, default=7, nullable=False)
    notification_frequency_hours = Column(Integer, default=4, nullable=False)
    max_notifications_per_day = Column(Integer, default=6, nullable=False)
    
    # Business Rules
    seasonal_adjustment = Column(DECIMAL(5, 2), default=1.0, nullable=False)
    demand_forecast_days = Column(Integer, default=30, nullable=False)
    
    # Auto-Actions
    auto_create_purchase_order = Column(Boolean, default=False, nullable=False)
    auto_approve_small_orders = Column(Boolean, default=False, nullable=False)
    small_order_threshold = Column(DECIMAL(10, 2), nullable=True)
    
    # Escalation Rules
    escalation_rules = Column(JSONB, nullable=True)
    
    # Validity
    effective_from = Column(DateTime(timezone=True), nullable=True)
    effective_until = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    branch = relationship("Branch")
    product = relationship("Product")
    
    @property
    def is_effective(self) -> bool:
        """Check if threshold is currently effective"""
        now = datetime.utcnow()
        if self.effective_from and now < self.effective_from:
            return False
        if self.effective_until and now > self.effective_until:
            return False
        return self.is_active
    
    def calculate_dynamic_reorder_point(self, daily_sales_avg: Decimal) -> Decimal:
        """Calculate dynamic reorder point based on sales velocity"""
        lead_time_stock = daily_sales_avg * self.supplier_lead_time_days
        safety_stock = daily_sales_avg * self.safety_stock_days
        return (lead_time_stock + safety_stock) * self.seasonal_adjustment
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "branch_id", "product_id", "enable_low_stock_alert",
            "auto_create_purchase_order", "is_active"
        ]


class AlertNotification(BaseModel):
    """Notification delivery tracking"""
    
    __tablename__ = "alert_notifications"
    
    # References
    alert_id = Column(UUID(as_uuid=True), ForeignKey("stock_alerts.id"), nullable=False)
    
    # Notification Details
    channel = Column(Enum(NotificationChannel), nullable=False)
    recipient = Column(String(255), nullable=False)  # email, phone, user_id, etc.
    recipient_type = Column(String(50), nullable=False)  # user, role, email, phone
    
    # Message Content
    subject = Column(String(500), nullable=True)
    message = Column(Text, nullable=False)
    template_used = Column(String(100), nullable=True)
    
    # Delivery Status
    status = Column(String(50), default="pending", nullable=False)  # pending, sent, delivered, failed
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    
    # External Service Information
    external_id = Column(String(100), nullable=True)  # Provider's message ID
    provider = Column(String(50), nullable=True)  # email/sms provider
    provider_response = Column(JSONB, nullable=True)
    
    # Retry Information
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    
    # Error Handling
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)
    
    # User Interaction
    read_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)
    action_taken = Column(String(100), nullable=True)
    
    # Cost Tracking
    cost = Column(DECIMAL(6, 4), nullable=True)  # Cost of sending notification
    
    # Relationships
    alert = relationship("StockAlert", back_populates="notifications")
    
    @property
    def is_delivered(self) -> bool:
        """Check if notification was delivered"""
        return self.status == "delivered"
    
    @property
    def can_retry(self) -> bool:
        """Check if notification can be retried"""
        return (
            self.status == "failed" and
            self.retry_count < self.max_retries
        )
    
    @property
    def delivery_time_seconds(self) -> Optional[float]:
        """Get delivery time in seconds"""
        if self.sent_at and self.delivered_at:
            return (self.delivered_at - self.sent_at).total_seconds()
        return None
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "alert_id", "channel", "recipient_type", "status",
            "sent_at", "provider"
        ]


class AlertSubscription(BaseModel, AuditMixin):
    """User subscriptions to alert types and channels"""
    
    __tablename__ = "alert_subscriptions"
    
    # Subscriber Information
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Subscription Scope
    alert_types = Column(JSONB, nullable=False)  # Array of alert types
    severities = Column(JSONB, nullable=False)  # Array of severities
    
    # Location Scope
    all_branches = Column(Boolean, default=False, nullable=False)
    branch_ids = Column(JSONB, nullable=True)  # Array of branch IDs
    
    # Product Scope
    all_products = Column(Boolean, default=False, nullable=False)
    product_ids = Column(JSONB, nullable=True)  # Array of product IDs
    category_ids = Column(JSONB, nullable=True)  # Array of category IDs
    
    # Notification Preferences
    channels = Column(JSONB, nullable=False)  # Array of notification channels
    email_address = Column(String(255), nullable=True)
    phone_number = Column(String(20), nullable=True)
    
    # Timing Preferences
    quiet_hours_start = Column(String(5), nullable=True)  # "22:00"
    quiet_hours_end = Column(String(5), nullable=True)    # "08:00"
    timezone = Column(String(50), default="Asia/Bangkok", nullable=False)
    
    # Frequency Control
    max_notifications_per_hour = Column(Integer, default=5, nullable=False)
    digest_mode = Column(Boolean, default=False, nullable=False)
    digest_frequency_hours = Column(Integer, default=4, nullable=False)
    
    # Escalation
    escalation_delay_minutes = Column(Integer, default=60, nullable=False)
    escalation_channels = Column(JSONB, nullable=True)  # Channels for escalated alerts
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    last_notification_at = Column(DateTime(timezone=True), nullable=True)
    notification_count_today = Column(Integer, default=0, nullable=False)
    
    # Relationships
    user = relationship("User")
    
    def matches_alert(self, alert: StockAlert) -> bool:
        """Check if subscription matches given alert"""
        # Check alert type
        if alert.alert_type.value not in self.alert_types:
            return False
        
        # Check severity
        if alert.severity.value not in self.severities:
            return False
        
        # Check branch scope
        if not self.all_branches:
            if not self.branch_ids or str(alert.branch_id) not in self.branch_ids:
                return False
        
        # Check product scope
        if not self.all_products:
            if self.product_ids and str(alert.product_id) not in self.product_ids:
                return False
            # TODO: Check category IDs if product not in direct list
        
        return True
    
    def is_in_quiet_hours(self) -> bool:
        """Check if current time is in quiet hours"""
        if not self.quiet_hours_start or not self.quiet_hours_end:
            return False
        
        # This would need proper timezone handling
        # For now, return False
        return False
    
    def can_send_notification(self) -> bool:
        """Check if notification can be sent based on rate limits"""
        if self.is_in_quiet_hours():
            return False
        
        if self.notification_count_today >= (self.max_notifications_per_hour * 24):
            return False
        
        return True
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "user_id", "all_branches", "all_products", "is_active",
            "digest_mode", "created_at"
        ]


class AlertRule(BaseModel, AuditMixin):
    """Custom alert rules and conditions"""
    
    __tablename__ = "alert_rules"
    
    # Rule Information
    rule_name = Column(String(200), nullable=False)
    rule_code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    
    # Rule Type and Category
    rule_type = Column(String(50), nullable=False)  # threshold, trend, anomaly, composite
    alert_type = Column(Enum(AlertType), nullable=False)
    severity = Column(Enum(AlertSeverity), nullable=False)
    
    # Scope
    branch_ids = Column(JSONB, nullable=True)  # Array of branch IDs, null = all
    product_ids = Column(JSONB, nullable=True)  # Array of product IDs, null = all
    category_ids = Column(JSONB, nullable=True)  # Array of category IDs
    
    # Conditions
    conditions = Column(JSONB, nullable=False)  # Rule conditions and logic
    aggregation_period = Column(String(50), nullable=True)  # hour, day, week
    evaluation_frequency = Column(String(50), default="hourly", nullable=False)
    
    # Actions
    auto_actions = Column(JSONB, nullable=True)  # Automated actions to take
    notification_template = Column(String(100), nullable=True)
    
    # Status and Control
    is_enabled = Column(Boolean, default=True, nullable=False)
    last_evaluated_at = Column(DateTime(timezone=True), nullable=True)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    trigger_count = Column(Integer, default=0, nullable=False)
    
    # Performance
    evaluation_count = Column(Integer, default=0, nullable=False)
    average_evaluation_time_ms = Column(Integer, default=0, nullable=False)
    
    # Validity
    effective_from = Column(DateTime(timezone=True), nullable=True)
    effective_until = Column(DateTime(timezone=True), nullable=True)
    
    @property
    def is_effective(self) -> bool:
        """Check if rule is currently effective"""
        now = datetime.utcnow()
        if self.effective_from and now < self.effective_from:
            return False
        if self.effective_until and now > self.effective_until:
            return False
        return self.is_enabled and self.is_active
    
    @classmethod
    def get_searchable_fields(cls) -> List[str]:
        return ["rule_name", "rule_code", "description"]
    
    @classmethod
    def get_filterable_fields(cls) -> List[str]:
        return [
            "rule_type", "alert_type", "severity", "is_enabled",
            "evaluation_frequency", "is_active"
        ]


# Add indexes for performance
Index('idx_stock_alert_branch_product', StockAlert.branch_id, StockAlert.product_id)
Index('idx_stock_alert_status_severity', StockAlert.status, StockAlert.severity)
Index('idx_stock_alert_detected_at', StockAlert.detected_at)
Index('idx_alert_threshold_branch_product', AlertThreshold.branch_id, AlertThreshold.product_id, unique=True)
Index('idx_alert_notification_alert', AlertNotification.alert_id)
Index('idx_alert_notification_status', AlertNotification.status)
Index('idx_alert_subscription_user', AlertSubscription.user_id)