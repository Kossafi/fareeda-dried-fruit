export enum BarcodeType {
  PRODUCT = 'product',
  INVENTORY_ITEM = 'inventory_item',
  REPACK_ORDER = 'repack_order',
  BATCH = 'batch',
  SHIPMENT = 'shipment',
  LOCATION = 'location',
}

export interface BarcodeData {
  id: string;
  type: BarcodeType;
  data: any;
  checksum: string;
  createdAt: Date;
}

export interface BarcodeScan {
  id: string;
  barcodeId: string;
  scannedBy: string;
  scanLocation?: string;
  scanDevice?: string;
  scanResult: 'success' | 'invalid' | 'expired';
  scanData?: any;
  createdAt: Date;
}

export interface BarcodeGenerationRequest {
  type: BarcodeType;
  entityId: string;
  branchId: string;
  additionalData?: any;
}

export interface BarcodePrintRequest {
  barcodeId: string;
  copies: number;
  printerName?: string;
  paperSize?: 'A4' | 'label_small' | 'label_medium' | 'label_large';
}

export interface BarcodeLabel {
  barcodeId: string;
  code128?: string;
  ean13?: string;
  qrCode?: string;
  displayText: string;
  productName?: string;
  batchNumber?: string;
  expirationDate?: Date;
  weight?: number;
  unit?: string;
  price?: number;
  branchName?: string;
}