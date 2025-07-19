import DatabaseConnection from '../database/connection';
import { BarcodeType } from '@dried-fruits/types';
import { BarcodeData } from '../utils/barcodeGenerator';

export interface BarcodeRecord {
  id: string;
  barcode_id: string;
  type: BarcodeType;
  entity_id: string;
  entity_type: string;
  branch_id: string;
  data: any;
  checksum: string;
  code128?: string;
  ean13?: string;
  qr_data?: string;
  is_active: boolean;
  printed_count: number;
  last_scanned_at?: Date;
  scanned_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ScanRecord {
  id: string;
  barcode_id: string;
  scanned_by: string;
  scan_location?: string;
  scan_device?: string;
  scan_result: 'success' | 'invalid' | 'expired';
  scan_data?: any;
  created_at: Date;
}

export class BarcodeModel {
  private db = DatabaseConnection.getInstance();

  async create(barcodeData: BarcodeData, additionalData?: {
    code128?: string;
    ean13?: string;
    qrData?: string;
    entityType: string;
    entityId: string;
  }): Promise<BarcodeRecord> {
    const query = `
      INSERT INTO inventory.barcodes (
        barcode_id, type, entity_id, entity_type, branch_id, 
        data, checksum, code128, ean13, qr_data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      barcodeData.id,
      barcodeData.type,
      additionalData?.entityId || '',
      additionalData?.entityType || barcodeData.type,
      this.extractBranchId(barcodeData),
      JSON.stringify(barcodeData.data),
      barcodeData.checksum,
      additionalData?.code128,
      additionalData?.ean13,
      additionalData?.qrData,
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async findById(barcodeId: string): Promise<BarcodeRecord | null> {
    const query = `
      SELECT * FROM inventory.barcodes 
      WHERE barcode_id = $1 AND is_active = true
    `;

    const result = await this.db.query(query, [barcodeId]);
    return result.rows[0] || null;
  }

  async findByEntityId(entityId: string, entityType: string): Promise<BarcodeRecord[]> {
    const query = `
      SELECT * FROM inventory.barcodes 
      WHERE entity_id = $1 AND entity_type = $2 AND is_active = true
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [entityId, entityType]);
    return result.rows;
  }

  async findByBranch(branchId: string, type?: BarcodeType): Promise<BarcodeRecord[]> {
    let query = `
      SELECT * FROM inventory.barcodes 
      WHERE branch_id = $1 AND is_active = true
    `;
    const values = [branchId];

    if (type) {
      query += ` AND type = $2`;
      values.push(type);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, values);
    return result.rows;
  }

  async findByCode128(code128: string): Promise<BarcodeRecord | null> {
    const query = `
      SELECT * FROM inventory.barcodes 
      WHERE code128 = $1 AND is_active = true
    `;

    const result = await this.db.query(query, [code128]);
    return result.rows[0] || null;
  }

  async findByEAN13(ean13: string): Promise<BarcodeRecord | null> {
    const query = `
      SELECT * FROM inventory.barcodes 
      WHERE ean13 = $1 AND is_active = true
    `;

    const result = await this.db.query(query, [ean13]);
    return result.rows[0] || null;
  }

  async recordScan(scanData: {
    barcodeId: string;
    scannedBy: string;
    scanLocation?: string;
    scanDevice?: string;
    scanResult: 'success' | 'invalid' | 'expired';
    scanData?: any;
  }): Promise<ScanRecord> {
    const insertScanQuery = `
      INSERT INTO inventory.barcode_scans (
        barcode_id, scanned_by, scan_location, scan_device, 
        scan_result, scan_data, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const updateBarcodeQuery = `
      UPDATE inventory.barcodes 
      SET 
        last_scanned_at = NOW(),
        scanned_count = scanned_count + 1,
        updated_at = NOW()
      WHERE barcode_id = $1
    `;

    return this.db.transaction(async (client) => {
      // Record the scan
      const scanResult = await client.query(insertScanQuery, [
        scanData.barcodeId,
        scanData.scannedBy,
        scanData.scanLocation,
        scanData.scanDevice,
        scanData.scanResult,
        scanData.scanData ? JSON.stringify(scanData.scanData) : null,
      ]);

      // Update barcode scan count
      await client.query(updateBarcodeQuery, [scanData.barcodeId]);

      return scanResult.rows[0];
    });
  }

  async recordPrint(barcodeId: string): Promise<void> {
    const query = `
      UPDATE inventory.barcodes 
      SET 
        printed_count = printed_count + 1,
        updated_at = NOW()
      WHERE barcode_id = $1
    `;

    await this.db.query(query, [barcodeId]);
  }

  async deactivate(barcodeId: string): Promise<void> {
    const query = `
      UPDATE inventory.barcodes 
      SET 
        is_active = false,
        updated_at = NOW()
      WHERE barcode_id = $1
    `;

    await this.db.query(query, [barcodeId]);
  }

  async getScanHistory(barcodeId: string, limit: number = 50): Promise<ScanRecord[]> {
    const query = `
      SELECT * FROM inventory.barcode_scans 
      WHERE barcode_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;

    const result = await this.db.query(query, [barcodeId, limit]);
    return result.rows;
  }

  async getBranchScanActivity(branchId: string, startDate: Date, endDate: Date): Promise<{
    date: string;
    scanCount: number;
    successfulScans: number;
    failedScans: number;
  }[]> {
    const query = `
      SELECT 
        DATE(bs.created_at) as scan_date,
        COUNT(*) as total_scans,
        COUNT(CASE WHEN bs.scan_result = 'success' THEN 1 END) as successful_scans,
        COUNT(CASE WHEN bs.scan_result != 'success' THEN 1 END) as failed_scans
      FROM inventory.barcode_scans bs
      JOIN inventory.barcodes b ON bs.barcode_id = b.barcode_id
      WHERE b.branch_id = $1 
        AND bs.created_at >= $2 
        AND bs.created_at <= $3
      GROUP BY DATE(bs.created_at)
      ORDER BY scan_date DESC
    `;

    const result = await this.db.query(query, [branchId, startDate, endDate]);
    
    return result.rows.map(row => ({
      date: row.scan_date,
      scanCount: parseInt(row.total_scans),
      successfulScans: parseInt(row.successful_scans),
      failedScans: parseInt(row.failed_scans),
    }));
  }

  async getMostScannedProducts(branchId: string, limit: number = 10): Promise<{
    productId: string;
    productName: string;
    scanCount: number;
    lastScanned: Date;
  }[]> {
    const query = `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        COUNT(bs.id) as scan_count,
        MAX(bs.created_at) as last_scanned
      FROM inventory.barcode_scans bs
      JOIN inventory.barcodes b ON bs.barcode_id = b.barcode_id
      JOIN public.products p ON (b.data->>'productId')::text = p.id
      WHERE b.branch_id = $1 
        AND bs.scan_result = 'success'
        AND bs.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY p.id, p.name
      ORDER BY scan_count DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [branchId, limit]);
    
    return result.rows.map(row => ({
      productId: row.product_id,
      productName: row.product_name,
      scanCount: parseInt(row.scan_count),
      lastScanned: row.last_scanned,
    }));
  }

  private extractBranchId(barcodeData: BarcodeData): string {
    if (barcodeData.data.branchId) {
      return barcodeData.data.branchId;
    }
    
    // Try to extract from barcode ID
    const parts = barcodeData.id.split('-');
    if (parts.length >= 3) {
      return parts[2];
    }
    
    return '';
  }
}

export default BarcodeModel;