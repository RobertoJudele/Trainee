// src/components/EditableAvatar.tsx
//
// Round avatar that shows the user's profile picture (or initials fallback) with a
// small camera badge. Tapping it triggers `onPress` (pick + upload); while uploading
// it shows a spinner overlay. Used on both the client and trainer profile headers.
import React from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  imageUrl?: string | null;
  initials: string;
  size?: number;
  editable?: boolean;
  uploading?: boolean;
  onPress?: () => void;
}

export default function EditableAvatar({
  imageUrl,
  initials,
  size = 88,
  editable = false,
  uploading = false,
  onPress,
}: Props) {
  const radius = size / 2;

  const inner = (
    <View style={{ width: size, height: size }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
        </View>
      )}

      {editable && (
        <View style={styles.badge}>
          <Ionicons name="camera" size={size * 0.17} color="#fff" />
        </View>
      )}

      {uploading && (
        <View style={[styles.overlay, { borderRadius: radius }]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </View>
  );

  if (!editable) return inner;

  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel="Change profile picture"
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  fallback: {
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  initials: {
    fontWeight: "700",
    color: "#fff",
  },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
