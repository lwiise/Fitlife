"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { MemberPlan } from "@/lib/plans/schema";

// Tajawal Arabic font from Google's font mirror. .ttf is required by @react-pdf.
Font.register({
  family: "Tajawal",
  fonts: [
    {
      src: "https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Regular.ttf",
      fontWeight: 400,
    },
    {
      src: "https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Bold.ttf",
      fontWeight: 700,
    },
  ],
});

const PURPLE = "#4E2490";
const PINK = "#C5458F";
const INK = "#1A1023";
const INK_MUTED = "#666377";
const SURFACE = "#EBEFF2";

const UNIT_AR: Record<string, string> = {
  g: "جم",
  ml: "مل",
  cup: "كوب",
  tbsp: "ملعقة كبيرة",
  piece: "حبة",
};

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 36,
    fontFamily: "Tajawal",
    fontSize: 11,
    color: INK,
  },
  rtl: { direction: "rtl" },
  // Cover
  coverHeader: {
    paddingBottom: 24,
    borderBottom: `2pt solid ${PURPLE}`,
  },
  brand: { fontSize: 10, color: INK_MUTED, fontWeight: 700, letterSpacing: 0 },
  coverTitle: { fontSize: 28, fontWeight: 700, color: INK, marginTop: 8 },
  coverSubtitle: { fontSize: 12, color: INK_MUTED, marginTop: 8 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
  },
  statTile: {
    flex: 1,
    backgroundColor: SURFACE,
    padding: 12,
    borderRadius: 8,
  },
  statLabel: { fontSize: 9, color: INK_MUTED },
  statValue: { fontSize: 18, fontWeight: 700, color: INK, marginTop: 4 },
  statUnit: { fontSize: 9, color: INK_MUTED, marginTop: 2 },
  // Day pages
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 12,
    borderBottom: `1pt solid ${SURFACE}`,
    marginBottom: 16,
  },
  dayTitle: { fontSize: 20, fontWeight: 700, color: PURPLE },
  dayTotal: { fontSize: 10, color: INK_MUTED },
  meal: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: SURFACE,
    borderRadius: 8,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  mealSlot: { fontSize: 9, fontWeight: 700, color: PINK },
  mealName: { fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 },
  mealCals: { fontSize: 14, fontWeight: 700, color: INK },
  mealCalsLabel: { fontSize: 8, color: INK_MUTED },
  macros: { fontSize: 9, color: INK_MUTED, marginBottom: 6 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: INK,
    marginTop: 8,
    marginBottom: 4,
  },
  ingredient: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 10,
    marginBottom: 2,
  },
  step: { fontSize: 10, marginBottom: 3, color: INK, lineHeight: 1.5 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 16,
    start: 36,
    end: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: INK_MUTED,
    paddingTop: 8,
    borderTop: `0.5pt solid ${SURFACE}`,
  },
});

export interface MemberPlanPDFProps {
  memberPlan: MemberPlan;
  planMetadata: { week_start_date: string };
}

function Footer({ pageNum, total }: { pageNum: number; total: number }) {
  return (
    <View style={styles.footer} fixed>
      <Text>فت لايف — خطتك الغذائية الأسبوعية</Text>
      <Text>
        {pageNum} / {total}
      </Text>
    </View>
  );
}

export function MemberPlanPDF({ memberPlan, planMetadata }: MemberPlanPDFProps) {
  const totalPages = 1 + memberPlan.days.length;

  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={[styles.page, styles.rtl]}>
        <View style={styles.coverHeader}>
          <Text style={styles.brand}>فت لايف</Text>
          <Text style={styles.coverTitle}>{memberPlan.member_name_ar}</Text>
          <Text style={styles.coverSubtitle}>
            خطة غذائية أسبوعية — تبدأ {planMetadata.week_start_date}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>السعرات اليومية</Text>
            <Text style={styles.statValue}>{memberPlan.daily_calories_target}</Text>
            <Text style={styles.statUnit}>سعرة</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>بروتين</Text>
            <Text style={styles.statValue}>{memberPlan.macros_target.protein_g}</Text>
            <Text style={styles.statUnit}>جم</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>كارب</Text>
            <Text style={styles.statValue}>{memberPlan.macros_target.carbs_g}</Text>
            <Text style={styles.statUnit}>جم</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>دهون</Text>
            <Text style={styles.statValue}>{memberPlan.macros_target.fat_g}</Text>
            <Text style={styles.statUnit}>جم</Text>
          </View>
        </View>

        <Footer pageNum={1} total={totalPages} />
      </Page>

      {/* One page per day */}
      {memberPlan.days.map((day, dayIdx) => (
        <Page key={day.day_index} size="A4" style={[styles.page, styles.rtl]}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{day.day_name_ar}</Text>
            <Text style={styles.dayTotal}>
              {day.day_total.calories} سعرة · {day.day_total.protein_g} بروتين ·{" "}
              {day.day_total.carbs_g} كارب · {day.day_total.fat_g} دهون
            </Text>
          </View>

          {day.meals.map((meal, mealIdx) => (
            <View key={mealIdx} style={styles.meal} wrap={false}>
              <View style={styles.mealHeader}>
                <View>
                  <Text style={styles.mealSlot}>{meal.slot_name_ar}</Text>
                  <Text style={styles.mealName}>{meal.recipe_name_ar}</Text>
                </View>
                <View>
                  <Text style={styles.mealCals}>{meal.calories}</Text>
                  <Text style={styles.mealCalsLabel}>سعرة</Text>
                </View>
              </View>
              <Text style={styles.macros}>
                {meal.macros.protein_g} بروتين · {meal.macros.carbs_g} كارب ·{" "}
                {meal.macros.fat_g} دهون (جم)
              </Text>

              <Text style={styles.sectionLabel}>المكونات</Text>
              {meal.ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredient}>
                  <Text>{ing.name_ar}</Text>
                  <Text>
                    {ing.amount} {UNIT_AR[ing.unit] ?? ing.unit}
                  </Text>
                </View>
              ))}

              <Text style={styles.sectionLabel}>طريقة التحضير</Text>
              {meal.prep_steps_ar.map((step, i) => (
                <Text key={i} style={styles.step}>
                  {i + 1}. {step}
                </Text>
              ))}
            </View>
          ))}

          <Footer pageNum={dayIdx + 2} total={totalPages} />
        </Page>
      ))}
    </Document>
  );
}
