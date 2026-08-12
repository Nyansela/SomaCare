"use client";

import { Document, Page, Text, View, StyleSheet, Font, Image, Link } from "@react-pdf/renderer";
import { format } from "date-fns";

// Use built-in standard PDF fonts (Helvetica / Helvetica-Bold) for 100% reliability
// without network dependencies or 404 fetch errors.

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottom: "1px solid #e0e0e0",
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: "#2d5a3d", // SomaCare green
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 5,
    color: "#2d5a3d",
    borderBottom: "1px solid #e0e0e0",
    paddingBottom: 3,
  },
  sectionContent: {
    marginBottom: 8,
  },
  table: {
    display: "flex",
    width: "auto",
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableColHeader: {
    width: "25%",
    padding: 5,
    backgroundColor: "#f3f4f6",
    fontWeight: 600,
    border: "1px solid #e0e0e0",
  },
  tableCol: {
    width: "25%",
    padding: 5,
    border: "1px solid #e0e0e0",
  },
  tableCell: {
    padding: 5,
  },
  noData: {
    fontSize: 9,
    color: "#6b7280",
  },
  footer: {
    marginTop: 20,
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
  timestamp: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 10,
  },
  logo: {
    width: 60,
    height: 20,
    objectFit: "contain",
  },
});

// Helper to format missing data — returns a discriminated union so callers
// can safely inspect `_missing` without widening to `unknown`.
type MissingDataResult<T> = { _missing: true; label: string } | { _missing: false };

function formatMissingData<T>(data: T, label: string): MissingDataResult<T> {
  const hasData =
    data != null &&
    (Array.isArray(data)
      ? data.length > 0
      : typeof data === "object"
        ? Object.keys(data).length > 0
        : true);
  return hasData ? { _missing: false } : { _missing: true, label };
}

// PDF Component
interface HealthReportPDFProps {
  profile: {
    name?: string;
    age?: number;
    gender?: string;
    bloodType?: string;
    height?: number;
    weight?: number;
    bmi?: number;
  };
  allergies: Array<{
    name: string;
    severity: string;
  }>;
  chronicConditions: Array<{
    name: string;
    diagnosed?: string;
  }>;
  medicalHistoryEvents: Array<{
    type: string;
    name: string;
    date?: string;
    notes?: string;
  }>;
  medications: Array<{
    name: string;
    dose?: string;
    frequency?: string;
  }>;
  vitals: Array<{
    date: string;
    bloodPressure?: { systolic: number; diastolic: number };
    heartRate?: number;
    glucose?: number;
    weight?: number;
    oxygenSaturation?: number;
    temperature?: number;
    abnormal?: boolean;
  }>;
  activitySummary: {
    sleep?: { averageHours: number; nightsLogged: number };
    hydration?: { averageIntake: number; daysLogged: number };
    fitness?: { totalWorkouts: number; totalMinutes: number };
  };
}

export const HealthReportPDF = ({
  profile,
  allergies,
  chronicConditions,
  medicalHistoryEvents,
  medications,
  vitals,
  activitySummary,
}: HealthReportPDFProps) => {
  const timestamp = new Date();
  const recentVitals = vitals.slice(0, 7); // Last 7 days

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>SomaCare Health Report</Text>
            <Text style={styles.subtitle}>Comprehensive Health Summary</Text>
          </View>
          <View>
            <Image style={styles.logo} src="/images/branding/logo.svg" />
          </View>
        </View>

        {/* Timestamp */}
        <Text style={styles.timestamp}>
          Generated on {format(timestamp, "MMMM d, yyyy h:mm a")}
        </Text>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Summary</Text>
          <View style={styles.sectionContent}>
            <Text>Name: {profile.name || "Not specified"}</Text>
            <Text>Age: {profile.age ? `${profile.age} years` : "Not specified"}</Text>
            <Text>Gender: {profile.gender || "Not specified"}</Text>
            <Text>Blood Type: {profile.bloodType || "Not specified"}</Text>
            <Text>Height: {profile.height ? `${profile.height} cm` : "Not specified"}</Text>
            <Text>Weight: {profile.weight ? `${profile.weight} kg` : "Not specified"}</Text>
            <Text>BMI: {profile.bmi ? profile.bmi.toFixed(1) : "Not specified"}</Text>
          </View>
        </View>

        {/* Allergies Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergies</Text>
          <View style={styles.sectionContent}>
            {formatMissingData(allergies, "No allergies logged")._missing ? (
              <Text style={styles.noData}>No allergies logged</Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.tableColHeader}>Allergen</Text>
                  <Text style={styles.tableColHeader}>Severity</Text>
                </View>
                {allergies.map((allergy, index) => (
                  <View style={styles.tableRow} key={index}>
                    <Text style={styles.tableCol}>{allergy.name}</Text>
                    <Text style={styles.tableCol}>{allergy.severity}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Chronic Conditions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chronic Conditions</Text>
          <View style={styles.sectionContent}>
            {formatMissingData(chronicConditions, "No chronic conditions logged")._missing ? (
              <Text style={styles.noData}>No chronic conditions logged</Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.tableColHeader}>Condition</Text>
                  <Text style={styles.tableColHeader}>Diagnosed</Text>
                </View>
                {chronicConditions.map((condition, index) => (
                  <View style={styles.tableRow} key={index}>
                    <Text style={styles.tableCol}>{condition.name}</Text>
                    <Text style={styles.tableCol}>{condition.diagnosed || "Not specified"}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Medical History Events Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical History Events</Text>
          <View style={styles.sectionContent}>
            {formatMissingData(medicalHistoryEvents, "No medical history events logged")
              ._missing ? (
              <Text style={styles.noData}>No medical history events logged</Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.tableColHeader}>Type</Text>
                  <Text style={styles.tableColHeader}>Event</Text>
                  <Text style={styles.tableColHeader}>Date</Text>
                  <Text style={styles.tableColHeader}>Notes</Text>
                </View>
                {medicalHistoryEvents.map((event, index) => (
                  <View style={styles.tableRow} key={index}>
                    <Text style={styles.tableCol}>{event.type}</Text>
                    <Text style={styles.tableCol}>{event.name}</Text>
                    <Text style={styles.tableCol}>{event.date || "Not specified"}</Text>
                    <Text style={styles.tableCol}>{event.notes || "None"}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Medications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Medications</Text>
          <View style={styles.sectionContent}>
            {formatMissingData(medications, "No medications logged")._missing ? (
              <Text style={styles.noData}>No medications logged</Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.tableColHeader}>Medication</Text>
                  <Text style={styles.tableColHeader}>Dosage</Text>
                  <Text style={styles.tableColHeader}>Frequency</Text>
                </View>
                {medications.map((med, index) => (
                  <View style={styles.tableRow} key={index}>
                    <Text style={styles.tableCol}>{med.name}</Text>
                    <Text style={styles.tableCol}>{med.dose || "Not specified"}</Text>
                    <Text style={styles.tableCol}>{med.frequency || "Not specified"}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Recent Vitals Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Vitals (Last 7 Days)</Text>
          <View style={styles.sectionContent}>
            {formatMissingData(recentVitals, "No recent vitals logged")._missing ? (
              <Text style={styles.noData}>No recent vitals logged</Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <Text style={styles.tableColHeader}>Date</Text>
                  <Text style={styles.tableColHeader}>Blood Pressure</Text>
                  <Text style={styles.tableColHeader}>Heart Rate</Text>
                  <Text style={styles.tableColHeader}>Glucose</Text>
                  <Text style={styles.tableColHeader}>Weight (kg)</Text>
                  <Text style={styles.tableColHeader}>Abnormal</Text>
                </View>
                {recentVitals.map((vital, index) => (
                  <View style={styles.tableRow} key={index}>
                    <Text style={styles.tableCol}>{format(new Date(vital.date), "MMM d")}</Text>
                    <Text style={styles.tableCol}>
                      {vital.bloodPressure
                        ? `${vital.bloodPressure.systolic}/${vital.bloodPressure.diastolic}`
                        : "—"}
                    </Text>
                    <Text style={styles.tableCol}>{vital.heartRate || "—"}</Text>
                    <Text style={styles.tableCol}>{vital.glucose || "—"}</Text>
                    <Text style={styles.tableCol}>{vital.weight || "—"}</Text>
                    <Text style={styles.tableCol}>{vital.abnormal ? "Yes" : "No"}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Activity Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity Summary (Last 1-2 Weeks)</Text>
          <View style={styles.sectionContent}>
            <Text>
              Sleep:{" "}
              {activitySummary.sleep?.nightsLogged
                ? `
              Average: ${activitySummary.sleep.averageHours.toFixed(1)} hours/night, 
              Nights logged: ${activitySummary.sleep.nightsLogged}
            `
                : "No sleep data logged"}
            </Text>
            <Text>
              Hydration:{" "}
              {activitySummary.hydration?.daysLogged
                ? `
              Average intake: ${activitySummary.hydration.averageIntake} mL/day, 
              Days logged: ${activitySummary.hydration.daysLogged}
            `
                : "No hydration data logged"}
            </Text>
            <Text>
              Fitness:{" "}
              {activitySummary.fitness?.totalWorkouts
                ? `
              Total workouts: ${activitySummary.fitness.totalWorkouts}, 
              Total minutes: ${activitySummary.fitness.totalMinutes}
            `
                : "No fitness data logged"}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generated by SomaCare — Not a substitute for professional medical advice. | For
            emergencies, contact your local emergency services.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
