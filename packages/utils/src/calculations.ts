export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return (value / total) * 100;
};

export const calculateDiscount = (originalPrice: number, discountPercentage: number): number => {
  return originalPrice * (discountPercentage / 100);
};

export const calculateDiscountedPrice = (originalPrice: number, discountPercentage: number): number => {
  return originalPrice - calculateDiscount(originalPrice, discountPercentage);
};

export const calculateTax = (amount: number, taxRate: number): number => {
  return amount * (taxRate / 100);
};

export const calculateTotal = (subtotal: number, taxRate: number, discountAmount: number = 0): number => {
  const tax = calculateTax(subtotal - discountAmount, taxRate);
  return subtotal - discountAmount + tax;
};

export const convertUnits = (value: number, fromUnit: string, toUnit: string): number => {
  const conversions: Record<string, Record<string, number>> = {
    gram: {
      kilogram: 0.001,
      pound: 0.00220462,
    },
    kilogram: {
      gram: 1000,
      pound: 2.20462,
    },
    pound: {
      gram: 453.592,
      kilogram: 0.453592,
    },
  };

  if (fromUnit === toUnit) return value;
  
  const conversionFactor = conversions[fromUnit.toLowerCase()]?.[toUnit.toLowerCase()];
  if (!conversionFactor) {
    throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
  }

  return value * conversionFactor;
};

export const roundToDecimalPlaces = (value: number, decimalPlaces: number): number => {
  return Number(Math.round(Number(value + 'e' + decimalPlaces)) + 'e-' + decimalPlaces);
};