// Print Functions for Purchase Order and Goods Receipt

// Print Purchase Order function
function printPurchaseOrder() {
    const printContent = generatePurchaseOrderPrintContent();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

function generatePurchaseOrderPrintContent() {
    const poNumber = document.getElementById('poNumber').value;
    const orderDate = document.getElementById('orderDate').value;
    const deliveryDate = document.getElementById('deliveryDate').value;
    const buyerName = document.getElementById('buyerName').value;
    const notes = document.getElementById('notes').value;
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = subtotal * 0.07;
    const grandTotal = subtotal + vat;

    let itemsHTML = '';
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHTML += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.unit}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">฿${item.price.toLocaleString()}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">฿${itemTotal.toLocaleString()}</td>
            </tr>
        `;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>ใบสั่งซื้อ ${poNumber}</title>
            <style>
                body { font-family: 'Sarabun', Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .company-info { margin-bottom: 20px; }
                .po-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .supplier-info { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; }
                th { background-color: #f5f5f5; }
                .total-section { margin-top: 20px; }
                .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
                .signature-box { text-align: center; width: 200px; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>ใบสั่งซื้อ (Purchase Order)</h1>
                <h2>ระบบจัดการสต๊อคผลไม้อบแห้ง</h2>
            </div>

            <div class="company-info">
                <strong>บริษัท ผลไม้อบแห้ง จำกัด</strong><br>
                123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองตัน กรุงเทพฯ 10110<br>
                โทร: 02-123-4567 | อีเมล: info@driedfruit.co.th
            </div>

            <div class="po-info">
                <div>
                    <strong>เลขที่ใบสั่งซื้อ:</strong> ${poNumber}<br>
                    <strong>วันที่สั่งซื้อ:</strong> ${new Date(orderDate).toLocaleDateString('th-TH')}<br>
                    <strong>วันที่ต้องการรับสินค้า:</strong> ${new Date(deliveryDate).toLocaleDateString('th-TH')}
                </div>
                <div>
                    <strong>ผู้สั่งซื้อ:</strong> ${buyerName}<br>
                    <strong>วันที่พิมพ์:</strong> ${new Date().toLocaleDateString('th-TH')}<br>
                    <strong>เวลา:</strong> ${new Date().toLocaleTimeString('th-TH')}
                </div>
            </div>

            <div class="supplier-info">
                <strong>ซัพพลายเออร์:</strong><br>
                ${selectedSupplier.name}<br>
                โทร: ${selectedSupplier.phone}<br>
                อีเมล: ${selectedSupplier.email}<br>
                ที่อยู่: ${selectedSupplier.address}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>รายการสินค้า</th>
                        <th>จำนวน</th>
                        <th>หน่วย</th>
                        <th>ราคา/หน่วย</th>
                        <th>รวม</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <div class="total-section">
                <table style="width: 300px; margin-left: auto;">
                    <tr>
                        <td style="text-align: right; padding: 5px;"><strong>ยอดรวมสินค้า:</strong></td>
                        <td style="text-align: right; padding: 5px;">฿${subtotal.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="text-align: right; padding: 5px;"><strong>ภาษีมูลค่าเพิ่ม (7%):</strong></td>
                        <td style="text-align: right; padding: 5px;">฿${Math.round(vat).toLocaleString()}</td>
                    </tr>
                    <tr style="background-color: #f5f5f5;">
                        <td style="text-align: right; padding: 5px;"><strong>ยอดรวมทั้งสิ้น:</strong></td>
                        <td style="text-align: right; padding: 5px;"><strong>฿${Math.round(grandTotal).toLocaleString()}</strong></td>
                    </tr>
                </table>
            </div>

            ${notes ? `<div style="margin-top: 20px;"><strong>หมายเหตุ:</strong><br>${notes}</div>` : ''}

            <div class="signature-section">
                <div class="signature-box">
                    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 50px;"></div>
                    <div>ผู้สั่งซื้อ</div>
                    <div>วันที่: _______________</div>
                </div>
                <div class="signature-box">
                    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 50px;"></div>
                    <div>ผู้อนุมัติ</div>
                    <div>วันที่: _______________</div>
                </div>
                <div class="signature-box">
                    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 50px;"></div>
                    <div>ซัพพลายเออร์รับทราบ</div>
                    <div>วันที่: _______________</div>
                </div>
            </div>

            <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
                *** เอกสารนี้ออกโดยระบบจัดการสต๊อคผลไม้อบแห้ง ***
            </div>
        </body>
        </html>
    `;
}

// Print Goods Receipt function
function printGoodsReceipt() {
    const printContent = generateGoodsReceiptPrintContent();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

function generateGoodsReceiptPrintContent() {
    const grNumber = document.getElementById('grNumber').value;
    const receiptDate = document.getElementById('receiptDate').value;
    const receivedBy = document.getElementById('receivedBy').value;
    const notes = document.getElementById('receiptNotes').value;
    
    const totalOrdered = receiptItems.length;
    const totalReceived = receiptItems.filter(item => item.receivedQty > 0).length;
    const totalDiscrepancies = receiptItems.filter(item => item.difference !== 0).length;

    let itemsHTML = '';
    receiptItems.forEach(item => {
        const statusText = item.difference === 0 ? 'ตรงกัน' : 
                          item.difference > 0 ? 'เกิน' : 'ขาด';
        const statusColor = item.difference === 0 ? '#10B981' : 
                           item.difference > 0 ? '#3B82F6' : '#EF4444';
        
        itemsHTML += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.orderedQty}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.receivedQty}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.unit}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: ${statusColor};">
                    ${item.difference > 0 ? '+' : ''}${item.difference}
                </td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: ${statusColor};">
                    ${statusText}
                </td>
            </tr>
        `;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>ใบรับสินค้า ${grNumber}</title>
            <style>
                body { font-family: 'Sarabun', Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .company-info { margin-bottom: 20px; }
                .gr-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .po-info { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; }
                th { background-color: #f5f5f5; }
                .summary-section { margin-top: 20px; }
                .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
                .signature-box { text-align: center; width: 200px; }
                .status-match { color: #10B981; }
                .status-excess { color: #3B82F6; }
                .status-shortage { color: #EF4444; }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>ใบรับสินค้า (Goods Receipt)</h1>
                <h2>ระบบจัดการสต๊อคผลไม้อบแห้ง</h2>
            </div>

            <div class="company-info">
                <strong>บริษัท ผลไม้อบแห้ง จำกัด</strong><br>
                123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองตัน กรุงเทพฯ 10110<br>
                โทร: 02-123-4567 | อีเมล: info@driedfruit.co.th
            </div>

            <div class="gr-info">
                <div>
                    <strong>เลขที่ใบรับสินค้า:</strong> ${grNumber}<br>
                    <strong>เลขที่ใบสั่งซื้อ:</strong> ${currentPO.poNumber}<br>
                    <strong>วันที่รับสินค้า:</strong> ${new Date(receiptDate).toLocaleDateString('th-TH')}
                </div>
                <div>
                    <strong>ผู้รับสินค้า:</strong> ${receivedBy}<br>
                    <strong>วันที่พิมพ์:</strong> ${new Date().toLocaleDateString('th-TH')}<br>
                    <strong>เวลา:</strong> ${new Date().toLocaleTimeString('th-TH')}
                </div>
            </div>

            <div class="po-info">
                <strong>ซัพพลายเออร์:</strong> ${currentPO.supplier}<br>
                <strong>วันที่สั่งซื้อ:</strong> ${new Date(currentPO.orderDate).toLocaleDateString('th-TH')}<br>
                <strong>กำหนดส่ง:</strong> ${new Date(currentPO.deliveryDate).toLocaleDateString('th-TH')}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>รายการสินค้า</th>
                        <th>จำนวนที่สั่ง</th>
                        <th>จำนวนที่ได้รับ</th>
                        <th>หน่วย</th>
                        <th>ส่วนต่าง</th>
                        <th>สถานะ</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <div class="summary-section">
                <table style="width: 400px; margin-left: auto;">
                    <tr>
                        <td style="text-align: right; padding: 5px;"><strong>รายการที่สั่งทั้งหมด:</strong></td>
                        <td style="text-align: right; padding: 5px;">${totalOrdered} รายการ</td>
                    </tr>
                    <tr>
                        <td style="text-align: right; padding: 5px;"><strong>รายการที่ได้รับ:</strong></td>
                        <td style="text-align: right; padding: 5px;">${totalReceived} รายการ</td>
                    </tr>
                    <tr style="background-color: ${totalDiscrepancies > 0 ? '#fef2f2' : '#f0fdf4'};">
                        <td style="text-align: right; padding: 5px;"><strong>รายการที่มีส่วนต่าง:</strong></td>
                        <td style="text-align: right; padding: 5px; color: ${totalDiscrepancies > 0 ? '#EF4444' : '#10B981'};">
                            <strong>${totalDiscrepancies} รายการ</strong>
                        </td>
                    </tr>
                </table>
            </div>

            ${notes ? `<div style="margin-top: 20px;"><strong>หมายเหตุ:</strong><br>${notes}</div>` : ''}

            <div class="signature-section">
                <div class="signature-box">
                    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 50px;"></div>
                    <div>ผู้ส่งสินค้า</div>
                    <div>วันที่: _______________</div>
                </div>
                <div class="signature-box">
                    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 50px;"></div>
                    <div>ผู้รับสินค้า</div>
                    <div>วันที่: _______________</div>
                </div>
                <div class="signature-box">
                    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 50px;"></div>
                    <div>ผู้ตรวจสอบ</div>
                    <div>วันที่: _______________</div>
                </div>
            </div>

            <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
                *** เอกสารนี้ออกโดยระบบจัดการสต๊อคผลไม้อบแห้ง ***<br>
                ${totalDiscrepancies > 0 ? '⚠️ เอกสารนี้มีรายการที่มีส่วนต่าง กรุณาตรวจสอบ' : '✅ การรับสินค้าสมบูรณ์'}
            </div>
        </body>
        </html>
    `;
}