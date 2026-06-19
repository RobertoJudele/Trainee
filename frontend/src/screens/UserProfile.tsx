import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { selectCurrentUser, logOut } from "../../features/auth/authSlice";
import { useDeleteProfileMutation } from "../../features/users/usersApiSlicet";
import { useRouter } from "expo-router";
import { apiSlice } from "../api/apiSlice";
import { theme, typography } from "../lib/theme";
import { Ionicons } from "@expo/vector-icons";
import Purchases from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import EditableAvatar from "../components/EditableAvatar";
import { useProfilePictureUpload } from "../lib/useProfilePictureUpload";
import { useTour } from "../components/onboarding/TourContext";
import { clientTour } from "../components/onboarding/clientTour";
import { useLanguage } from "../lib/i18n/LanguageContext";

export default function UserProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const { t, language, setLanguage } = useLanguage();

  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteProfile, { isLoading: isDeleting }] = useDeleteProfileMutation();
  const { pickAndUpload, isUploading } = useProfilePictureUpload();
  const { startTour } = useTour();

  const handleLogout = useCallback(async () => {
    dispatch(logOut());
    dispatch(apiSlice.util.resetApiState());
    try {
      if (Platform.OS === "ios" || Platform.OS === "android") {
        await Purchases.logOut();
      }
    } catch {
      // RevenueCat logout is best-effort
    }
    router.replace("/(auth)/Welcome");
  }, [dispatch, router]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t("deleteAccountTitle"),
      t("deleteAccountMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("delete"), style: "destructive", onPress: performDeleteAccount },
      ]
    );
  }, [t]);

  const performDeleteAccount = useCallback(async () => {
    try {
      await deleteProfile().unwrap();
      dispatch(logOut());
      dispatch(apiSlice.util.resetApiState());
      try {
        if (Platform.OS === "ios" || Platform.OS === "android") {
          await Purchases.logOut();
        }
      } catch {
        // best-effort
      }
      router.replace("/(auth)/Welcome");
    } catch {
      Alert.alert(t("error"), t("deleteAccountError"));
    }
  }, [deleteProfile, dispatch, router, t]);

  const dateLocale = language === "ro" ? "ro-RO" : "en-US";
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "U";
  const fullName = user ? `${user.firstName} ${user.lastName}` : "User";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(dateLocale, { month: "long", year: "numeric" })
    : null;

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

      {/* Dropdown Menu */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            {/* Language toggle */}
            <Pressable
              style={styles.dropdownItem}
              onPress={() => {
                setLanguage(language === "en" ? "ro" : "en");
              }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("language")}
            >
              <Ionicons name="language-outline" size={18} color={theme.colors.text} />
              <Text style={styles.dropdownItemText}>{t("language")}</Text>
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>
                  {language === "en" ? "EN" : "RO"}
                </Text>
              </View>
            </Pressable>

            <View style={styles.dropdownDivider} />

            <Pressable
              style={styles.dropdownItem}
              onPress={() => { setMenuVisible(false); router.push("/legal"); }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("legalAndPolicies")}
            >
              <Ionicons name="document-text-outline" size={18} color={theme.colors.text} />
              <Text style={styles.dropdownItemText}>{t("legalAndPolicies")}</Text>
            </Pressable>

            <Pressable
              style={styles.dropdownItem}
              onPress={() => { setMenuVisible(false); router.push({ pathname: "/report-issue", params: { targetType: "app" } }); }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("reportIssue")}
            >
              <Ionicons name="flag-outline" size={18} color={theme.colors.text} />
              <Text style={styles.dropdownItemText}>{t("reportIssue")}</Text>
            </Pressable>

            <Pressable
              style={styles.dropdownItem}
              onPress={() => { setMenuVisible(false); startTour(clientTour); }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("showTutorial")}
            >
              <Ionicons name="help-circle-outline" size={18} color={theme.colors.text} />
              <Text style={styles.dropdownItemText}>{t("showTutorial")}</Text>
            </Pressable>

            <View style={styles.dropdownDivider} />

            <Pressable
              style={styles.dropdownItem}
              onPress={() => { setMenuVisible(false); void handleLogout(); }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("logOut")}
            >
              <Ionicons name="log-out-outline" size={18} color={theme.colors.text} />
              <Text style={styles.dropdownItemText}>{t("logOut")}</Text>
            </Pressable>

            <Pressable
              style={styles.dropdownItem}
              onPress={() => { setMenuVisible(false); void handleDeleteAccount(); }}
              disabled={isDeleting}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("deleteMyAccount")}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={theme.colors.error} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
              )}
              <Text style={[styles.dropdownItemText, { color: theme.colors.error }]}>
                {isDeleting ? t("deleting") : t("deleteMyAccount")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: 16,
  },
  dropdownMenu: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 200,
    ...theme.shadows.medium,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dropdownItemText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: "500",
    flex: 1,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
    marginHorizontal: 16,
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
