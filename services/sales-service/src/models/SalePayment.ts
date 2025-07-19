import DatabaseConnection from '../database/connection';
import { SalePayment, PaymentMethod } from '@dried-fruits/types';

export class SalePaymentModel {
  private db = DatabaseConnection.getInstance();

  async create(paymentData: {
    saleId: string;
    paymentMethod: PaymentMethod;
    amount: number;
    referenceNumber?: string;
    receivedAmount?: number;
    changeAmount?: number;
    cardLast4?: string;
    cardType?: string;
    bankName?: string;
    approvalCode?: string;
    terminalId?: string;
    processedBy: string;
    notes?: string;
  }): Promise<SalePayment> {
    const query = `
      INSERT INTO sales.sale_payments (
        sale_id, payment_method, amount, reference_number, received_amount,
        change_amount, card_last4, card_type, bank_name, approval_code,
        terminal_id, processed_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      paymentData.saleId,
      paymentData.paymentMethod,
      paymentData.amount,
      paymentData.referenceNumber,
      paymentData.receivedAmount,
      paymentData.changeAmount,
      paymentData.cardLast4,
      paymentData.cardType,
      paymentData.bankName,
      paymentData.approvalCode,
      paymentData.terminalId,
      paymentData.processedBy,
      paymentData.notes,
    ];

    const result = await this.db.query(query, values);
    return this.mapToSalePayment(result.rows[0]);
  }

  async findBySale(saleId: string): Promise<SalePayment[]> {
    const query = `
      SELECT * FROM sales.sale_payments 
      WHERE sale_id = $1 
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [saleId]);
    return result.rows.map(row => this.mapToSalePayment(row));
  }

  async findById(id: string): Promise<SalePayment | null> {
    const query = `
      SELECT * FROM sales.sale_payments 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapToSalePayment(result.rows[0]) : null;
  }

  async voidPayment(id: string, reason: string, voidedBy: string): Promise<SalePayment> {
    const query = `
      UPDATE sales.sale_payments 
      SET 
        voided = true,
        voided_at = NOW(),
        void_reason = $2,
        voided_by = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [id, reason, voidedBy]);
    
    if (result.rows.length === 0) {
      throw new Error(`Sale payment not found: ${id}`);
    }

    return this.mapToSalePayment(result.rows[0]);
  }

  async bulkCreate(payments: Array<{
    saleId: string;
    paymentMethod: PaymentMethod;
    amount: number;
    referenceNumber?: string;
    receivedAmount?: number;
    changeAmount?: number;
    cardLast4?: string;
    cardType?: string;
    bankName?: string;
    approvalCode?: string;
    terminalId?: string;
    processedBy: string;
    notes?: string;
  }>): Promise<SalePayment[]> {
    if (payments.length === 0) {
      return [];
    }

    return this.db.transaction(async (client) => {
      const results: SalePayment[] = [];

      for (const payment of payments) {
        const query = `
          INSERT INTO sales.sale_payments (
            sale_id, payment_method, amount, reference_number, received_amount,
            change_amount, card_last4, card_type, bank_name, approval_code,
            terminal_id, processed_by, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `;

        const values = [
          payment.saleId,
          payment.paymentMethod,
          payment.amount,
          payment.referenceNumber,
          payment.receivedAmount,
          payment.changeAmount,
          payment.cardLast4,
          payment.cardType,
          payment.bankName,
          payment.approvalCode,
          payment.terminalId,
          payment.processedBy,
          payment.notes,
        ];

        const result = await client.query(query, values);
        results.push(this.mapToSalePayment(result.rows[0]));
      }

      return results;
    });
  }

  async findByPaymentMethod(
    paymentMethod: PaymentMethod,
    branchId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<SalePayment[]> {
    let query = `
      SELECT sp.*, s.branch_id, s.sale_date, s.sale_number
      FROM sales.sale_payments sp
      JOIN sales.sales s ON sp.sale_id = s.id
      WHERE sp.payment_method = $1 
        AND sp.voided = false
        AND s.status = 'completed'
    `;

    const params = [paymentMethod];
    let paramIndex = 2;

    if (branchId) {
      query += ` AND s.branch_id = $${paramIndex++}`;
      params.push(branchId);
    }

    if (startDate && endDate) {
      query += ` AND s.sale_date >= $${paramIndex++} AND s.sale_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY s.sale_date DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToSalePayment(row));
  }

  async getPaymentAnalytics(
    branchId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalAmount: number;
    paymentMethodBreakdown: Array<{
      method: PaymentMethod;
      count: number;
      amount: number;
      percentage: number;
    }>;
    averageTransactionValue: number;
    cardVsCashRatio: { card: number; cash: number };
  }> {
    let query = `
      SELECT 
        sp.payment_method,
        COUNT(*) as payment_count,
        SUM(sp.amount) as total_amount
      FROM sales.sale_payments sp
      JOIN sales.sales s ON sp.sale_id = s.id
      WHERE sp.voided = false
        AND s.status = 'completed'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (branchId) {
      query += ` AND s.branch_id = $${paramIndex++}`;
      params.push(branchId);
    }

    if (startDate && endDate) {
      query += ` AND s.sale_date >= $${paramIndex++} AND s.sale_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    query += ` GROUP BY sp.payment_method ORDER BY total_amount DESC`;

    const result = await this.db.query(query, params);
    
    const totalAmount = result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount), 0);
    const totalCount = result.rows.reduce((sum, row) => sum + parseInt(row.payment_count), 0);

    const paymentMethodBreakdown = result.rows.map(row => ({
      method: row.payment_method as PaymentMethod,
      count: parseInt(row.payment_count),
      amount: parseFloat(row.total_amount),
      percentage: totalAmount > 0 ? (parseFloat(row.total_amount) / totalAmount) * 100 : 0,
    }));

    // Calculate card vs cash ratio
    const cardPayments = result.rows
      .filter(row => ['credit_card', 'debit_card'].includes(row.payment_method))
      .reduce((sum, row) => sum + parseFloat(row.total_amount), 0);
    
    const cashPayments = result.rows
      .filter(row => row.payment_method === 'cash')
      .reduce((sum, row) => sum + parseFloat(row.total_amount), 0);

    return {
      totalAmount,
      paymentMethodBreakdown,
      averageTransactionValue: totalCount > 0 ? totalAmount / totalCount : 0,
      cardVsCashRatio: {
        card: totalAmount > 0 ? (cardPayments / totalAmount) * 100 : 0,
        cash: totalAmount > 0 ? (cashPayments / totalAmount) * 100 : 0,
      },
    };
  }

  async refundPayment(
    id: string,
    refundAmount: number,
    refundReason: string,
    processedBy: string
  ): Promise<SalePayment> {
    return this.db.transaction(async (client) => {
      // Get the original payment
      const paymentQuery = 'SELECT * FROM sales.sale_payments WHERE id = $1';
      const paymentResult = await client.query(paymentQuery, [id]);
      
      if (paymentResult.rows.length === 0) {
        throw new Error('Payment not found');
      }

      const payment = paymentResult.rows[0];
      
      if (payment.voided) {
        throw new Error('Cannot refund a voided payment');
      }

      if (refundAmount > payment.amount) {
        throw new Error('Refund amount cannot exceed original payment amount');
      }

      // Create refund payment record
      const refundQuery = `
        INSERT INTO sales.sale_payments (
          sale_id, payment_method, amount, reference_number, 
          refund_original_id, processed_by, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const refundValues = [
        payment.sale_id,
        payment.payment_method,
        -refundAmount, // Negative amount for refund
        `REFUND-${payment.reference_number || payment.id}`,
        id,
        processedBy,
        `Refund: ${refundReason}`,
      ];

      const refundResult = await client.query(refundQuery, refundValues);
      return this.mapToSalePayment(refundResult.rows[0]);
    });
  }

  async findRefunds(originalPaymentId: string): Promise<SalePayment[]> {
    const query = `
      SELECT * FROM sales.sale_payments 
      WHERE refund_original_id = $1 
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [originalPaymentId]);
    return result.rows.map(row => this.mapToSalePayment(row));
  }

  async getTopPaymentMethods(
    branchId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 5
  ): Promise<Array<{
    paymentMethod: PaymentMethod;
    transactionCount: number;
    totalAmount: number;
    averageAmount: number;
  }>> {
    let query = `
      SELECT 
        sp.payment_method,
        COUNT(*) as transaction_count,
        SUM(sp.amount) as total_amount,
        AVG(sp.amount) as average_amount
      FROM sales.sale_payments sp
      JOIN sales.sales s ON sp.sale_id = s.id
      WHERE sp.voided = false
        AND s.status = 'completed'
        AND sp.amount > 0
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (branchId) {
      query += ` AND s.branch_id = $${paramIndex++}`;
      params.push(branchId);
    }

    if (startDate && endDate) {
      query += ` AND s.sale_date >= $${paramIndex++} AND s.sale_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    query += `
      GROUP BY sp.payment_method
      ORDER BY total_amount DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await this.db.query(query, params);
    
    return result.rows.map(row => ({
      paymentMethod: row.payment_method,
      transactionCount: parseInt(row.transaction_count),
      totalAmount: parseFloat(row.total_amount),
      averageAmount: parseFloat(row.average_amount),
    }));
  }

  private mapToSalePayment(row: any): SalePayment {
    return {
      id: row.id,
      saleId: row.sale_id,
      paymentMethod: row.payment_method,
      amount: parseFloat(row.amount),
      referenceNumber: row.reference_number,
      receivedAmount: row.received_amount ? parseFloat(row.received_amount) : undefined,
      changeAmount: row.change_amount ? parseFloat(row.change_amount) : undefined,
      cardLast4: row.card_last4,
      cardType: row.card_type,
      bankName: row.bank_name,
      approvalCode: row.approval_code,
      terminalId: row.terminal_id,
      processedBy: row.processed_by,
      notes: row.notes,
      refundOriginalId: row.refund_original_id,
      voided: row.voided,
      voidedAt: row.voided_at,
      voidedBy: row.voided_by,
      voidReason: row.void_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default SalePaymentModel;