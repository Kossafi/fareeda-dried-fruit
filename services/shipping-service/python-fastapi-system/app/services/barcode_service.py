"""
Barcode service for advanced barcode operations
"""
import io
import qrcode
from barcode import Code128, EAN13
from barcode.writer import ImageWriter, SVGWriter
from typing import Dict, Any, Optional, List
from PIL import Image, ImageDraw, ImageFont
import base64
from datetime import datetime

from app.models.barcode import BarcodeType, LabelSize


class BarcodeService:
    """Service for barcode generation and processing"""
    
    def __init__(self):
        self.default_font_size = 12
        self.default_dpi = 300
        
    def generate_barcode_image(
        self,
        barcode_data: str,
        barcode_type: BarcodeType,
        width: int = 300,
        height: int = 100,
        format: str = "PNG"
    ) -> bytes:
        """Generate barcode image"""
        img_buffer = io.BytesIO()
        
        if barcode_type == BarcodeType.QR:
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4
            )
            qr.add_data(barcode_data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            img = img.resize((width, height), Image.Resampling.LANCZOS)
            img.save(img_buffer, format=format)
            
        elif barcode_type == BarcodeType.EAN13:
            # Generate EAN-13
            if len(barcode_data) != 13:
                raise ValueError("EAN-13 must be exactly 13 digits")
            
            writer = ImageWriter() if format.upper() == "PNG" else SVGWriter()
            ean = EAN13(barcode_data, writer=writer)
            ean.write(img_buffer)
            
        else:
            # Generate Code128
            writer = ImageWriter() if format.upper() == "PNG" else SVGWriter()
            code128 = Code128(barcode_data, writer=writer)
            code128.write(img_buffer)
        
        img_buffer.seek(0)
        return img_buffer.getvalue()
    
    def generate_label(
        self,
        barcode_data: str,
        barcode_type: BarcodeType,
        product_name: str,
        product_sku: str,
        batch_number: Optional[str] = None,
        expiry_date: Optional[datetime] = None,
        price: Optional[float] = None,
        label_size: LabelSize = LabelSize.MEDIUM,
        template_design: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """Generate complete product label with barcode"""
        
        # Define label dimensions based on size
        dimensions = self._get_label_dimensions(label_size)
        width, height = dimensions["width"], dimensions["height"]
        
        # Create label image
        label_img = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(label_img)
        
        # Load fonts
        try:
            title_font = ImageFont.truetype("arial.ttf", 16)
            normal_font = ImageFont.truetype("arial.ttf", 12)
            small_font = ImageFont.truetype("arial.ttf", 10)
        except OSError:
            # Fallback to default font
            title_font = ImageFont.load_default()
            normal_font = ImageFont.load_default()
            small_font = ImageFont.load_default()
        
        # Generate barcode
        barcode_img_data = self.generate_barcode_image(
            barcode_data, barcode_type, width=width-40, height=60
        )
        barcode_img = Image.open(io.BytesIO(barcode_img_data))
        
        # Position elements
        y_pos = 10
        
        # Product name
        draw.text((20, y_pos), product_name[:30], fill='black', font=title_font)
        y_pos += 25
        
        # SKU
        draw.text((20, y_pos), f"SKU: {product_sku}", fill='black', font=normal_font)
        y_pos += 20
        
        # Batch and expiry
        if batch_number:
            draw.text((20, y_pos), f"Batch: {batch_number}", fill='black', font=small_font)
            y_pos += 15
        
        if expiry_date:
            exp_str = expiry_date.strftime("%d/%m/%Y")
            draw.text((20, y_pos), f"Exp: {exp_str}", fill='black', font=small_font)
            y_pos += 15
        
        # Price
        if price:
            draw.text((20, y_pos), f"Price: ฿{price:.2f}", fill='black', font=normal_font)
            y_pos += 20
        
        # Add barcode
        barcode_y = height - 80
        label_img.paste(barcode_img, (20, barcode_y))
        
        # Add barcode text
        draw.text((20, barcode_y + 65), barcode_data, fill='black', font=small_font)
        
        # Convert to bytes
        img_buffer = io.BytesIO()
        label_img.save(img_buffer, format='PNG', dpi=(self.default_dpi, self.default_dpi))
        img_buffer.seek(0)
        
        return img_buffer.getvalue()
    
    def _get_label_dimensions(self, label_size: LabelSize) -> Dict[str, int]:
        """Get label dimensions in pixels"""
        dimensions = {
            LabelSize.SMALL: {"width": 200, "height": 100},
            LabelSize.MEDIUM: {"width": 300, "height": 150},
            LabelSize.LARGE: {"width": 400, "height": 200},
            LabelSize.EXTRA_LARGE: {"width": 500, "height": 250}
        }
        return dimensions.get(label_size, dimensions[LabelSize.MEDIUM])
    
    def validate_barcode(self, barcode_data: str, barcode_type: BarcodeType) -> bool:
        """Validate barcode data format"""
        if not barcode_data:
            return False
        
        if barcode_type == BarcodeType.EAN13:
            # EAN-13 must be exactly 13 digits
            if len(barcode_data) != 13 or not barcode_data.isdigit():
                return False
            
            # Validate check digit
            return self._validate_ean13_check_digit(barcode_data)
        
        elif barcode_type == BarcodeType.CODE128:
            # Code128 can contain alphanumeric characters
            if len(barcode_data) > 80:  # Maximum length
                return False
            
            # Check for valid characters
            valid_chars = set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")
            return all(char in valid_chars for char in barcode_data)
        
        elif barcode_type == BarcodeType.QR:
            # QR codes can contain various data types
            if len(barcode_data) > 2953:  # Maximum QR capacity
                return False
            return True
        
        return True
    
    def _validate_ean13_check_digit(self, barcode: str) -> bool:
        """Validate EAN-13 check digit"""
        if len(barcode) != 13:
            return False
        
        # Calculate check digit
        digits = [int(d) for d in barcode[:-1]]
        odd_sum = sum(digits[i] for i in range(0, 12, 2))
        even_sum = sum(digits[i] for i in range(1, 12, 2))
        total = odd_sum + (even_sum * 3)
        calculated_check = (10 - (total % 10)) % 10
        
        return calculated_check == int(barcode[-1])
    
    def generate_barcode_data_url(
        self,
        barcode_data: str,
        barcode_type: BarcodeType,
        width: int = 300,
        height: int = 100
    ) -> str:
        """Generate barcode as data URL for web display"""
        img_data = self.generate_barcode_image(
            barcode_data, barcode_type, width, height
        )
        
        # Convert to base64
        img_base64 = base64.b64encode(img_data).decode('utf-8')
        
        return f"data:image/png;base64,{img_base64}"
    
    def bulk_generate_labels(
        self,
        products_data: List[Dict[str, Any]],
        label_size: LabelSize = LabelSize.MEDIUM,
        template_design: Optional[Dict[str, Any]] = None
    ) -> List[bytes]:
        """Generate multiple labels in batch"""
        labels = []
        
        for product_data in products_data:
            try:
                label_data = self.generate_label(
                    barcode_data=product_data["barcode"],
                    barcode_type=product_data.get("barcode_type", BarcodeType.CODE128),
                    product_name=product_data["product_name"],
                    product_sku=product_data["product_sku"],
                    batch_number=product_data.get("batch_number"),
                    expiry_date=product_data.get("expiry_date"),
                    price=product_data.get("price"),
                    label_size=label_size,
                    template_design=template_design
                )
                labels.append(label_data)
            except Exception as e:
                # Log error and continue with next label
                print(f"Error generating label for {product_data.get('product_sku', 'unknown')}: {e}")
                continue
        
        return labels
    
    def create_label_sheet(
        self,
        labels: List[bytes],
        labels_per_row: int = 2,
        labels_per_column: int = 5,
        sheet_size: tuple = (2480, 3508),  # A4 at 300 DPI
        margin: int = 50
    ) -> bytes:
        """Create a sheet with multiple labels for printing"""
        sheet_width, sheet_height = sheet_size
        
        # Create sheet image
        sheet_img = Image.new('RGB', (sheet_width, sheet_height), color='white')
        
        # Calculate label positions
        usable_width = sheet_width - (2 * margin)
        usable_height = sheet_height - (2 * margin)
        
        label_width = usable_width // labels_per_row
        label_height = usable_height // labels_per_column
        
        # Place labels on sheet
        for i, label_data in enumerate(labels):
            if i >= labels_per_row * labels_per_column:
                break  # Sheet is full
            
            # Calculate position
            row = i // labels_per_row
            col = i % labels_per_row
            
            x = margin + (col * label_width)
            y = margin + (row * label_height)
            
            # Load and resize label
            label_img = Image.open(io.BytesIO(label_data))
            label_img = label_img.resize((label_width - 10, label_height - 10), Image.Resampling.LANCZOS)
            
            # Paste label on sheet
            sheet_img.paste(label_img, (x + 5, y + 5))
        
        # Convert to bytes
        sheet_buffer = io.BytesIO()
        sheet_img.save(sheet_buffer, format='PNG', dpi=(300, 300))
        sheet_buffer.seek(0)
        
        return sheet_buffer.getvalue()


# Global service instance
barcode_service = BarcodeService()