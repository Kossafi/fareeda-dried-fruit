// Product Types for Dried Fruit Business

import { AuditTrail, Unit } from './common';

export interface Product {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  category: ProductCategory;
  subcategory?: string;
  sku: string;
  barcode: string;
  
  // Unit Information
  baseUnit: string; // Primary unit (usually 'kg' for dried fruits)
  sellableUnits: string[]; // Units that can be sold (g, khit, kg, pack)
  
  // Pricing
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  
  // Physical Properties
  weight?: number; // Weight per unit if applicable
  dimensions?: ProductDimensions;
  
  // Business Properties
  isActive: boolean;
  isComposite: boolean; // For repack/mixed products
  components?: ProductComponent[]; // For composite products
  
  // Inventory Settings
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  reorderQuantity: number;
  
  // Images and Media
  images: string[];
  thumbnail?: string;
  
  // Supplier Information
  supplierId?: string;
  supplierProductCode?: string;
  
  // Metadata
  tags: string[];
  notes?: string;
  
  // Audit
  ...AuditTrail;
}

export enum ProductCategory {
  DRIED_FRUIT = 'DRIED_FRUIT',
  NUTS = 'NUTS',
  MIXED = 'MIXED',
  GIFT_BASKET = 'GIFT_BASKET',
  PACKAGING = 'PACKAGING',
  CONSUMABLES = 'CONSUMABLES'
}

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
  unit: string; // cm, mm, etc.
}

export interface ProductComponent {
  productId: string;
  quantity: number;
  unit: string;
  cost?: number;
}

// For repack/composite products
export interface RepackFormula {
  id: string;
  name: string;
  description?: string;
  components: ProductComponent[];
  outputQuantity: number;
  outputUnit: string;
  laborCost?: number;
  packagingCost?: number;
  isActive: boolean;
}

// Product Variants (for different pack sizes)
export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  quantity: number;
  unit: string;
  price: number;
  isActive: boolean;
}

// Stock Level Information
export interface StockLevel {
  productId: string;
  locationId: string; // warehouse or branch
  quantity: number;
  unit: string;
  reservedQuantity: number;
  availableQuantity: number;
  lastUpdated: Date;
  lastCountDate?: Date;
}

// Stock Transaction
export interface StockTransaction {
  id: string;
  productId: string;
  locationId: string;
  type: StockTransactionType;
  quantity: number;
  unit: string;
  reference?: string; // Order ID, Transfer ID, etc.
  reason?: string;
  userId: string;
  timestamp: Date;
  notes?: string;
}

export enum StockTransactionType {
  IN = 'IN',           // Stock received
  OUT = 'OUT',         // Stock sold/used
  TRANSFER = 'TRANSFER', // Stock transferred
  ADJUSTMENT = 'ADJUSTMENT', // Manual adjustment
  SAMPLING = 'SAMPLING',     // Used for sampling
  REPACK = 'REPACK',         // Used in repack process
  DAMAGE = 'DAMAGE',         // Damaged goods
  EXPIRED = 'EXPIRED'        // Expired goods
}

// Product Search and Filtering
export interface ProductFilter {
  category?: ProductCategory;
  subcategory?: string;
  isActive?: boolean;
  isComposite?: boolean;
  supplierId?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  search?: string; // Search in name, description, sku
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  filters: {
    categories: { category: ProductCategory; count: number }[];
    suppliers: { id: string; name: string; count: number }[];
    priceRange: { min: number; max: number };
  };
}