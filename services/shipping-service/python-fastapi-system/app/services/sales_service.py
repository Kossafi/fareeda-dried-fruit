"""
Sales service for business logic and calculations
"""
import io
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from decimal import Decimal
from uuid import UUID

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors

from app.models.sales import PaymentMethod, TransactionStatus, DiscountType


class SalesService:
    """Service for sales-related business logic"""
    
    def __init__(self):
        self.tax_rate = Decimal('0.07')  # 7% VAT in Thailand
        self.loyalty_points_rate = Decimal('0.01')  # 1 point per 100 THB
        
    def calculate_transaction_totals(
        self,
        items: List[Dict[str, Any]],
        discount_amount: Decimal = Decimal('0'),
        discount_type: Optional[DiscountType] = None,
        tax_rate: Optional[Decimal] = None
    ) -> Dict[str, Decimal]:
        """Calculate transaction totals"""
        
        # Calculate item totals
        subtotal = Decimal('0')
        total_discount = Decimal('0')
        
        for item in items:
            quantity = Decimal(str(item.get('quantity', 0)))
            unit_price = Decimal(str(item.get('unit_price', 0)))
            item_discount = Decimal(str(item.get('discount_percentage', 0)))
            
            # Calculate item total
            item_total = quantity * unit_price
            
            # Apply item-level discount
            if item_discount > 0:
                item_discount_amount = item_total * (item_discount / 100)
                item_total -= item_discount_amount
                total_discount += item_discount_amount
            
            subtotal += item_total
        
        # Apply transaction-level discount
        if discount_amount > 0:
            if discount_type == DiscountType.PERCENTAGE:
                transaction_discount = subtotal * (discount_amount / 100)
            else:
                transaction_discount = discount_amount
            
            subtotal -= transaction_discount
            total_discount += transaction_discount
        
        # Calculate tax
        tax_rate = tax_rate or self.tax_rate
        tax_amount = subtotal * tax_rate
        
        # Calculate final total
        total_amount = subtotal + tax_amount
        
        return {
            'subtotal': subtotal,
            'tax_amount': tax_amount,
            'total_discount': total_discount,
            'total_amount': total_amount
        }
    
    def calculate_loyalty_points(self, total_amount: Decimal) -> int:
        """Calculate loyalty points earned"""
        # 1 point per 100 THB spent
        return int(total_amount / 100)
    
    def calculate_change(
        self,
        total_amount: Decimal,
        cash_received: Decimal
    ) -> Decimal:
        """Calculate change due"""
        change = cash_received - total_amount
        return max(change, Decimal('0'))
    
    def validate_payment(
        self,
        payment_method: PaymentMethod,
        total_amount: Decimal,
        cash_received: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """Validate payment details"""
        result = {
            'valid': True,
            'message': 'Payment valid',
            'change_due': Decimal('0')
        }
        
        if payment_method == PaymentMethod.CASH:
            if not cash_received:
                result['valid'] = False
                result['message'] = 'Cash received amount required'
            elif cash_received < total_amount:
                result['valid'] = False
                result['message'] = 'Insufficient cash received'
            else:
                result['change_due'] = self.calculate_change(total_amount, cash_received)
        
        return result
    
    def generate_receipt_pdf(
        self,
        receipt_data: Dict[str, Any]
    ) -> bytes:
        """Generate PDF receipt"""
        buffer = io.BytesIO()
        
        # Create PDF document
        doc = SimpleDocTemplate(buffer, pagesize=(80*mm, 200*mm))
        story = []
        styles = getSampleStyleSheet()
        
        # Header
        title = Paragraph("FAREEDA DRIED FRUITS", styles['Title'])
        story.append(title)
        story.append(Spacer(1, 12))
        
        # Receipt details
        receipt_info = [
            f"Receipt: {receipt_data['receipt_number']}",
            f"Date: {receipt_data['transaction_date'].strftime('%d/%m/%Y %H:%M')}",
            f"Cashier: {receipt_data['cashier_name']}",
            f"Branch: {receipt_data['branch_name']}"
        ]
        
        if receipt_data.get('customer_name'):
            receipt_info.append(f"Customer: {receipt_data['customer_name']}")
        
        for info in receipt_info:
            story.append(Paragraph(info, styles['Normal']))
        
        story.append(Spacer(1, 12))
        
        # Items table
        items_data = [['Item', 'Qty', 'Price', 'Total']]
        for item in receipt_data['items']:
            items_data.append([
                item['product_name'][:20],  # Truncate long names
                str(item['quantity']),
                f"฿{item['unit_price']:.2f}",
                f"฿{item['total_price']:.2f}"
            ])
        
        items_table = Table(items_data, colWidths=[35*mm, 10*mm, 15*mm, 15*mm])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(items_table)
        story.append(Spacer(1, 12))
        
        # Totals
        totals = [
            f"Subtotal: ฿{receipt_data['subtotal']:.2f}",
            f"Discount: ฿{receipt_data['discount_amount']:.2f}",
            f"Tax: ฿{receipt_data['tax_amount']:.2f}",
            f"Total: ฿{receipt_data['total_amount']:.2f}"
        ]
        
        for total in totals:
            story.append(Paragraph(total, styles['Normal']))
        
        # Payment details
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"Payment: {receipt_data['payment_method']}", styles['Normal']))
        
        if receipt_data.get('cash_received'):
            story.append(Paragraph(f"Cash: ฿{receipt_data['cash_received']:.2f}", styles['Normal']))
        
        if receipt_data.get('change_due'):
            story.append(Paragraph(f"Change: ฿{receipt_data['change_due']:.2f}", styles['Normal']))
        
        # Loyalty points
        if receipt_data.get('loyalty_points_earned'):
            story.append(Spacer(1, 12))
            story.append(Paragraph(f"Points Earned: {receipt_data['loyalty_points_earned']}", styles['Normal']))
        
        if receipt_data.get('loyalty_points_balance'):
            story.append(Paragraph(f"Points Balance: {receipt_data['loyalty_points_balance']}", styles['Normal']))
        
        # Footer
        story.append(Spacer(1, 12))
        story.append(Paragraph("Thank you for your purchase!", styles['Normal']))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        return buffer.getvalue()
    
    def generate_daily_sales_report(
        self,
        sales_data: Dict[str, Any],
        date: datetime
    ) -> bytes:
        """Generate daily sales report PDF"""
        buffer = io.BytesIO()
        
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        # Header
        title = Paragraph(f"Daily Sales Report - {date.strftime('%d/%m/%Y')}", styles['Title'])
        story.append(title)
        story.append(Spacer(1, 20))
        
        # Summary table
        summary_data = [
            ['Metric', 'Value'],
            ['Total Transactions', str(sales_data['transaction_count'])],
            ['Total Revenue', f"฿{sales_data['total_revenue']:.2f}"],
            ['Average Sale', f"฿{sales_data['average_sale']:.2f}"],
            ['Total Tax', f"฿{sales_data['total_tax']:.2f}"],
            ['Total Discount', f"฿{sales_data['total_discount']:.2f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[100*mm, 50*mm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 20))
        
        # Payment breakdown
        if sales_data.get('payment_breakdown'):
            story.append(Paragraph("Payment Methods", styles['Heading2']))
            payment_data = [['Method', 'Count', 'Amount']]
            
            for payment in sales_data['payment_breakdown']:
                payment_data.append([
                    payment['method'],
                    str(payment['count']),
                    f"฿{payment['amount']:.2f}"
                ])
            
            payment_table = Table(payment_data, colWidths=[50*mm, 30*mm, 50*mm])
            payment_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(payment_table)
        
        # Top products
        if sales_data.get('top_products'):
            story.append(Spacer(1, 20))
            story.append(Paragraph("Top Selling Products", styles['Heading2']))
            
            products_data = [['Product', 'Quantity', 'Revenue']]
            for product in sales_data['top_products'][:10]:
                products_data.append([
                    product['product_name'][:30],
                    str(product['total_sold']),
                    f"฿{product['total_revenue']:.2f}"
                ])
            
            products_table = Table(products_data, colWidths=[80*mm, 30*mm, 40*mm])
            products_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(products_table)
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        return buffer.getvalue()
    
    def calculate_sales_analytics(
        self,
        transactions: List[Dict[str, Any]],
        period_days: int = 30
    ) -> Dict[str, Any]:
        """Calculate sales analytics"""
        if not transactions:
            return {
                'total_revenue': Decimal('0'),
                'transaction_count': 0,
                'average_sale': Decimal('0'),
                'growth_rate': Decimal('0'),
                'trending_up': False
            }
        
        # Current period
        current_revenue = sum(Decimal(str(t.get('total_amount', 0))) for t in transactions)
        current_count = len(transactions)
        current_avg = current_revenue / current_count if current_count > 0 else Decimal('0')
        
        # Previous period comparison (simplified)
        # In reality, you'd fetch previous period data
        previous_revenue = current_revenue * Decimal('0.9')  # Simulate 10% growth
        growth_rate = ((current_revenue - previous_revenue) / previous_revenue * 100) if previous_revenue > 0 else Decimal('0')
        
        return {
            'total_revenue': current_revenue,
            'transaction_count': current_count,
            'average_sale': current_avg,
            'growth_rate': growth_rate,
            'trending_up': growth_rate > 0
        }
    
    def validate_discount(
        self,
        discount_amount: Decimal,
        discount_type: DiscountType,
        subtotal: Decimal,
        max_discount_percentage: Decimal = Decimal('50')
    ) -> Dict[str, Any]:
        """Validate discount application"""
        result = {
            'valid': True,
            'message': 'Discount valid',
            'calculated_amount': discount_amount
        }
        
        if discount_type == DiscountType.PERCENTAGE:
            if discount_amount > max_discount_percentage:
                result['valid'] = False
                result['message'] = f'Discount cannot exceed {max_discount_percentage}%'
            else:
                result['calculated_amount'] = subtotal * (discount_amount / 100)
        else:
            if discount_amount > subtotal:
                result['valid'] = False
                result['message'] = 'Discount amount cannot exceed subtotal'
        
        return result
    
    def calculate_cashier_performance(
        self,
        transactions: List[Dict[str, Any]],
        cashier_id: str
    ) -> Dict[str, Any]:
        """Calculate cashier performance metrics"""
        cashier_transactions = [t for t in transactions if t.get('cashier_id') == cashier_id]
        
        if not cashier_transactions:
            return {
                'transaction_count': 0,
                'total_revenue': Decimal('0'),
                'average_sale': Decimal('0'),
                'items_per_transaction': Decimal('0'),
                'hourly_rate': Decimal('0')
            }
        
        total_revenue = sum(Decimal(str(t.get('total_amount', 0))) for t in cashier_transactions)
        transaction_count = len(cashier_transactions)
        total_items = sum(len(t.get('items', [])) for t in cashier_transactions)
        
        # Calculate working hours (simplified)
        working_hours = 8  # Assume 8-hour shift
        
        return {
            'transaction_count': transaction_count,
            'total_revenue': total_revenue,
            'average_sale': total_revenue / transaction_count,
            'items_per_transaction': Decimal(str(total_items)) / transaction_count,
            'hourly_rate': transaction_count / working_hours
        }


# Global service instance
sales_service = SalesService()