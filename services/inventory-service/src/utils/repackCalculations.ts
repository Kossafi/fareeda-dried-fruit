import { RepackSourceItem, UnitType } from '@dried-fruits/types';
import { convertUnits } from '@dried-fruits/utils';

export interface RepackCalculationResult {
  totalSourceWeight: number;
  totalSourceCost: number;
  averageCostPerUnit: number;
  expectedYield: number;
  efficiency: number;
  costPerTargetUnit: number;
  profitMargin?: number;
  recommendations: string[];
}

export class RepackCalculator {
  /**
   * Calculate comprehensive repack metrics
   */
  static calculateRepackMetrics(
    sourceItems: Array<RepackSourceItem & { cost: number; actualQuantity?: number }>,
    targetQuantity: number,
    targetUnit: UnitType,
    targetSellingPrice?: number
  ): RepackCalculationResult {
    let totalSourceWeight = 0;
    let totalSourceCost = 0;
    const recommendations: string[] = [];

    // Calculate totals from source items
    for (const item of sourceItems) {
      const quantity = item.actualQuantity ?? item.requiredQuantity;
      
      // Convert to common unit (grams) for calculation
      const weightInGrams = this.convertToGrams(quantity, item.unit);
      totalSourceWeight += weightInGrams;
      totalSourceCost += quantity * item.cost;
    }

    // Convert target quantity to grams
    const targetWeightInGrams = this.convertToGrams(targetQuantity, targetUnit);

    // Calculate metrics
    const expectedYield = (targetWeightInGrams / totalSourceWeight) * 100;
    const efficiency = expectedYield > 100 ? 100 : expectedYield; // Cap at 100%
    const averageCostPerUnit = totalSourceCost / totalSourceWeight;
    const costPerTargetUnit = totalSourceCost / targetQuantity;

    // Generate recommendations
    if (efficiency < 80) {
      recommendations.push('Low efficiency detected. Consider reviewing source item quantities or repack process.');
    }

    if (efficiency > 95) {
      recommendations.push('Excellent efficiency! This repack configuration is optimal.');
    }

    if (totalSourceCost / targetQuantity > averageCostPerUnit * 1.2) {
      recommendations.push('High cost per target unit. Consider using lower-cost source items.');
    }

    // Calculate profit margin if selling price is provided
    let profitMargin: number | undefined;
    if (targetSellingPrice) {
      profitMargin = ((targetSellingPrice - costPerTargetUnit) / targetSellingPrice) * 100;
      
      if (profitMargin < 20) {
        recommendations.push('Low profit margin. Consider increasing selling price or reducing costs.');
      } else if (profitMargin > 50) {
        recommendations.push('High profit margin. Consider competitive pricing strategy.');
      }
    }

    return {
      totalSourceWeight,
      totalSourceCost,
      averageCostPerUnit,
      expectedYield,
      efficiency,
      costPerTargetUnit,
      profitMargin,
      recommendations,
    };
  }

  /**
   * Calculate optimal source item quantities for target yield
   */
  static calculateOptimalSourceQuantities(
    sourceItems: Array<{ 
      inventoryItemId: string; 
      availableStock: number; 
      unit: UnitType; 
      cost: number;
      nutritionalWeight?: number; // For nutritional balance
    }>,
    targetQuantity: number,
    targetUnit: UnitType,
    constraints?: {
      maxCostPerUnit?: number;
      nutritionalBalance?: boolean;
      prioritizeAvailability?: boolean;
    }
  ): Array<{ inventoryItemId: string; optimalQuantity: number; unit: UnitType; costContribution: number }> {
    const targetWeightInGrams = this.convertToGrams(targetQuantity, targetUnit);
    const results: Array<{ 
      inventoryItemId: string; 
      optimalQuantity: number; 
      unit: UnitType; 
      costContribution: number;
    }> = [];

    if (sourceItems.length === 0) {
      return results;
    }

    // Sort by cost efficiency (cost per gram) if cost constraint exists
    let sortedItems = [...sourceItems];
    if (constraints?.maxCostPerUnit) {
      sortedItems.sort((a, b) => a.cost - b.cost);
    }

    // Simple proportional allocation (can be enhanced with optimization algorithms)
    const totalWeight = sourceItems.reduce((sum, item) => {
      const weight = this.convertToGrams(item.availableStock, item.unit);
      return sum + weight;
    }, 0);

    let remainingTargetWeight = targetWeightInGrams;

    for (const item of sortedItems) {
      if (remainingTargetWeight <= 0) break;

      const itemWeightInGrams = this.convertToGrams(item.availableStock, item.unit);
      const proportion = itemWeightInGrams / totalWeight;
      
      // Calculate allocation (not exceeding available stock)
      const allocatedWeight = Math.min(
        remainingTargetWeight * proportion,
        itemWeightInGrams
      );

      const allocatedQuantity = this.convertFromGrams(allocatedWeight, item.unit);
      
      if (allocatedQuantity > 0) {
        results.push({
          inventoryItemId: item.inventoryItemId,
          optimalQuantity: Number(allocatedQuantity.toFixed(3)),
          unit: item.unit,
          costContribution: allocatedQuantity * item.cost,
        });

        remainingTargetWeight -= allocatedWeight;
      }
    }

    return results;
  }

  /**
   * Validate repack feasibility with detailed analysis
   */
  static validateRepackFeasibility(
    sourceItems: Array<{ 
      availableStock: number; 
      requiredQuantity: number; 
      unit: UnitType;
      expirationDate?: Date;
    }>,
    targetQuantity: number,
    targetUnit: UnitType
  ): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check stock availability
    let hasStockIssues = false;
    for (const item of sourceItems) {
      if (item.availableStock < item.requiredQuantity) {
        issues.push(`Insufficient stock: available ${item.availableStock}, required ${item.requiredQuantity}`);
        hasStockIssues = true;
      }
    }

    // Check expiration dates
    const now = new Date();
    const nearExpiryThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    for (const item of sourceItems) {
      if (item.expirationDate && item.expirationDate <= nearExpiryThreshold) {
        const daysUntilExpiry = Math.ceil((item.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 0) {
          issues.push('Some source items have expired');
          riskLevel = 'high';
        } else if (daysUntilExpiry <= 3) {
          suggestions.push('Some source items expire within 3 days - prioritize this repack');
          riskLevel = riskLevel === 'high' ? 'high' : 'medium';
        }
      }
    }

    // Calculate total yield
    const totalSourceWeight = sourceItems.reduce((sum, item) => {
      return sum + this.convertToGrams(item.requiredQuantity, item.unit);
    }, 0);
    
    const targetWeightInGrams = this.convertToGrams(targetQuantity, targetUnit);
    const expectedYield = (targetWeightInGrams / totalSourceWeight) * 100;

    if (expectedYield > 100) {
      issues.push('Target quantity exceeds total source quantity - impossible yield');
      riskLevel = 'high';
    } else if (expectedYield < 70) {
      suggestions.push('Low yield efficiency - consider adjusting quantities');
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    }

    // Overall risk assessment
    if (hasStockIssues) {
      riskLevel = 'high';
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      riskLevel,
    };
  }

  /**
   * Calculate repack batch sizes for production planning
   */
  static calculateOptimalBatchSizes(
    targetDemand: number,
    sourceAvailability: Array<{ quantity: number; unit: UnitType }>,
    productionCapacity: {
      maxBatchSize: number;
      processingTimeMinutes: number;
      setupTimeMinutes: number;
    }
  ): {
    recommendedBatchSize: number;
    numberOfBatches: number;
    totalProcessingTime: number;
    utilizationRate: number;
  } {
    // Find limiting factor
    const totalSourceAvailable = sourceAvailability.reduce((sum, source) => {
      return sum + this.convertToGrams(source.quantity, source.unit);
    }, 0);

    const maxPossibleProduction = Math.min(targetDemand, totalSourceAvailable);
    const batchSize = Math.min(maxPossibleProduction, productionCapacity.maxBatchSize);
    const numberOfBatches = Math.ceil(maxPossibleProduction / batchSize);
    
    const totalProcessingTime = numberOfBatches * (productionCapacity.processingTimeMinutes + productionCapacity.setupTimeMinutes);
    const utilizationRate = (maxPossibleProduction / (numberOfBatches * productionCapacity.maxBatchSize)) * 100;

    return {
      recommendedBatchSize: batchSize,
      numberOfBatches,
      totalProcessingTime,
      utilizationRate,
    };
  }

  private static convertToGrams(quantity: number, unit: UnitType): number {
    switch (unit) {
      case UnitType.GRAM:
        return quantity;
      case UnitType.KILOGRAM:
        return quantity * 1000;
      case UnitType.PIECE:
        return quantity * 50; // Assume 50g per piece (configurable)
      case UnitType.BOX:
        return quantity * 500; // Assume 500g per box (configurable)
      case UnitType.PACKAGE:
        return quantity * 250; // Assume 250g per package (configurable)
      default:
        return quantity;
    }
  }

  private static convertFromGrams(grams: number, targetUnit: UnitType): number {
    switch (targetUnit) {
      case UnitType.GRAM:
        return grams;
      case UnitType.KILOGRAM:
        return grams / 1000;
      case UnitType.PIECE:
        return grams / 50; // Assume 50g per piece
      case UnitType.BOX:
        return grams / 500; // Assume 500g per box
      case UnitType.PACKAGE:
        return grams / 250; // Assume 250g per package
      default:
        return grams;
    }
  }
}