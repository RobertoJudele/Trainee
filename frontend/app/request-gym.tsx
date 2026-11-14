import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCreateIssueMutation } from "../features/support/issueApiSlice";
import { theme, typography, presets } from "../src/lib/theme";
import { FieldError } from "../src/components/ui";
import { useFieldErrors } from "../src/lib/useFieldErrors";
import { useLanguage } from "../src/lib/i18n/LanguageContext";
import { getApiErrorMessage } from "../src/lib/errors";
import { fonts } from "../src/lib/fonts";

// Bucharest fallback when no pin params are passed.
const FALLBACK = { latitude: 44.4268, longitude: 26.1025 };

export default function RequestGymScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const initialLat = Number(params.lat);
  const initialLng = Number(params.lng);
  const start = {
    latitude: Number.isFinite(initialLat) ? initialLat : FALLBACK.latitude,
    longitude: Number.isFinite(initialLng) ? initialLng : FALLBACK.longitude,
  };

  const [name, setName] = useState("");
  const fieldErrors = useFieldErrors<"name" | "address">();
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState(start);
  const [createIssue, { isLoading }] = useCreateIssueMutation();

  const region: Region = {
    ...coords,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const onSubmit = async () => {
    const valid = fieldErrors.setAll({
      ...(name.trim().length < 5 ? { name: t("gymNameMinLength") } : {}),
      ...(address.trim().length < 5 ? { address: t("gymAddressRequired") } : {}),
    });
    if (!valid) return;

    try {
      await createIssue({
        targetType: "gym",
        category: "gym_request",
        title: name.trim(),
        description: `${address.trim()} (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`,
        metadata: {
          address: address.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
      }).unwrap();
      Alert.alert(t("submitted"), t("gymRequestSubmitted"), [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      Alert.alert(t("error"), getApiErrorMessage(error, t("error")));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t("requestGymTitle")}</Text>
        <Text style={styles.subtitle}>{t("requestGymSubtitle")}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t("gymName")}</Text>
          <TextInput
            style={[styles.input, fieldErrors.errors.name && presets.inputError]}
            value={name}
            onChangeText={(v) => { fieldErrors.clear("name"); setName(v); }}
            placeholder={t("gymNamePlaceholder")}
            maxLength={100}
          />
          <FieldError message={fieldErrors.errors.name} />

          <Text style={[styles.label, { marginTop: 6 }]}>{t("gymAddress")}</Text>
          <TextInput
            style={[styles.input, fieldErrors.errors.address && presets.inputError]}
            value={address}
            onChangeText={(v) => { fieldErrors.clear("address"); setAddress(v); }}
            placeholder={t("gymAddressPlaceholder")}
            maxLength={200}
          />
          <FieldError message={fieldErrors.errors.address} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t("gymLocationHint")}</Text>
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              region={region}
              onPress={(e) => setCoords(e.nativeEvent.coordinate)}
            >
              <Marker
                coordinate={coords}
                draggable
                onDragEnd={(e) => setCoords(e.nativeEvent.coordinate)}
              />
            </MapView>
          </View>
        </View>

        <Pressable
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={onSubmit}
          disabled={isLoading}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("submitGymRequest")}
        >
          <Text style={styles.submitText}>
            {isLoading ? t("submitting") : t("submitGymRequest")}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { ...typography.h2, color: theme.colors.text },
  subtitle: { ...typography.body2, color: theme.colors.textSecondary },
  card: {
    ...presets.card,
    padding: 16,
    gap: 12,
  },
  label: { ...typography.body2, color: theme.colors.text, fontFamily: fonts.uiBold },
  input: {
    ...presets.input,
  },
  mapWrap: {
    height: 240,
    borderRadius: theme.roundness,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  map: { flex: 1 },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.control,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { ...typography.body1, color: "#fff", fontFamily: fonts.uiBold },
});
