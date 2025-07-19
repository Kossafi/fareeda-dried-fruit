# Requirements Document

## Introduction

ระบบบันทึกการขายและจัดการสต๊อคสำหรับสาขาผลไม้อบแห้งที่ตั้งอยู่ในห้างสรรพสินค้า โดยเน้นการใช้งานจริงที่จำเป็น ได้แก่ การบันทึกการขาย การจัดการสต๊อคสินค้า การสั่งและรับสินค้า การแจ้งเตือนสินค้าใกล้หมด และการรายงานผลการขายให้ผู้บริหาร

## Requirements

### Requirement 1: ระบบบันทึกการขายสำหรับพนักงานสาขา

**User Story:** As a branch staff member, I want to record sales transactions and automatically deduct inventory, so that I can track sales and stock levels accurately.

#### Acceptance Criteria

1. WHEN พนักงานเริ่มบันทึกการขาย THEN ระบบ SHALL แสดงหน้าจอบันทึกการขายพร้อมระบุสาขาและพนักงานที่ทำรายการ
2. WHEN เลือกสินค้าที่ขาย THEN ระบบ SHALL รองรับการค้นหาสินค้าด้วยชื่อและการสแกนบาร์โค้ด
3. WHEN บันทึกสินค้าที่ชั่งน้ำหนัก THEN ระบบ SHALL ให้กรอกน้ำหนักเป็นกรัมและแสดงจำนวนที่ขาย
4. WHEN บันทึกสินค้าที่นับชิ้น THEN ระบบ SHALL ให้กรอกจำนวนชิ้นและแสดงจำนวนที่ขาย
5. WHEN บันทึกการขายเสร็จสิ้น THEN ระบบ SHALL หักสต๊อคสินค้าในสาขาตามจำนวนที่ขายอัตโนมัติ
6. WHEN บันทึกรายการเสร็จสิ้น THEN ระบบ SHALL บันทึกข้อมูลจำนวนสินค้าพร้อม timestamp และส่งข้อมูลไปยังระบบกลาง

### Requirement 2: ระบบจัดการสต๊อคสินค้าในสาขา

**User Story:** As a branch staff member, I want to track inventory levels in my branch, so that I know how much stock is available for sale.

#### Acceptance Criteria

1. WHEN ดูสต๊อคสินค้า THEN ระบบ SHALL แสดงจำนวนสินค้าคงเหลือในสาขาแต่ละรายการ
2. WHEN มีการขายสินค้า THEN ระบบ SHALL หักสต๊อคจากจำนวนคงเหลือทันที
3. WHEN ต้องการตรวจสอบสต๊อค THEN ระบบ SHALL แสดงรายการสินค้าทั้งหมดพร้อมจำนวนคงเหลือ
4. WHEN สต๊อคสินค้าเปลี่ยนแปลง THEN ระบบ SHALL อัพเดทข้อมูลแบบเรียลไทม์

### Requirement 3: ระบบแจ้งเตือนสินค้าใกล้หมดในสาขา

**User Story:** As a branch manager, I want to receive alerts when products are running low, so that I can order more stock before running out.

#### Acceptance Criteria

1. WHEN สต๊อคสินค้าต่ำกว่าระดับที่กำหนด THEN ระบบ SHALL แจ้งเตือนสินค้าใกล้หมด
2. WHEN เข้าสู่ระบบ THEN ระบบ SHALL แสดงรายการสินค้าที่ใกล้หมดในหน้าแรก
3. WHEN ตั้งค่าระดับแจ้งเตือน THEN ระบบ SHALL ให้กำหนดจำนวนขั้นต่ำสำหรับแต่ละสินค้า
4. WHEN สินค้าหมด THEN ระบบ SHALL แจ้งเตือนและไม่ให้บันทึกการขายสินค้านั้น

### Requirement 4: ระบบสั่งสินค้าจากคลังสินค้า

**User Story:** As a branch manager, I want to order products from the warehouse, so that I can replenish stock when needed.

#### Acceptance Criteria

1. WHEN ต้องการสั่งสินค้า THEN ระบบ SHALL แสดงรายการสินค้าที่สามารถสั่งได้
2. WHEN เลือกสินค้าที่ต้องการสั่ง THEN ระบบ SHALL ให้กรอกจำนวนที่ต้องการ
3. WHEN ส่งคำสั่งซื้อ THEN ระบบ SHALL สร้างใบสั่งซื้อและส่งไปยังคลังสินค้า
4. WHEN ติดตามสถานะ THEN ระบบ SHALL แสดงสถานะการสั่งซื้อ (รอดำเนินการ, กำลังจัดส่ง, ส่งแล้ว)

### Requirement 5: ระบบรับสินค้าจากคลังสินค้า

**User Story:** As a branch staff member, I want to receive and confirm delivery of products from warehouse, so that inventory levels are updated correctly.

#### Acceptance Criteria

1. WHEN สินค้าถึงสาขา THEN ระบบ SHALL แสดงรายการสินค้าที่ควรจะได้รับ
2. WHEN ตรวจนับสินค้า THEN ระบบ SHALL ให้ยืนยันจำนวนที่ได้รับจริง
3. WHEN ยืนยันการรับสินค้า THEN ระบบ SHALL เพิ่มสต๊อคในสาขาตามจำนวนที่รับ
4. WHEN มีสินค้าไม่ตรงกัน THEN ระบบ SHALL ให้บันทึกความแตกต่างและแจ้งไปยังคลังสินค้า

### Requirement 6: ระบบรายงานการขายให้ผู้บริหาร

**User Story:** As a manager, I want to see sales reports from all branches, so that I can monitor business performance.

#### Acceptance Criteria

1. WHEN ดูรายงานการขาย THEN ระบบ SHALL แสดงจำนวนสินค้าที่ขายได้รายวัน/รายสัปดาห์/รายเดือน แยกตามสาขา
2. WHEN ต้องการดูรายละเอียด THEN ระบบ SHALL แสดงรายการขายแต่ละรายการพร้อมจำนวนสินค้า
3. WHEN เปรียบเทียบสาขา THEN ระบบ SHALL แสดงการเปรียบเทียบจำนวนสินค้าที่ขายได้ระหว่างสาขา
4. WHEN export ข้อมูล THEN ระบบ SHALL รองรับการ export รายงานจำนวนสินค้าเป็น Excel

### Requirement 7: ระบบแสดงกราฟและตารางช่วงเวลาขายดี

**User Story:** As a business analyst, I want to see sales patterns by time periods, so that I can identify peak sales hours and optimize staffing.

#### Acceptance Criteria

1. WHEN ดูกราฟการขาย THEN ระบบ SHALL แสดงกราฟยอดขายแยกตามช่วงเวลาในแต่ละวัน
2. WHEN วิเคราะห์ช่วงเวลา THEN ระบบ SHALL แสดงตารางช่วงเวลาที่ขายดีที่สุดในแต่ละวัน
3. WHEN เปรียบเทียบวัน THEN ระบบ SHALL แสดงการเปรียบเทียบช่วงเวลาขายดีระหว่างวันต่างๆ
4. WHEN ดูแนวโน้ม THEN ระบบ SHALL แสดงแนวโน้มการขายในช่วงเวลาต่างๆ ย้อนหลัง 30 วัน