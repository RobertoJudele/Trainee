import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { theme, typography } from "../lib/theme";
import { useLanguage } from "../lib/i18n/LanguageContext";

interface ScreenHeaderProps {
  /** Centered title. Omit when passing richer content via children (e.g. an avatar block). */
  title?: string;
  /** Optional centered subtitle under the title. */
  subtitle?: string;
  /** Show the back arrow (top-left). Default true. */
  showBack?: boolean;
  /** Override back behavior. Defaults to router.back() with a home fallback. */
  onBack?: () => void;
  /** When provided, renders the ⋮ overflow button (top-right) wired to this handler. */
  onMenuPress?: () => void;
  menuAccessibilityLabel?: string;
  /** Extra content rendered inside the gradient, below the title. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Brand gradient header shared across screens with `headerShown: false`. */
export default function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  onMenuPress,
  menuAccessibilityLabel = "Menu",
  children,
  style,
}: ScreenHeaderProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")));

  return (
    <View style={[styles.gradient, { paddingTop: Math.max(insets.top + 12, 48) }, style, { backgroundColor: theme.colors.primary }]}>
      {showBack && (
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("goBack")}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
      )}

      {onMenuPress && (
        <Pressable
          style={styles.menuButton}
          onPress={onMenuPress}
          accessible
          accessibilityRole="button"
          accessibilityLabel={menuAccessibilityLabel}
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </Pressable>
      )}

      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 44,
  },
  menuButton: {
    position: "absolute",
    top: 0,
    right: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 44,
  },
  // Horizontal padding keeps long/centered titles clear of the absolute corner buttons.
  title: { ...typography.h2, color: "#fff", marginBottom: 8, textAlign: "center", paddingHorizontal: 40 },
  subtitle: { ...typography.body2, color: "rgba(255,255,255,0.9)", textAlign: "center", marginTop: -4, marginBottom: 4, paddingHorizontal: 24 },
});
