export interface EstimateInputs {
  labelLength: number;
  labelWidth: number;
  gap: number;
  sideMargin: number;
  repeatLength: number; // default 508
  printingWidthLimit: number; // default 250
  jumboWidth: number; // default 1020
  orderQuantity: number;
  materialRate: number; // per sq meter
  printingRate: number; // per running meter
  uvRate: number; // per running meter
  machineCostPerHour: number;
  laborCostPerHour: number;
  machineSpeed: number; // m/min
  wastagePercent: number;
}

export const calculateFlexoLayout = (inputs: EstimateInputs) => {
  const {
    labelLength,
    labelWidth,
    gap,
    sideMargin,
    repeatLength,
    printingWidthLimit,
    jumboWidth,
    orderQuantity,
    materialRate,
    printingRate,
    uvRate,
    machineCostPerHour,
    laborCostPerHour,
    machineSpeed,
    wastagePercent
  } = inputs;

  // Layout Logic
  const labelAcross = Math.floor((printingWidthLimit - (2 * sideMargin)) / (labelWidth + gap));
  const effectiveAcross = labelAcross > 0 ? labelAcross : 1;
  const labelAround = Math.floor(repeatLength / (labelLength + gap));
  const effectiveAround = labelAround > 0 ? labelAround : 1;
  
  const labelsPerRepeat = effectiveAcross * effectiveAround;
  const totalRepeats = Math.ceil(orderQuantity / labelsPerRepeat);
  const runningMeter = (totalRepeats * repeatLength) / 1000;
  
  const printingWidth = (effectiveAcross * (labelWidth + gap)) + (2 * sideMargin);
  const materialConsumptionSqM = (runningMeter * printingWidth) / 1000;
  const wastageMaterialSqM = materialConsumptionSqM * (wastagePercent / 100);
  const totalMaterialRequiredSqM = materialConsumptionSqM + wastageMaterialSqM;

  const slittingSize = printingWidth;
  const rollsFromJumbo = Math.floor(jumboWidth / slittingSize);

  // Costing Logic
  const materialCost = totalMaterialRequiredSqM * materialRate;
  const printingCost = runningMeter * printingRate;
  const uvCost = runningMeter * uvRate;
  
  const machineRunningTimeHours = (runningMeter / machineSpeed) / 60;
  const machineCostTotal = machineRunningTimeHours * machineCostPerHour;
  const laborCostTotal = machineRunningTimeHours * laborCostPerHour;

  const totalCost = materialCost + printingCost + uvCost + machineCostTotal + laborCostTotal;
  const costPerLabel = totalCost / orderQuantity;
  
  const suggestedProfitMargin = 0.2; // 20%
  const sellingPricePerLabel = costPerLabel * (1 + suggestedProfitMargin);
  const totalSellingPrice = sellingPricePerLabel * orderQuantity;
  const profit = totalSellingPrice - totalCost;

  return {
    labelAcross: effectiveAcross,
    labelAround: effectiveAround,
    labelsPerRepeat,
    totalRepeats,
    runningMeter,
    materialConsumptionSqM,
    wastageMaterialSqM,
    totalMaterialRequiredSqM,
    slittingSize,
    rollsFromJumbo,
    materialCost,
    printingCost,
    uvCost,
    machineCostTotal,
    laborCostTotal,
    totalCost,
    costPerLabel,
    sellingPricePerLabel,
    totalSellingPrice,
    profit,
    profitPercent: (profit / totalSellingPrice) * 100
  };
};