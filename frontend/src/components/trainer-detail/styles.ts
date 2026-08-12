import { StyleSheet } from "react-native";
import { theme, typography } from "../../lib/theme";

/** Hero fills this share of the window; the sheet is pulled up over its bottom edge. */
export const HERO_HEIGHT_RATIO = 0.42;
export const SHEET_OVERLAP = 26;

/** Hairline between sheet sections — lighter than theme.colors.border, which is
 *  tuned for card outlines and reads too heavy as an inline rule. */
export const DIVIDER_COLOR = "#EEF2F6";

export const detailStyles = StyleSheet.create({
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    marginTop: -SHEET_OVERLAP,
    paddingHorizontal: 18,
    paddingTop: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER_COLOR,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.2,
    color: theme.colors.text,
    marginBottom: 12,
  },
  bodyText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowLabel: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  rowValue: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
});
