"""
CRUD operations for Analytics and Reporting
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta, date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, text

from app.crud.base import CRUDBase
from app.models.analytics import DailyMetrics, ReportGeneration, KPIMetrics
from app.models.sales import SalesTransaction, SalesTransactionItem, Customer, TransactionStatus
from app.models.inventory import Inventory, StockMovement
from app.models.product import Product
from app.models.shipping import Shipment, ShipmentStatus
from app.models.user import User
from app.schemas.analytics import DailyMetricsCreate, ReportGenerationCreate


class CRUDAnalytics(CRUDBase[DailyMetrics, DailyMetricsCreate, None]):
    """CRUD operations for Analytics"""
    
    def get_sales_analytics(
        self,
        db: Session,
        *,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        branch_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Get comprehensive sales analytics"""
        
        # Default to last 30 days if no dates provided
        if not date_to:
            date_to = datetime.utcnow()
        if not date_from:
            date_from = date_to - timedelta(days=30)
        
        # Base query
        query = db.query(SalesTransaction).filter(
            and_(
                SalesTransaction.created_at >= date_from,
                SalesTransaction.created_at <= date_to,
                SalesTransaction.status == TransactionStatus.COMPLETED
            )
        )
        
        if branch_id:
            query = query.filter(SalesTransaction.branch_id == branch_id)
        
        transactions = query.all()
        
        # Calculate metrics
        total_revenue = sum(t.total_amount for t in transactions)
        total_transactions = len(transactions)
        average_transaction = total_revenue / total_transactions if total_transactions > 0 else Decimal('0')
        
        # Sales by day
        daily_sales = {}
        for transaction in transactions:
            day = transaction.created_at.date()
            if day not in daily_sales:
                daily_sales[day] = {
                    'date': day,
                    'revenue': Decimal('0'),
                    'transactions': 0,
                    'customers': set()
                }
            daily_sales[day]['revenue'] += transaction.total_amount
            daily_sales[day]['transactions'] += 1
            if transaction.customer_id:
                daily_sales[day]['customers'].add(transaction.customer_id)
        
        # Convert to list and format
        daily_sales_list = []
        for day_data in daily_sales.values():
            daily_sales_list.append({
                'date': day_data['date'],
                'revenue': float(day_data['revenue']),
                'transactions': day_data['transactions'],
                'unique_customers': len(day_data['customers'])
            })
        
        daily_sales_list.sort(key=lambda x: x['date'])
        
        # Top products
        top_products = db.query(
            Product.id,
            Product.product_name,
            Product.sku,
            func.sum(SalesTransactionItem.quantity).label('total_sold'),
            func.sum(SalesTransactionItem.total_price).label('total_revenue')
        ).join(SalesTransactionItem).join(SalesTransaction).filter(
            and_(
                SalesTransaction.created_at >= date_from,
                SalesTransaction.created_at <= date_to,
                SalesTransaction.status == TransactionStatus.COMPLETED
            )
        )
        
        if branch_id:
            top_products = top_products.filter(SalesTransaction.branch_id == branch_id)
        
        top_products = top_products.group_by(
            Product.id, Product.product_name, Product.sku
        ).order_by(
            desc(func.sum(SalesTransactionItem.quantity))
        ).limit(10).all()
        
        # Payment method breakdown
        payment_methods = {}
        for transaction in transactions:
            method = transaction.payment_method.value
            if method not in payment_methods:
                payment_methods[method] = {
                    'count': 0,
                    'amount': Decimal('0')
                }
            payment_methods[method]['count'] += 1
            payment_methods[method]['amount'] += transaction.total_amount
        
        return {
            'summary': {
                'total_revenue': float(total_revenue),
                'total_transactions': total_transactions,
                'average_transaction': float(average_transaction),
                'period_days': (date_to - date_from).days
            },
            'daily_sales': daily_sales_list,
            'top_products': [
                {
                    'product_id': str(p.id),
                    'product_name': p.product_name,
                    'sku': p.sku,
                    'total_sold': float(p.total_sold),
                    'total_revenue': float(p.total_revenue)
                }
                for p in top_products
            ],
            'payment_methods': {
                method: {
                    'count': data['count'],
                    'amount': float(data['amount'])
                }
                for method, data in payment_methods.items()
            }
        }
    
    def get_inventory_analytics(
        self,
        db: Session,
        *,
        branch_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Get inventory analytics"""
        
        # Base query
        query = db.query(Inventory).join(Product)
        
        if branch_id:
            query = query.filter(Inventory.branch_id == branch_id)
        
        inventories = query.all()
        
        # Calculate metrics
        total_items = len(inventories)
        total_value = sum(
            inv.quantity_on_hand * inv.product.unit_price 
            for inv in inventories
        )
        total_quantity = sum(inv.quantity_on_hand for inv in inventories)
        
        # Low stock items
        low_stock = [
            inv for inv in inventories 
            if inv.quantity_on_hand <= inv.reorder_point
        ]
        
        # Out of stock items
        out_of_stock = [
            inv for inv in inventories 
            if inv.quantity_on_hand <= 0
        ]
        
        # Overstocked items (quantity > reorder_point * 3)
        overstocked = [
            inv for inv in inventories 
            if inv.quantity_on_hand > inv.reorder_point * 3
        ]
        
        # Category breakdown
        category_breakdown = {}
        for inv in inventories:
            category = inv.product.category.value
            if category not in category_breakdown:
                category_breakdown[category] = {
                    'items': 0,
                    'quantity': Decimal('0'),
                    'value': Decimal('0')
                }
            category_breakdown[category]['items'] += 1
            category_breakdown[category]['quantity'] += inv.quantity_on_hand
            category_breakdown[category]['value'] += inv.quantity_on_hand * inv.product.unit_price
        
        # Stock movements (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        movements = db.query(StockMovement).filter(
            StockMovement.created_at >= thirty_days_ago
        )
        
        if branch_id:
            movements = movements.filter(StockMovement.branch_id == branch_id)
        
        movements = movements.all()
        
        # Movement summary
        movement_summary = {
            'total_movements': len(movements),
            'in_movements': len([m for m in movements if m.movement_type.value == 'IN']),
            'out_movements': len([m for m in movements if m.movement_type.value == 'OUT']),
            'adjustments': len([m for m in movements if m.reason.value == 'ADJUSTMENT'])
        }
        
        return {
            'summary': {
                'total_items': total_items,
                'total_value': float(total_value),
                'total_quantity': float(total_quantity),
                'low_stock_count': len(low_stock),
                'out_of_stock_count': len(out_of_stock),
                'overstocked_count': len(overstocked)
            },
            'alerts': {
                'low_stock': [
                    {
                        'product_name': inv.product.product_name,
                        'sku': inv.product.sku,
                        'current_stock': float(inv.quantity_on_hand),
                        'reorder_point': float(inv.reorder_point)
                    }
                    for inv in low_stock[:10]  # Top 10
                ],
                'out_of_stock': [
                    {
                        'product_name': inv.product.product_name,
                        'sku': inv.product.sku,
                        'last_movement': inv.last_movement_date
                    }
                    for inv in out_of_stock[:10]  # Top 10
                ]
            },
            'category_breakdown': {
                cat: {
                    'items': data['items'],
                    'quantity': float(data['quantity']),
                    'value': float(data['value'])
                }
                for cat, data in category_breakdown.items()
            },
            'movement_summary': movement_summary
        }
    
    def get_customer_analytics(
        self,
        db: Session,
        *,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get customer analytics"""
        
        # Default to last 30 days
        if not date_to:
            date_to = datetime.utcnow()
        if not date_from:
            date_from = date_to - timedelta(days=30)
        
        # Customer metrics
        total_customers = db.query(Customer).count()
        active_customers = db.query(Customer).filter(
            Customer.status == 'active'
        ).count()
        
        # New customers in period
        new_customers = db.query(Customer).filter(
            and_(
                Customer.created_at >= date_from,
                Customer.created_at <= date_to
            )
        ).count()
        
        # Customers with purchases in period
        customers_with_purchases = db.query(Customer).join(SalesTransaction).filter(
            and_(
                SalesTransaction.created_at >= date_from,
                SalesTransaction.created_at <= date_to,
                SalesTransaction.status == TransactionStatus.COMPLETED
            )
        ).distinct().count()
        
        # Customer tiers
        tier_breakdown = {}
        tiers = db.query(Customer.tier, func.count(Customer.id)).group_by(Customer.tier).all()
        for tier, count in tiers:
            tier_breakdown[tier.value] = count
        
        # Top customers by revenue
        top_customers = db.query(
            Customer.id,
            Customer.first_name,
            Customer.last_name,
            Customer.customer_code,
            func.sum(SalesTransaction.total_amount).label('total_spent')
        ).join(SalesTransaction).filter(
            and_(
                SalesTransaction.created_at >= date_from,
                SalesTransaction.created_at <= date_to,
                SalesTransaction.status == TransactionStatus.COMPLETED
            )
        ).group_by(
            Customer.id, Customer.first_name, Customer.last_name, Customer.customer_code
        ).order_by(
            desc(func.sum(SalesTransaction.total_amount))
        ).limit(10).all()
        
        # Customer acquisition by month
        monthly_acquisition = db.query(
            func.date_trunc('month', Customer.created_at).label('month'),
            func.count(Customer.id).label('new_customers')
        ).filter(
            Customer.created_at >= date_from - timedelta(days=365)  # Last year
        ).group_by(
            func.date_trunc('month', Customer.created_at)
        ).order_by('month').all()
        
        return {
            'summary': {
                'total_customers': total_customers,
                'active_customers': active_customers,
                'new_customers': new_customers,
                'customers_with_purchases': customers_with_purchases,
                'retention_rate': round(customers_with_purchases / total_customers * 100, 2) if total_customers > 0 else 0
            },
            'tier_breakdown': tier_breakdown,
            'top_customers': [
                {
                    'customer_id': str(c.id),
                    'name': f"{c.first_name} {c.last_name}",
                    'customer_code': c.customer_code,
                    'total_spent': float(c.total_spent)
                }
                for c in top_customers
            ],
            'monthly_acquisition': [
                {
                    'month': ma.month.strftime('%Y-%m'),
                    'new_customers': ma.new_customers
                }
                for ma in monthly_acquisition
            ]
        }
    
    def get_shipping_analytics(
        self,
        db: Session,
        *,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get shipping and delivery analytics"""
        
        # Default to last 30 days
        if not date_to:
            date_to = datetime.utcnow()
        if not date_from:
            date_from = date_to - timedelta(days=30)
        
        # Base query
        query = db.query(Shipment).filter(
            and_(
                Shipment.created_at >= date_from,
                Shipment.created_at <= date_to
            )
        )
        
        shipments = query.all()
        
        # Status breakdown
        status_breakdown = {}
        for status in ShipmentStatus:
            count = len([s for s in shipments if s.status == status])
            status_breakdown[status.value] = count
        
        # Delivery performance
        delivered_shipments = [s for s in shipments if s.status == ShipmentStatus.DELIVERED]
        
        if delivered_shipments:
            # On-time delivery rate
            on_time_deliveries = len([
                s for s in delivered_shipments 
                if s.delivered_at and s.estimated_delivery_date and s.delivered_at <= s.estimated_delivery_date
            ])
            on_time_rate = on_time_deliveries / len(delivered_shipments) * 100
            
            # Average delivery time
            delivery_times = []
            for s in delivered_shipments:
                if s.shipped_at and s.delivered_at:
                    delivery_time = (s.delivered_at - s.shipped_at).total_seconds() / 3600  # hours
                    delivery_times.append(delivery_time)
            
            avg_delivery_time = sum(delivery_times) / len(delivery_times) if delivery_times else 0
        else:
            on_time_rate = 0
            avg_delivery_time = 0
        
        # Route performance
        from app.models.shipping import DeliveryRoute
        routes = db.query(DeliveryRoute).filter(DeliveryRoute.is_active == True).all()
        
        route_performance = []
        for route in routes:
            route_shipments = [s for s in shipments if s.route_id == route.id]
            if route_shipments:
                completed = len([s for s in route_shipments if s.status == ShipmentStatus.DELIVERED])
                route_performance.append({
                    'route_name': route.route_name,
                    'total_shipments': len(route_shipments),
                    'completed_shipments': completed,
                    'success_rate': round(completed / len(route_shipments) * 100, 2)
                })
        
        return {
            'summary': {
                'total_shipments': len(shipments),
                'delivered_shipments': len(delivered_shipments),
                'on_time_delivery_rate': round(on_time_rate, 2),
                'average_delivery_time_hours': round(avg_delivery_time, 2)
            },
            'status_breakdown': status_breakdown,
            'route_performance': route_performance
        }
    
    def get_kpi_dashboard(
        self,
        db: Session,
        *,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        branch_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Get KPI dashboard data"""
        
        # Default to last 30 days
        if not date_to:
            date_to = datetime.utcnow()
        if not date_from:
            date_from = date_to - timedelta(days=30)
        
        # Get analytics from all modules
        sales_analytics = self.get_sales_analytics(db, date_from=date_from, date_to=date_to, branch_id=branch_id)
        inventory_analytics = self.get_inventory_analytics(db, branch_id=branch_id)
        customer_analytics = self.get_customer_analytics(db, date_from=date_from, date_to=date_to)
        shipping_analytics = self.get_shipping_analytics(db, date_from=date_from, date_to=date_to)
        
        # Combine into KPI dashboard
        return {
            'period': {
                'from': date_from.isoformat(),
                'to': date_to.isoformat(),
                'days': (date_to - date_from).days
            },
            'sales': {
                'revenue': sales_analytics['summary']['total_revenue'],
                'transactions': sales_analytics['summary']['total_transactions'],
                'average_transaction': sales_analytics['summary']['average_transaction']
            },
            'inventory': {
                'total_value': inventory_analytics['summary']['total_value'],
                'low_stock_alerts': inventory_analytics['summary']['low_stock_count'],
                'out_of_stock_alerts': inventory_analytics['summary']['out_of_stock_count']
            },
            'customers': {
                'total': customer_analytics['summary']['total_customers'],
                'active': customer_analytics['summary']['active_customers'],
                'new': customer_analytics['summary']['new_customers']
            },
            'shipping': {
                'total_shipments': shipping_analytics['summary']['total_shipments'],
                'on_time_rate': shipping_analytics['summary']['on_time_delivery_rate'],
                'avg_delivery_time': shipping_analytics['summary']['average_delivery_time_hours']
            }
        }
    
    def create_daily_metrics(
        self,
        db: Session,
        *,
        date: date,
        branch_id: Optional[UUID] = None
    ) -> DailyMetrics:
        """Create daily metrics snapshot"""
        
        # Get analytics for the day
        date_from = datetime.combine(date, datetime.min.time())
        date_to = datetime.combine(date, datetime.max.time())
        
        sales_analytics = self.get_sales_analytics(db, date_from=date_from, date_to=date_to, branch_id=branch_id)
        inventory_analytics = self.get_inventory_analytics(db, branch_id=branch_id)
        
        # Create metrics record
        metrics = DailyMetrics(
            date=date,
            branch_id=branch_id,
            total_revenue=Decimal(str(sales_analytics['summary']['total_revenue'])),
            total_transactions=sales_analytics['summary']['total_transactions'],
            total_customers=len(set(
                t.customer_id for t in db.query(SalesTransaction).filter(
                    and_(
                        SalesTransaction.created_at >= date_from,
                        SalesTransaction.created_at <= date_to,
                        SalesTransaction.customer_id != None
                    )
                ).all()
            )),
            inventory_value=Decimal(str(inventory_analytics['summary']['total_value'])),
            low_stock_alerts=inventory_analytics['summary']['low_stock_count'],
            calculated_at=datetime.utcnow()
        )
        
        db.add(metrics)
        db.commit()
        db.refresh(metrics)
        
        return metrics
    
    def get_trend_analysis(
        self,
        db: Session,
        *,
        metric: str,
        period_days: int = 30,
        branch_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Get trend analysis for a specific metric"""
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=period_days)
        
        # Get daily metrics
        query = db.query(DailyMetrics).filter(
            and_(
                DailyMetrics.date >= start_date.date(),
                DailyMetrics.date <= end_date.date()
            )
        )
        
        if branch_id:
            query = query.filter(DailyMetrics.branch_id == branch_id)
        
        daily_metrics = query.order_by(DailyMetrics.date).all()
        
        # Extract metric values
        if metric == 'revenue':
            values = [float(m.total_revenue) for m in daily_metrics]
        elif metric == 'transactions':
            values = [m.total_transactions for m in daily_metrics]
        elif metric == 'customers':
            values = [m.total_customers for m in daily_metrics]
        elif metric == 'inventory_value':
            values = [float(m.inventory_value) for m in daily_metrics]
        else:
            values = []
        
        # Calculate trend
        if len(values) >= 2:
            # Simple linear trend
            x = list(range(len(values)))
            n = len(values)
            sum_x = sum(x)
            sum_y = sum(values)
            sum_xy = sum(x[i] * values[i] for i in range(n))
            sum_x2 = sum(x[i] * x[i] for i in range(n))
            
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
            trend = 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'stable'
            
            # Calculate percentage change
            if values[0] != 0:
                pct_change = ((values[-1] - values[0]) / values[0]) * 100
            else:
                pct_change = 0
        else:
            trend = 'insufficient_data'
            pct_change = 0
        
        return {
            'metric': metric,
            'period_days': period_days,
            'data_points': len(values),
            'trend': trend,
            'percentage_change': round(pct_change, 2),
            'values': values,
            'dates': [m.date.isoformat() for m in daily_metrics]
        }


# Create the analytics CRUD instance
analytics_crud = CRUDAnalytics(DailyMetrics)