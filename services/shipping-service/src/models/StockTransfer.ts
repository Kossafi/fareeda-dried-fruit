import DatabaseConnection from '../database/connection';
import { StockTransfer, StockTransferItem, TransferStatus } from '@dried-fruits/types';

export class StockTransferModel {
  private db = DatabaseConnection.getInstance();

  async create(transferData: {
    deliveryOrderId: string;
    deliveryConfirmationId?: string;
    fromBranchId: string;
    toBranchId: string;
    transferType?: string;
    totalItems: number;
    totalValue?: number;
    notes?: string;
  }): Promise<StockTransfer> {
    const query = `
      INSERT INTO shipping.stock_transfers (
        delivery_order_id, delivery_confirmation_id, from_branch_id,
        to_branch_id, transfer_type, total_items, total_value, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      transferData.deliveryOrderId,
      transferData.deliveryConfirmationId,
      transferData.fromBranchId,
      transferData.toBranchId,
      transferData.transferType || 'delivery',
      transferData.totalItems,
      transferData.totalValue || 0,
      transferData.notes,
    ];

    const result = await this.db.query(query, values);
    return this.mapToStockTransfer(result.rows[0]);
  }

  async findById(id: string): Promise<StockTransfer | null> {
    const query = `
      SELECT * FROM shipping.stock_transfers 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapToStockTransfer(result.rows[0]) : null;
  }

  async findByDeliveryOrder(deliveryOrderId: string): Promise<StockTransfer[]> {
    const query = `
      SELECT * FROM shipping.stock_transfers 
      WHERE delivery_order_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [deliveryOrderId]);
    return result.rows.map(row => this.mapToStockTransfer(row));
  }

  async findByStatus(status: TransferStatus, limit?: number): Promise<StockTransfer[]> {
    let query = `
      SELECT * FROM shipping.stock_transfers 
      WHERE status = $1 
      ORDER BY created_at ASC
    `;

    const params = [status];

    if (limit) {
      query += ` LIMIT $2`;
      params.push(limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToStockTransfer(row));
  }

  async findByBranch(
    branchId: string,
    direction: 'from' | 'to' | 'both' = 'both',
    status?: TransferStatus
  ): Promise<StockTransfer[]> {
    let whereClause = '';
    const params = [branchId];
    let paramIndex = 2;

    switch (direction) {
      case 'from':
        whereClause = 'WHERE from_branch_id = $1';
        break;
      case 'to':
        whereClause = 'WHERE to_branch_id = $1';
        break;
      case 'both':
        whereClause = 'WHERE from_branch_id = $1 OR to_branch_id = $1';
        break;
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const query = `
      SELECT * FROM shipping.stock_transfers 
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToStockTransfer(row));
  }

  async updateStatus(
    id: string,
    status: TransferStatus,
    processedBy?: string,
    errorMessage?: string
  ): Promise<StockTransfer> {
    const query = `
      UPDATE shipping.stock_transfers 
      SET 
        status = $2,
        processed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE processed_at END,
        processed_by = $3,
        error_message = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id, status, processedBy, errorMessage]);
    
    if (result.rows.length === 0) {
      throw new Error(`Stock transfer not found: ${id}`);
    }

    return this.mapToStockTransfer(result.rows[0]);
  }

  async incrementRetryCount(id: string): Promise<StockTransfer> {
    const query = `
      UPDATE shipping.stock_transfers 
      SET retry_count = retry_count + 1, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error(`Stock transfer not found: ${id}`);
    }

    return this.mapToStockTransfer(result.rows[0]);
  }

  async getTransferSummary(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalValue: number;
  }> {
    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(total_value) as value
      FROM shipping.stock_transfers 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY status
    `;

    const result = await this.db.query(query);
    
    const summary = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalValue: 0,
    };

    result.rows.forEach(row => {
      const count = parseInt(row.count);
      const value = parseFloat(row.value) || 0;
      
      summary[row.status as keyof typeof summary] = count;
      summary.totalValue += value;
    });

    return summary;
  }

  async getFailedTransfers(limit: number = 10): Promise<Array<StockTransfer & {
    orderNumber: string;
    fromBranchName: string;
    toBranchName: string;
  }>> {
    const query = `
      SELECT st.*, do.order_number, fb.name as from_branch_name, tb.name as to_branch_name
      FROM shipping.stock_transfers st
      JOIN shipping.delivery_orders do ON st.delivery_order_id = do.id
      JOIN public.branches fb ON st.from_branch_id = fb.id
      JOIN public.branches tb ON st.to_branch_id = tb.id
      WHERE st.status = 'failed'
      ORDER BY st.updated_at DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    
    return result.rows.map(row => ({
      ...this.mapToStockTransfer(row),
      orderNumber: row.order_number,
      fromBranchName: row.from_branch_name,
      toBranchName: row.to_branch_name,
    }));
  }

  async getTransferAnalytics(
    startDate: Date,
    endDate: Date,
    branchId?: string
  ): Promise<{
    totalTransfers: number;
    successfulTransfers: number;
    failedTransfers: number;
    successRate: number;
    averageProcessingTime: number;
    totalValueTransferred: number;
  }> {
    let whereClause = 'WHERE created_at >= $1 AND created_at <= $2';
    const params = [startDate, endDate];

    if (branchId) {
      whereClause += ' AND (from_branch_id = $3 OR to_branch_id = $3)';
      params.push(branchId);
    }

    const query = `
      SELECT 
        COUNT(*) as total_transfers,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_transfers,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transfers,
        AVG(CASE WHEN processed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (processed_at - created_at))/3600 END) as avg_processing_hours,
        SUM(CASE WHEN status = 'completed' THEN total_value ELSE 0 END) as total_value_transferred
      FROM shipping.stock_transfers 
      ${whereClause}
    `;

    const result = await this.db.query(query, params);
    const row = result.rows[0];

    const totalTransfers = parseInt(row.total_transfers) || 0;
    const successfulTransfers = parseInt(row.successful_transfers) || 0;
    const failedTransfers = parseInt(row.failed_transfers) || 0;

    return {
      totalTransfers,
      successfulTransfers,
      failedTransfers,
      successRate: totalTransfers > 0 ? (successfulTransfers / totalTransfers) * 100 : 0,
      averageProcessingTime: parseFloat(row.avg_processing_hours) || 0,
      totalValueTransferred: parseFloat(row.total_value_transferred) || 0,
    };
  }

  private mapToStockTransfer(row: any): StockTransfer {
    return {
      id: row.id,
      deliveryOrderId: row.delivery_order_id,
      deliveryConfirmationId: row.delivery_confirmation_id,
      fromBranchId: row.from_branch_id,
      toBranchId: row.to_branch_id,
      transferType: row.transfer_type,
      status: row.status,
      referenceNumber: row.reference_number,
      totalItems: parseInt(row.total_items) || 0,
      totalValue: parseFloat(row.total_value) || 0,
      processedAt: row.processed_at,
      processedBy: row.processed_by,
      notes: row.notes,
      errorMessage: row.error_message,
      retryCount: parseInt(row.retry_count) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default StockTransferModel;