export const DASHBOARD_CONFIG = {
  nominalVoltage: Number(import.meta.env.VITE_NOMINAL_VOLTAGE) || 230,
  maxApparentPowerKW: Number(import.meta.env.VITE_MAX_APPARENT_POWER_KW) || 15, // kVA
  staleDataToleranceMs: Number(import.meta.env.VITE_STALE_DATA_MS) || 120_000,
  sparklinePoints: Number(import.meta.env.VITE_SPARKLINE_POINTS) || 30,
  thresholds: {
    voltage: {
      warningLow: Number(import.meta.env.VITE_VOLTAGE_WARNING_LOW) || 190,
      criticalLow: Number(import.meta.env.VITE_VOLTAGE_CRITICAL_LOW) || 190,
      warningHigh: Number(import.meta.env.VITE_VOLTAGE_WARNING_HIGH) || 290,
      criticalHigh: Number(import.meta.env.VITE_VOLTAGE_CRITICAL_HIGH) || 460,
    },
    frequency: {
      warningMin: Number(import.meta.env.VITE_FREQ_WARNING_MIN) || 48.5,
      warningMax: Number(import.meta.env.VITE_FREQ_WARNING_MAX) || 55.5,
      criticalMin: Number(import.meta.env.VITE_FREQ_CRITICAL_MIN) || 47.5,
      criticalMax: Number(import.meta.env.VITE_FREQ_CRITICAL_MAX) || 55.5,
    },
    powerFactor: {
      warning: Number(import.meta.env.VITE_PF_WARNING) || 0.85,
      critical: Number(import.meta.env.VITE_PF_CRITICAL) || 0.75,
    },
    load: {
      warning: Number(import.meta.env.VITE_LOAD_WARNING) || 80,
      critical: Number(import.meta.env.VITE_LOAD_CRITICAL) || 95,
    },
  },
}
