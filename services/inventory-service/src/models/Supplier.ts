import { BaseModel } from './BaseModel';
import DatabaseConnection from '../database/connection';
import { Supplier as ISupplier, SupplierType, SupplierProduct, SupplierFilters } from '@dried-fruits/types';
import logger from '../utils/logger';

export class Supplier extends BaseModel implements ISupplier {
  public supplierCode!: string;
  public companyName!: string;
  public contactPerson?: string;
  public email?: string;
  public phone?: string;
  public address?: string;
  public taxId?: string;
  public paymentTerms!: number;
  public creditLimit!: number;
  public currencyCode!: string;
  public isActive!: boolean;
  public supplierType!: SupplierType;
  public leadTimeDays!: number;
  public minimumOrderAmount!: number;
  public discountPercentage!: number;
  public qualityRating!: number;
  public deliveryRating!: number;
  public priceCompetitiveness!: number;
  public notes?: string;
  public createdBy!: string;

  protected tableName = 'suppliers';

  constructor(data?: Partial<ISupplier>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  // Create new supplier
  async create(supplierData: {
    supplierCode?: string;
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
    paymentTerms?: number;
    creditLimit?: number;
    currencyCode?: string;
    supplierType?: SupplierType;
    leadTimeDays?: number;
    minimumOrderAmount?: number;
    discountPercentage?: number;
    notes?: string;
    createdBy: string;
  }): Promise<Supplier> {
    const db = DatabaseConnection.getInstance();

    // Generate supplier code if not provided
    if (!supplierData.supplierCode) {
      supplierData.supplierCode = await this.generateSupplierCode();
    }

    const query = `
      INSERT INTO suppliers (
        supplier_code, company_name, contact_person, email, phone, address,
        tax_id, payment_terms, credit_limit, currency_code, supplier_type,
        lead_time_days, minimum_order_amount, discount_percentage, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      supplierData.supplierCode,
      supplierData.companyName,
      supplierData.contactPerson || null,
      supplierData.email || null,
      supplierData.phone || null,
      supplierData.address || null,
      supplierData.taxId || null,
      supplierData.paymentTerms || 30,
      supplierData.creditLimit || 0,
      supplierData.currencyCode || 'THB',
      supplierData.supplierType || SupplierType.REGULAR,
      supplierData.leadTimeDays || 7,
      supplierData.minimumOrderAmount || 0,
      supplierData.discountPercentage || 0,
      supplierData.notes || null,
      supplierData.createdBy
    ];

    const result = await db.query(query, values);
    const supplier = new Supplier(result.rows[0]);

    logger.info('Supplier created', {
      supplierId: supplier.id,
      supplierCode: supplier.supplierCode,
      companyName: supplier.companyName
    });

    return supplier;
  }

  // Update supplier
  async update(id: string, updateData: Partial<ISupplier>): Promise<Supplier> {
    const db = DatabaseConnection.getInstance();

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbKey = this.camelToSnake(key);
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);

    const query = `
      UPDATE suppliers 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Supplier not found');
    }

    return new Supplier(result.rows[0]);
  }

  // Get supplier by ID
  async getById(id: string): Promise<Supplier | null> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT s.*,
        COUNT(sp.id) as product_count,
        COUNT(po.id) as order_count,
        COALESCE(AVG(se.overall_rating), 0) as avg_rating
      FROM suppliers s
      LEFT JOIN supplier_products sp ON s.id = sp.supplier_id
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      LEFT JOIN supplier_evaluations se ON s.id = se.supplier_id
      WHERE s.id = $1
      GROUP BY s.id
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return new Supplier(result.rows[0]);
  }

  // Get suppliers with filters
  async getSuppliers(filters: SupplierFilters = {}): Promise<{
    suppliers: Supplier[];
    total: number;
  }> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.isActive !== undefined) {
      whereClause += ` AND s.is_active = $${paramCount}`;
      values.push(filters.isActive);
      paramCount++;
    }

    if (filters.supplierType && filters.supplierType.length > 0) {
      whereClause += ` AND s.supplier_type = ANY($${paramCount})`;
      values.push(filters.supplierType);
      paramCount++;
    }

    if (filters.ratingMin !== undefined) {
      whereClause += ` AND COALESCE(AVG(se.overall_rating), 0) >= $${paramCount}`;
      values.push(filters.ratingMin);
      paramCount++;
    }

    if (filters.search) {
      whereClause += ` AND (
        s.company_name ILIKE $${paramCount} OR 
        s.supplier_code ILIKE $${paramCount} OR
        s.contact_person ILIKE $${paramCount}
      )`;
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM suppliers s
      LEFT JOIN supplier_evaluations se ON s.id = se.supplier_id
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get suppliers
    const query = `
      SELECT s.*,
        COUNT(DISTINCT sp.id) as product_count,
        COUNT(DISTINCT po.id) as order_count,
        COALESCE(AVG(se.overall_rating), 0) as avg_rating,
        MAX(po.order_date) as last_order_date
      FROM suppliers s
      LEFT JOIN supplier_products sp ON s.id = sp.supplier_id
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      LEFT JOIN supplier_evaluations se ON s.id = se.supplier_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.company_name
    `;

    const result = await db.query(query, values);
    const suppliers = result.rows.map(row => new Supplier(row));

    return { suppliers, total };
  }

  // Add product to supplier
  async addProduct(supplierProductData: {
    supplierId: string;
    productId: string;
    supplierSku?: string;
    unitCost: number;
    minimumQuantity?: number;
    leadTimeDays?: number;
    qualityGrade?: string;
    isPreferred?: boolean;
  }): Promise<SupplierProduct> {
    const db = DatabaseConnection.getInstance();

    const query = `
      INSERT INTO supplier_products (
        supplier_id, product_id, supplier_sku, unit_cost,
        minimum_quantity, lead_time_days, quality_grade, is_preferred
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (supplier_id, product_id) 
      DO UPDATE SET 
        supplier_sku = EXCLUDED.supplier_sku,
        unit_cost = EXCLUDED.unit_cost,
        minimum_quantity = EXCLUDED.minimum_quantity,
        lead_time_days = EXCLUDED.lead_time_days,
        quality_grade = EXCLUDED.quality_grade,
        is_preferred = EXCLUDED.is_preferred,
        last_price_update = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      supplierProductData.supplierId,
      supplierProductData.productId,
      supplierProductData.supplierSku || null,
      supplierProductData.unitCost,
      supplierProductData.minimumQuantity || 1,
      supplierProductData.leadTimeDays || 7,
      supplierProductData.qualityGrade || 'A',
      supplierProductData.isPreferred || false
    ];

    const result = await db.query(query, values);
    return result.rows[0] as SupplierProduct;
  }

  // Get supplier products
  async getSupplierProducts(supplierId: string): Promise<SupplierProduct[]> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT sp.*, p.name as product_name, p.sku as product_sku
      FROM supplier_products sp
      JOIN products p ON sp.product_id = p.id
      WHERE sp.supplier_id = $1
      ORDER BY sp.is_preferred DESC, p.name
    `;

    const result = await db.query(query, [supplierId]);
    return result.rows;
  }

  // Get best suppliers for product
  async getBestSuppliersForProduct(
    productId: string, 
    quantity: number = 1
  ): Promise<Array<{
    supplier: Supplier;
    supplierProduct: SupplierProduct;
    score: number;
    reasons: string[];
  }>> {
    const db = DatabaseConnection.getInstance();

    const query = `
      WITH supplier_scores AS (
        SELECT 
          s.*,
          sp.*,
          -- Calculate overall score (0-100)
          (
            (s.quality_rating * 0.3) +
            (s.delivery_rating * 0.3) +
            (s.price_competitiveness * 0.25) +
            (CASE WHEN sp.is_preferred THEN 1 ELSE 0 END * 0.15)
          ) * 20 as overall_score
        FROM suppliers s
        JOIN supplier_products sp ON s.id = sp.supplier_id
        WHERE s.is_active = true
        AND sp.product_id = $1
        AND sp.minimum_quantity <= $2
      )
      SELECT 
        ss.*,
        p.name as product_name,
        CASE 
          WHEN ss.is_preferred THEN 'Preferred supplier'
          WHEN ss.quality_rating >= 4 THEN 'High quality rating'
          WHEN ss.delivery_rating >= 4 THEN 'Reliable delivery'
          WHEN ss.price_competitiveness >= 4 THEN 'Competitive pricing'
          ELSE 'Standard option'
        END as primary_reason
      FROM supplier_scores ss
      JOIN products p ON ss.product_id = p.id
      WHERE ss.overall_score > 0
      ORDER BY ss.overall_score DESC, ss.unit_cost ASC
      LIMIT 5
    `;

    const result = await db.query(query, [productId, quantity]);

    return result.rows.map(row => {
      const supplier = new Supplier({
        id: row.id,
        supplierCode: row.supplier_code,
        companyName: row.company_name,
        contactPerson: row.contact_person,
        email: row.email,
        phone: row.phone,
        qualityRating: row.quality_rating,
        deliveryRating: row.delivery_rating,
        priceCompetitiveness: row.price_competitiveness,
        leadTimeDays: row.lead_time_days,
        supplierType: row.supplier_type,
        isActive: row.is_active
      });

      const supplierProduct = {
        id: row.supplier_product_id,
        supplierId: row.supplier_id,
        productId: row.product_id,
        unitCost: parseFloat(row.unit_cost),
        minimumQuantity: parseFloat(row.minimum_quantity),
        leadTimeDays: row.lead_time_days,
        qualityGrade: row.quality_grade,
        isPreferred: row.is_preferred
      } as SupplierProduct;

      const reasons = [];
      if (row.is_preferred) reasons.push('Preferred supplier');
      if (row.quality_rating >= 4) reasons.push('High quality rating');
      if (row.delivery_rating >= 4) reasons.push('Reliable delivery');
      if (row.price_competitiveness >= 4) reasons.push('Competitive pricing');
      if (row.lead_time_days <= 3) reasons.push('Fast delivery');

      return {
        supplier,
        supplierProduct,
        score: parseFloat(row.overall_score),
        reasons
      };
    });
  }

  // Update supplier rating
  async updateRating(
    id: string, 
    ratingData: {
      qualityRating?: number;
      deliveryRating?: number;
      priceCompetitiveness?: number;
    }
  ): Promise<void> {
    const db = DatabaseConnection.getInstance();

    await db.query(`
      SELECT update_supplier_rating($1, $2, $3, $4)
    `, [
      id,
      ratingData.deliveryRating || null,
      ratingData.qualityRating || null,
      ratingData.priceCompetitiveness || null
    ]);

    logger.info('Supplier rating updated', {
      supplierId: id,
      ratings: ratingData
    });
  }

  // Get supplier performance stats
  async getPerformanceStats(
    supplierId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
    onTimeDeliveries: number;
    onTimeDeliveryRate: number;
    qualityIssues: number;
    averageLeadTime: number;
    lastOrderDate?: Date;
  }> {
    const db = DatabaseConnection.getInstance();

    let whereClause = 'WHERE po.supplier_id = $1 AND po.status = \'completed\'';
    const values = [supplierId];
    let paramCount = 2;

    if (dateFrom) {
      whereClause += ` AND po.order_date >= $${paramCount}`;
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      whereClause += ` AND po.order_date <= $${paramCount}`;
      values.push(dateTo);
      paramCount++;
    }

    const query = `
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(po.total_amount), 0) as total_value,
        COALESCE(AVG(po.total_amount), 0) as average_order_value,
        COUNT(*) FILTER (
          WHERE po.actual_delivery_date <= po.expected_delivery_date
        ) as on_time_deliveries,
        COUNT(*) FILTER (
          WHERE gr.quality_check_status = 'failed'
        ) as quality_issues,
        COALESCE(AVG(
          EXTRACT(DAYS FROM (po.actual_delivery_date - po.order_date))
        ), 0) as average_lead_time,
        MAX(po.order_date) as last_order_date
      FROM purchase_orders po
      LEFT JOIN goods_receipts gr ON po.id = gr.purchase_order_id
      ${whereClause}
    `;

    const result = await db.query(query, values);
    const stats = result.rows[0];

    const totalOrders = parseInt(stats.total_orders);
    const onTimeDeliveries = parseInt(stats.on_time_deliveries);

    return {
      totalOrders,
      totalValue: parseFloat(stats.total_value),
      averageOrderValue: parseFloat(stats.average_order_value),
      onTimeDeliveries,
      onTimeDeliveryRate: totalOrders > 0 ? (onTimeDeliveries / totalOrders) * 100 : 0,
      qualityIssues: parseInt(stats.quality_issues),
      averageLeadTime: parseFloat(stats.average_lead_time),
      lastOrderDate: stats.last_order_date ? new Date(stats.last_order_date) : undefined
    };
  }

  // Deactivate supplier
  async deactivate(id: string, reason?: string): Promise<Supplier> {
    const db = DatabaseConnection.getInstance();

    const query = `
      UPDATE suppliers 
      SET 
        is_active = false,
        notes = CASE 
          WHEN notes IS NULL THEN $2
          ELSE notes || '\n' || $2
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id, `Deactivated: ${reason || 'No reason provided'}`]);

    if (result.rows.length === 0) {
      throw new Error('Supplier not found');
    }

    return new Supplier(result.rows[0]);
  }

  // Generate supplier code
  private async generateSupplierCode(): Promise<string> {
    const db = DatabaseConnection.getInstance();

    const query = `
      SELECT supplier_code 
      FROM suppliers 
      WHERE supplier_code LIKE 'SUP%'
      ORDER BY supplier_code DESC 
      LIMIT 1
    `;

    const result = await db.query(query);

    if (result.rows.length === 0) {
      return 'SUP001';
    }

    const lastCode = result.rows[0].supplier_code;
    const lastNumber = parseInt(lastCode.replace('SUP', ''));
    const nextNumber = lastNumber + 1;

    return `SUP${nextNumber.toString().padStart(3, '0')}`;
  }

  // Helper method to convert camelCase to snake_case
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default Supplier;