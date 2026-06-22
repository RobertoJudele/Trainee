import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../../features/auth/authSlice";
import { useDeleteProfileMutation } from "../../features/users/usersApiSlicet";
import { useRouter } from "expo-router";
import { theme, typography } from "../lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import EditableAvatar from "../components/EditableAvatar";
import { useProfilePictureUpload } from "../lib/useProfilePictureUpload";
import { useTour } from "../components/onboarding/TourContext";
import { clientTour } from "../components/onboarding/clientTour";
import { useLanguage } from "../lib/i18n/LanguageContext";
import ProfileMenuModal, { type ProfileMenuItem } from "../components/ProfileMenuModal";
import { useAccountActions } from "../hooks/useAccountActions";

export default function UserProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSelector(selectCurrentUser);
  const { t, language, setLanguage } = useLanguage();

  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteProfile, { isLoading: isDeleting }] = useDeleteProfileMutation();
  const { pickAndUpload, isUploading } = useProfilePictureUpload();
  const { startTour } = useTour();

  const { handleLogout, handleDeleteAccount, isDeletingAccount } = useAccountActions({
    deleteAccount: deleteProfile,
    isDeleting,
  });

  const dateLocale = language === "ro" ? "ro-RO" : "en-US";
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "U";
  const fullName = user ? `${user.firstName} ${user.lastName}` : "User";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(dateLocale, { month: "long", year: "numeric" })
    : null;

  const menuItems: ProfileMenuItem[] = useMemo(() => [
    {
      key: "lang", icon: "language-outline", label: t("language"),
      onPress: () => setLanguage(language === "en" ? "ro" : "en"),
      trailing: (
        <View style={styles.langBadge}>
          <Text style={styles.langBadgeText}>{language === "en" ? "EN" : "RO"}</Text>
        </View>
      ),
    },
    {
      key: "legal", icon: "document-text-outline", label: t("legalAndPolicies"),
      onPress: () => { setMenuVisible(false); router.push("/legal"); },
    },
    {
      key: "report", icon: "flag-outline", label: t("reportIssue"),
      onPress: () => { setMenuVisible(false); router.push({ pathname: "/report-issue", params: { targetType: "app" } }); },
    },
    {
      key: "tour", icon: "help-circle-outline", label: t("showTutorial"),
      onPress: () => { setMenuVisible(false); startTour(clientTour); },
    },
    {
      key: "logout", icon: "log-out-outline", label: t("logOut"),
      onPress: () => { setMenuVisible(false); void handleLogout(); },
    },
    {
      key: "delAccount", icon: "trash-outline",
      label: isDeletingAccount ? t("deleting") : t("deleteMyAccount"),
      onPress: () => { setMenuVisible(false); void handleDeleteAccount(); },
      destructive: true, disabled: isDeletingAccount, loading: isDeletingAccount,
    },
  ], [t, language, setLanguage, isDeletingAccount, handleLogout, handleDeleteAccount, startTour]);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.tertiary]}
          style={[styles.headerGradient, { paddingTop: Math.max(insets.top + 12, 48) }]}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>

          <Pressable
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("openProfileMenu")}
          >
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </Pressable>

          <View style={styles.avatarWrap}>
            <EditableAvatar
              imageUrl={user?.profileImageUrl}
              initials={initials}
              size={80}
              editable
              uploading={isUploading}
              onPress={pickAndUpload}
            />
          </View>

          <Text style={styles.name}>{fullName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{t("member")}</Text>
          </View>
        </LinearGradient>

        {/* Info Card */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>{t("email")}</Text>
              <Text style={styles.infoValue}>{user?.email ?? "—"}</Text>
            </View>
          </View>

          {user?.phone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={theme.colors.textSecondary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{t("phone")}</Text>
                <Text style={styles.infoValue}>{user.phone}</Text>
              </View>
            </View>
          ) : null}

          {memberSince ? (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{t("memberSince")}</Text>
                <Text style={styles.infoValue}>{memberSince}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ProfileMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={menuItems}
        dividerAfter={[0, 3]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  headerGradient: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 16,
    padding: 8,
    marginTop: 48,
  },
  menuButton: {
    position: "absolute",
    top: 0,
    right: 16,
    padding: 8,
    marginTop: 48,
  },
  avatarWrap: {
    marginTop: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  name: {
    ...typography.h2,
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  roleBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    margin: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    ...theme.shadows.small,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: "400",
  },
  langBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  langBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
