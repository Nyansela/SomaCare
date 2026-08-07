/**
 * Vital abnormality detection utilities
 * Checks vital readings against standard clinical ranges
 */

export interface VitalReading {
  kind: string;
  value: number;
  unit: string | null;
  taken_at: string;
}

export interface VitalAbnormality {
  kind: string;
  value: number;
  status: "high" | "low" | "normal";
  message: string;
  severity: "warning" | "critical";
}

/**
 * Normal vital ranges (adults)
 */
const VITAL_RANGES: Record<string, { low: number; high: number; unit: string }> = {
  bp_sys: { low: 90, high: 140, unit: "mmHg" },      // Systolic blood pressure
  bp_dia: { low: 60, high: 90, unit: "mmHg" },       // Diastolic blood pressure
  heart_rate: { low: 60, high: 100, unit: "bpm" },    // Resting heart rate
  spo2: { low: 95, high: 100, unit: "%" },            // Blood oxygen
  glucose: { low: 70, high: 126, unit: "mg/dL" },      // Fasting blood glucose (mg/dL)
  temperature: { low: 36.1, high: 37.2, unit: "°C" },  // Body temperature
  // Weight has no fixed range - skip
};

/**
 * Detect abnormalities from a list of vital readings
 * Only checks the most recent reading per kind
 */
export function detectVitalAbnormalities(vitals: VitalReading[]): VitalAbnormality[] {
  const abnormalities: VitalAbnormality[] = [];
  
  // Get latest reading per kind
  const latestByKind = new Map<string, VitalReading>();
  vitals.forEach((v) => {
    if (!latestByKind.has(v.kind)) {
      latestByKind.set(v.kind, v);
    }
  });
  
  // Check each kind against normal ranges
  latestByKind.forEach((reading, kind) => {
    const range = VITAL_RANGES[kind.toLowerCase()];
    if (!range) return; // Skip unknown kinds or weight
    
    const value = reading.value;
    
    if (value > range.high) {
      const severity = (kind === "bp_sys" && value > 180) || 
                      (kind === "bp_dia" && value > 120) || 
                      (kind === "heart_rate" && value > 120) ||
                      (kind === "spo2" && value < 90) ||
                      (kind === "glucose" && value > 200)
        ? "critical" 
        : "warning";
      
      abnormalities.push({
        kind: reading.kind,
        value: reading.value,
        status: "high",
        message: `${reading.kind} is ${value - range.high} ${range.unit} above normal (normal: ${range.low}-${range.high} ${range.unit})`,
        severity,
      });
    } else if (value < range.low) {
      const severity = (kind === "spo2" && value < 88) ||
                      (kind === "glucose" && value < 50) ||
                      (kind === "temperature" && value < 35)
        ? "critical"
        : "warning";
      
      abnormalities.push({
        kind: reading.kind,
        value: reading.value,
        status: "low",
        message: `${reading.kind} is ${range.low - value} ${range.unit} below normal (normal: ${range.low}-${range.high} ${range.unit})`,
        severity,
      });
    }
  });
  
  return abnormalities;
}

/**
 * Get human-readable label for vital kind
 */
export function getVitalLabel(kind: string): string {
  const labels: Record<string, string> = {
    bp_sys: "Blood Pressure (Systolic)",
    bp_dia: "Blood Pressure (Diastolic)",
    heart_rate: "Heart Rate",
    spo2: "Blood Oxygen (SpO₂)",
    glucose: "Blood Glucose",
    temperature: "Temperature",
    weight: "Weight",
  };
  return labels[kind] || kind;
}

/**
 * Get color for vital status
 */
export function getVitalStatusColor(status: "high" | "low" | "normal"): string {
  if (status === "high") return "text-destructive";
  if (status === "low") return "text-[var(--info)]";
  return "text-[var(--success)]";
}

/**
 * Get background color for vital status
 */
export function getVitalStatusBg(status: "high" | "low" | "normal"): string {
  if (status === "high") return "bg-[var(--danger-soft)] border-[var(--destructive)]/30";
  if (status === "low") return "bg-[var(--info)]/10 border-[var(--info)]/30";
  return "bg-[var(--success-soft)] border-[var(--success)]/30";
}
