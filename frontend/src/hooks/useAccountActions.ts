import { useCallback } from "react";
import { Alert, Platform } from "react-native";
import { useDispatch } from "react-redux";
import { useRouter } from "expo-router";
import Purchases from "react-native-purchases";
import { logOut } from "../../features/auth/authSlice";
import { apiSlice } from "../api/apiSlice";
import { useLanguage } from "../lib/i18n/LanguageContext";

interface UseAccountActionsOptions {
  deleteAccount: () => { unwrap: () => Promise<unknown> };
  isDeleting: boolean;
  onBeforeLogout?: () => void;
  onBeforeDeleteAccount?: () => void;
}

export function useAccountActions({
  deleteAccount,
  isDeleting,
  onBeforeLogout,
  onBeforeDeleteAccount,
}: UseAccountActionsOptions) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { t } = useLanguage();

  const cleanupAndNavigate = useCallback(async () => {
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

  const handleLogout = useCallback(async () => {
    onBeforeLogout?.();
    await cleanupAndNavigate();
  }, [cleanupAndNavigate, onBeforeLogout]);

  const performDeleteAccount = useCallback(async () => {
    try {
      onBeforeDeleteAccount?.();
      await deleteAccount().unwrap();
      await cleanupAndNavigate();
    } catch {
      Alert.alert(t("error"), t("deleteAccountError"));
    }
  }, [deleteAccount, cleanupAndNavigate, onBeforeDeleteAccount, t]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t("deleteAccountTitle") || t("deleteFullAccountTitle"),
      t("deleteAccountMessage") || t("deleteFullAccountMessage"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("delete"), style: "destructive", onPress: performDeleteAccount },
      ],
    );
  }, [t, performDeleteAccount]);

  return {
    handleLogout,
    handleDeleteAccount,
    isDeletingAccount: isDeleting,
  };
}
