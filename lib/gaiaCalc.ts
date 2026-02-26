export type Profile = {
  householdName: string;
  region: "AU-NSW" | "AU-VIC" | "AU-QLD" | "AU-SA" | "AU-WA" | "AU-TAS" | "AU-ACT" | "AU-NT" | "Other";
  currency: "AUD" | "USD" | "EUR" | "GBP";
  tariffCentsPerKwh: number; // cents per kWh
  monthlyKwh: number;        // kWh per month
  co2KgPerKwh: number;       // kg CO2 per kWh
  peakShiftPct: number;      // % of usage you can shift off-peak (0-50)
  standbyWastePct: number;   // % wasted on standby (0-30)
};

export type Results = {
  monthlyCost: number;
  monthlyCo2Kg: number;
  yearlyCost: number;
  yearlyCo2Kg: number;
  wasteKwh: number;
  wasteCost: number;
  wasteCo2Kg: number;
  quickWins: Array<{
    title: string;
    impactLabel: string;
    description: string;
    priority: "High" | "Medium" | "Low";
  }>;
};

export function defaultProfile(): Profile {
  return {
    householdName: "My Home",
    region: "AU-NSW",
    currency: "AUD",
    tariffCentsPerKwh: 35,
    monthlyKwh: 450,
    co2KgPerKwh: 0.70,
    peakShiftPct: 12,
    standbyWastePct: 8,
  };
}

// Simple region presets (rough defaults; user can override)
export function co2PresetKgPerKwh(region: Profile["region"]): number {
  switch (region) {
    case "AU-TAS": return 0.15;
    case "AU-VIC": return 0.85;
    case "AU-NSW": return 0.70;
    case "AU-QLD": return 0.75;
    case "AU-SA":  return 0.45;
    case "AU-WA":  return 0.55;
    case "AU-ACT": return 0.25;
    case "AU-NT":  return 0.70;
    default:       return 0.60;
  }
}

export function currencySymbol(cur: Profile["currency"]) {
  if (cur === "AUD") return "A$";
  if (cur === "USD") return "$";
  if (cur === "EUR") return "€";
  if (cur === "GBP") return "£";
  return "$";
}

export function compute(p: Profile): Results {
  const pricePerKwh = p.tariffCentsPerKwh / 100; // currency units per kWh
  const monthlyCost = p.monthlyKwh * pricePerKwh;
  const monthlyCo2Kg = p.monthlyKwh * p.co2KgPerKwh;

  // “Waste” model: standby waste + peak inefficiency (treated as avoidable via behavior)
  const standbyWasteKwh = p.monthlyKwh * (clamp(p.standbyWastePct, 0, 30) / 100);
  const peakShiftKwh = p.monthlyKwh * (clamp(p.peakShiftPct, 0, 50) / 100);

  // We treat peak shifting as “recoverable efficiency” equivalent to reducing 20% of shifted kWh
  const peakEfficiencyGainKwh = peakShiftKwh * 0.20;

  const wasteKwh = standbyWasteKwh + peakEfficiencyGainKwh;
  const wasteCost = wasteKwh * pricePerKwh;
  const wasteCo2Kg = wasteKwh * p.co2KgPerKwh;

  const quickWins = buildQuickWins(p, { wasteKwh, wasteCost, wasteCo2Kg, peakShiftKwh, standbyWasteKwh });

  return {
    monthlyCost,
    monthlyCo2Kg,
    yearlyCost: monthlyCost * 12,
    yearlyCo2Kg: monthlyCo2Kg * 12,
    wasteKwh,
    wasteCost,
    wasteCo2Kg,
    quickWins,
  };
}

function buildQuickWins(
  p: Profile,
  ctx: { wasteKwh: number; wasteCost: number; wasteCo2Kg: number; peakShiftKwh: number; standbyWasteKwh: number }
): Results["quickWins"] {
  const sym = currencySymbol(p.currency);
  const pricePerKwh = p.tariffCentsPerKwh / 100;

  // Simple heuristic impact estimates
  const standbySavingsKwh = ctx.standbyWasteKwh * 0.75;
  const standbySavingsCost = standbySavingsKwh * pricePerKwh;

  const shiftSavingsKwh = ctx.peakShiftKwh * 0.20;
  const shiftSavingsCost = shiftSavingsKwh * pricePerKwh;

  const tempSavingsKwh = p.monthlyKwh * 0.06; // ~6% typical HVAC temp tweak benefit (rough)
  const tempSavingsCost = tempSavingsKwh * pricePerKwh;

  const hotWaterKwh = p.monthlyKwh * 0.08;
  const hotWaterSavingsKwh = hotWaterKwh * 0.30;
  const hotWaterSavingsCost = hotWaterSavingsKwh * pricePerKwh;

  const draft = [
    {
      title: "Kill Standby Waste",
      impactLabel: `~${round(standbySavingsKwh)} kWh/mo · ${sym}${roundMoney(standbySavingsCost)}/mo`,
      description:
        "Use a smart power board, turn off idle consoles/TV boxes, unplug chargers, and set router sleep schedules if possible.",
      priority: "High" as const,
      score: standbySavingsCost,
    },
    {
      title: "Shift Peak Loads",
      impactLabel: `~${round(shiftSavingsKwh)} kWh/mo · ${sym}${roundMoney(shiftSavingsCost)}/mo`,
      description:
        "Run laundry/dishwasher off-peak. If you charge devices/EVs, schedule them outside peak windows.",
      priority: "High" as const,
      score: shiftSavingsCost,
    },
    {
      title: "Tune Heating/Cooling",
      impactLabel: `~${round(tempSavingsKwh)} kWh/mo · ${sym}${roundMoney(tempSavingsCost)}/mo`,
      description:
        "Nudge thermostat 1–2°C, use fans first, seal drafts. Comfort stays; consumption drops.",
      priority: "Medium" as const,
      score: tempSavingsCost,
    },
    {
      title: "Hot Water Discipline",
      impactLabel: `~${round(hotWaterSavingsKwh)} kWh/mo · ${sym}${roundMoney(hotWaterSavingsCost)}/mo`,
      description:
        "Shorter showers, lower hot water setpoint (safely), cold-wash laundry where possible.",
      priority: "Medium" as const,
      score: hotWaterSavingsCost,
    },
    {
      title: "Measure One Week",
      impactLabel: "Highest ROI habit",
      description:
        "Track your top 3 loads for 7 days. Measurement kills guesswork and reveals the real savings levers.",
      priority: "Low" as const,
      score: 0.01,
    },
  ];

  return draft
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...rest }) => rest);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function round(n: number) {
  return Math.round(n);
}
function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}