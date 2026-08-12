import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, typography } from "../../lib/theme";
import { detailStyles } from "./styles";
import type {
  PublicTrainerGym,
  TrainerSpecializationItem,
} from "../../../features/trainer/trainerApiSlice";
import type { TrainerPackageItem } from "../../../features/trainer/trainerPackageApiSlice";

type Translate = (key: string) => string;

const Divider = () => <View style={detailStyles.divider} />;

export function SpecializationsSection({
  specializations,
  t,
}: {
  specializations: TrainerSpecializationItem[];
  t: Translate;
}) {
  if (specializations.length === 0) return null;
  return (
    <>
      <Text style={detailStyles.sectionTitle}>{t("specializations")}</Text>
      <View style={detailStyles.chipRow}>
        {specializations.map((spec) => (
          <View key={spec.id} style={detailStyles.chip}>
            <Text style={detailStyles.chipText}>{spec.name}</Text>
          </View>
        ))}
      </View>
      <Divider />
    </>
  );
}

export function AboutSection({ bio, t }: { bio: string; t: Translate }) {
  return (
    <>
      <Text style={detailStyles.sectionTitle}>{t("aboutMe")}</Text>
      <Text style={detailStyles.bodyText}>{bio}</Text>
      <Divider />
    </>
  );
}

export function RatesSection({
  priceLabel,
  t,
}: {
  priceLabel: string | null;
  t: Translate;
}) {
  // Experience moved into the identity subtitle, so with no price there is
  // nothing left to show.
  if (!priceLabel) return null;
  return (
    <>
      <Text style={detailStyles.sectionTitle}>{t("rates")}</Text>
      <View style={detailStyles.row}>
        <Text style={detailStyles.rowLabel}>{t("sessionRate")}</Text>
        <Text style={detailStyles.rowValue}>{priceLabel}</Text>
      </View>
      <Divider />
    </>
  );
}

export function PackagesSection({
  packages,
  t,
}: {
  packages: TrainerPackageItem[];
  t: Translate;
}) {
  if (packages.length === 0) return null;
  return (
    <>
      <Text style={detailStyles.sectionTitle}>{t("packages")}</Text>
      {packages.map((pkg, index) => (
        <View
          key={pkg.id}
          style={[styles.listRow, index === packages.length - 1 && styles.listRowLast]}
        >
          <View style={styles.listMeta}>
            <Text style={styles.listTitle}>{pkg.name}</Text>
            <Text style={styles.listSub}>
              {pkg.sessionCount} {t("sessions")}
            </Text>
          </View>
          <Text style={styles.price}>{Number(pkg.price).toFixed(2)} lei</Text>
        </View>
      ))}
      <Divider />
    </>
  );
}

export function GymsSection({
  gyms,
  locationText,
  t,
}: {
  gyms: PublicTrainerGym[];
  /** Falls back to the trainer's city when they have joined no gyms. */
  locationText: string;
  t: Translate;
}) {
  return (
    <>
      <Text style={detailStyles.sectionTitle}>{t("availableGyms")}</Text>
      {gyms.length > 0 ? (
        gyms.map((gym, index) => (
          <View
            key={gym.id}
            style={[styles.listRow, index === gyms.length - 1 && styles.listRowLast]}
          >
            <View style={styles.listMeta}>
              <Text style={styles.listTitle}>{gym.name}</Text>
              <Text style={styles.listSub}>
                {[gym.address, gym.city, gym.state].filter(Boolean).join(", ")}
              </Text>
            </View>
            <View style={styles.gymRating}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.gymRatingText}>{Number(gym.rating ?? 0).toFixed(1)}</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={detailStyles.bodyText}>
          {locationText || t("noAvailableGyms")}
        </Text>
      )}
      <Divider />
    </>
  );
}

const styles = StyleSheet.create({
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F6F9",
    gap: 12,
  },
  listRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  listMeta: { flex: 1 },
  listTitle: {
    ...typography.body2,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },
  listSub: {
    ...typography.caption,
    textTransform: "none",
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  price: {
    ...typography.body1,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  gymRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  gymRatingText: {
    ...typography.caption,
    color: theme.colors.text,
    fontWeight: "700",
  },
});
