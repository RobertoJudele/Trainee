import { ReactNode, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Linking,
  Pressable,
} from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/config";
import { theme } from "../lib/theme";
import { useLanguage } from "../lib/i18n/LanguageContext";
import ReleaseNotesModal from "./ReleaseNotesModal";
import {
  LAST_SEEN_VERSION_KEY,
  shouldShowReleaseNotes,
  type ReleaseNotes,
} from "../lib/releaseNotes";

interface UpdateInfo {
  updateRequired: boolean;
  message: string;
  storeUrl: string;
  releaseNotes?: ReleaseNotes | null;
}

export default function UpdateGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [notes, setNotes] = useState<ReleaseNotes | null>(null);

  useEffect(() => {
    // Only native builds have a store to send users to. Fail open on web.
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;

    let cancelled = false;
    const check = async () => {
      try {
        const version = Constants.expoConfig?.version ?? "";
        const url = `${API_URL}/version/check?platform=${Platform.OS}&version=${encodeURIComponent(version)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const body = await res.json();
        const data = body?.data as UpdateInfo | undefined;
        if (cancelled) return;

        if (data?.updateRequired) {
          setUpdate(data);
          return;
        }

        // Not blocked — decide whether this launch is the first after an update
        // and the notes are worth showing. The stored version is written on
        // every launch, including the very first, so a fresh install records
        // its version and stays silent.
        const storedVersion = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
        if (cancelled) return;

        if (
          shouldShowReleaseNotes({
            storedVersion,
            currentVersion: version,
            notes: data?.releaseNotes,
          })
        ) {
          setNotes(data?.releaseNotes ?? null);
        }

        if (version && storedVersion !== version) {
          await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, version);
        }
      } catch {
        // Fail open: any error (network, timeout, parse, storage) → don't block
        // and don't announce anything.
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update?.updateRequired) {
    return (
      <>
        {children}
        <ReleaseNotesModal
          notes={notes}
          visible={notes !== null}
          onClose={() => setNotes(null)}
        />
      </>
    );
  }

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>{t("updateRequiredTitle")}</Text>
      <Text style={styles.message}>{update.message}</Text>
      <Pressable
        style={styles.button}
        onPress={() => Linking.openURL(update.storeUrl)}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t("updateRequiredButton")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
