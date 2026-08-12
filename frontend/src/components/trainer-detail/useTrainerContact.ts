import { useCallback, useMemo, useState } from "react";
import { Alert, Linking } from "react-native";
import {
  normalizeSocialUrl,
  getWhatsAppContactUrls,
} from "../../lib/contactLinks";
import type { ContactOption } from "./ContactSheet";

type Translate = (key: string) => string;

type TrainerContactLinks = {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
};

/**
 * The trainer's contact hand-off, which is this screen's primary action —
 * Salvio has no in-app chat or client-side booking by design, so reaching a
 * trainer means opening Instagram, Facebook, or WhatsApp.
 */
export function useTrainerContact(trainer: TrainerContactLinks | undefined, t: Translate) {
  const [sheetVisible, setSheetVisible] = useState(false);

  const options = useMemo<ContactOption[]>(() => {
    const list: ContactOption[] = [];

    const instagramUrl = normalizeSocialUrl(trainer?.instagramUrl);
    if (instagramUrl) {
      list.push({ label: "Instagram", url: instagramUrl, icon: "logo-instagram", color: "#E1306C" });
    }

    const facebookUrl = normalizeSocialUrl(trainer?.facebookUrl);
    if (facebookUrl) {
      list.push({ label: "Facebook", url: facebookUrl, icon: "logo-facebook", color: "#1877F2" });
    }

    const whatsapp = getWhatsAppContactUrls(trainer?.whatsappUrl);
    if (whatsapp) {
      list.push({
        label: "WhatsApp",
        url: whatsapp.appUrl,
        fallbackUrl: whatsapp.webUrl,
        icon: "logo-whatsapp",
        color: "#25D366",
      });
    }

    return list;
  }, [trainer?.facebookUrl, trainer?.instagramUrl, trainer?.whatsappUrl]);

  const openUrl = useCallback(async (url: string, fallbackUrl?: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }

      // WhatsApp's app scheme fails when the app isn't installed; wa.me works.
      if (fallbackUrl) {
        const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
        if (canOpenFallback) {
          await Linking.openURL(fallbackUrl);
          return;
        }
      }

      Alert.alert(t("unavailable"), t("couldNotOpenSocial"));
    } catch {
      Alert.alert(t("error"), t("failedOpenSocial"));
    }
  }, [t]);

  /** A one-row sheet is pure friction, so a lone option opens directly. */
  const handlePress = useCallback(() => {
    if (options.length === 1) {
      void openUrl(options[0].url, options[0].fallbackUrl);
      return;
    }
    setSheetVisible(true);
  }, [options, openUrl]);

  const handleSelect = useCallback((option: ContactOption) => {
    setSheetVisible(false);
    void openUrl(option.url, option.fallbackUrl);
  }, [openUrl]);

  return {
    options,
    hasContact: options.length > 0,
    sheetVisible,
    closeSheet: useCallback(() => setSheetVisible(false), []),
    handlePress,
    handleSelect,
  };
}
