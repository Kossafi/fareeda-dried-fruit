import { v4 as uuidv4 } from 'uuid';

export const generateUUID = (): string => {
  return uuidv4();
};

export const generateSKU = (category: string, index?: number): string => {
  const categoryCode = category.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  const indexStr = index ? index.toString().padStart(3, '0') : Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${categoryCode}-${timestamp}-${indexStr}`;
};

export const generateOrderNumber = (branchCode: string): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${branchCode}-${year}${month}${day}-${sequence}`;
};

export const generateBarcode = (): string => {
  let barcode = '';
  for (let i = 0; i < 12; i++) {
    barcode += Math.floor(Math.random() * 10).toString();
  }
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return barcode + checkDigit.toString();
};

export const generateCustomerCode = (): string => {
  const prefix = 'CUST';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

export const generateBranchCode = (name: string, index: number): string => {
  const nameCode = name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
  const indexStr = index.toString().padStart(3, '0');
  return `${nameCode}${indexStr}`;
};

export const generateTransactionNumber = (branchCode: string): string => {
  const timestamp = Date.now().toString();
  return `TXN-${branchCode}-${timestamp}`;
};

export const generateShipmentNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const sequence = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `SHP${year}${month}${day}${sequence}`;
};

export const generateTrackingNumber = (): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let tracking = '';
  
  for (let i = 0; i < 2; i++) {
    tracking += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  for (let i = 0; i < 9; i++) {
    tracking += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  tracking += letters.charAt(Math.floor(Math.random() * letters.length));
  tracking += letters.charAt(Math.floor(Math.random() * letters.length));
  
  return tracking;
};