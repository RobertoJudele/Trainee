// src/components/TransformationCarousel.tsx
//
// Read-only client transformations on a trainer's public profile. Each card
// shows the before and after photos side by side with the trainer's caption
// underneath; cards scroll sideways with the next one peeking in. Tapping a
// card opens a dark fullscreen viewer that pages through the same list.
// Presentational only — the parent owns the data.
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  StatusBar,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, typography } from "../lib/theme";
import { fonts } from "../lib/fonts";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { TrainerTransformationItem } from "../../features/trainer/trainerApiSlice";

interface Props {
  transformations: TrainerTransformationItem[];
  /** The page's own section title; the counter sits beside it. */
  renderHeader: (counter: string | null) => React.ReactNode;
}

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_GAP = 12;
// How much of the next card shows, so it's clear the row scrolls.
const PEEK = 40;
const PHOTO_H = 236;

export default function TransformationCarousel({ transformations, renderHeader }: Props) {
  const { t } = useLanguage();
  const [rowWidth, setRowWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const single = transformations.length === 1;
  const cardWidth = single ? rowWidth : Math.max(rowWidth - PEEK, 0);
  const snap = cardWidth + CARD_GAP;

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (snap <= 0) return;
      setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / snap));
    },
    [snap],
  );

  // Settled pages only, and only while open — see TrainerImageCarousel for why.
  const handleViewerScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setViewerIndex((prev) => (prev === null ? null : index));
  }, []);

  if (transformations.length === 0) return null;

  const total = transformations.length;
  const isViewerOpen = viewerIndex !== null;
  const label = (index: number) => `${t("clientResults")} ${index + 1}/${total}`;

  return (
    <View style={styles.section}>
      {renderHeader(single ? null : `${activeIndex + 1} / ${total}`)}

      <View onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        {rowWidth > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snap}
            decelerationRate="fast"
            disableIntervalMomentum
            onScroll={handleScroll}
            scrollEventThrottle={16}
            scrollEnabled={!single}
            // Let the last card's right edge reach the screen edge like the others.
            style={{ marginRight: -20 }}
            contentContainerStyle={{ gap: CARD_GAP, paddingRight: 20 }}
          >
            {transformations.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => setViewerIndex(index)}
                style={[styles.card, { width: cardWidth }]}
                accessibilityRole="imagebutton"
                accessibilityLabel={`${label(index)}. ${item.description}`}
              >
                <View style={styles.photoRow}>
                  <Photo uri={item.beforeImageUrl} label={t("transformationBefore")} />
                  <Photo uri={item.afterImageUrl} label={t("transformationAfter")} />
                </View>
                <Text style={styles.description}>{item.description}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {!single && (
        <View style={styles.dotsRow}>
          {transformations.map((item, index) => (
            <View key={item.id} style={[styles.dot, index === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      <Modal
        visible={isViewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <StatusBar hidden={isViewerOpen} />
        <View style={styles.viewerBackdrop}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleViewerScroll}
            scrollEnabled={!single}
            contentOffset={{ x: (viewerIndex ?? 0) * SCREEN_W, y: 0 }}
          >
            {transformations.map((item) => (
              <View key={item.id} style={styles.viewerSlide}>
                <View style={styles.viewerPhotos}>
                  <View style={styles.viewerColumn}>
                    <Image source={{ uri: item.beforeImageUrl }} style={styles.viewerImage} resizeMode="cover" />
                    <Text style={styles.viewerLabel}>{t("transformationBefore").toUpperCase()}</Text>
                  </View>
                  <View style={styles.viewerColumn}>
                    <Image source={{ uri: item.afterImageUrl }} style={styles.viewerImage} resizeMode="cover" />
                    <Text style={styles.viewerLabel}>{t("transformationAfter").toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.viewerDescription}>{item.description}</Text>
              </View>
            ))}
          </ScrollView>

          {!single && (
            <Text style={styles.viewerCounter} pointerEvents="none">
              {(viewerIndex ?? 0) + 1} / {total}
            </Text>
          )}

          <Pressable
            style={styles.viewerClose}
            onPress={() => setViewerIndex(null)}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function Photo({ uri, label }: { uri: string; label: string }) {
  return (
    <View style={styles.photo}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {/* Text over a photo sits on a dark band, never straight on the image. */}
      <View style={styles.photoBand}>
        <Text style={styles.photoLabel}>{label.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    overflow: "hidden",
  },
  photoRow: {
    flexDirection: "row",
    gap: 2,
    height: PHOTO_H,
    backgroundColor: theme.colors.border,
  },
  photo: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSunken,
    justifyContent: "flex-end",
  },
  photoBand: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  photoLabel: {
    ...typography.label,
    color: "#fff",
  },
  description: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.text,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderStrong,
  },
  dotActive: {
    width: 18,
    backgroundColor: theme.colors.text,
  },
  // ── Fullscreen viewer ──
  viewerBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.text,
  },
  viewerSlide: {
    width: SCREEN_W,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 20,
  },
  viewerPhotos: {
    flexDirection: "row",
    gap: 8,
  },
  viewerColumn: {
    flex: 1,
    gap: 8,
  },
  viewerImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: theme.radius.control,
    backgroundColor: "#334155",
  },
  viewerLabel: {
    ...typography.label,
    color: theme.colors.borderStrong,
  },
  viewerDescription: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 26,
    color: "#fff",
  },
  viewerCounter: {
    position: "absolute",
    top: 60,
    left: 20,
    fontFamily: fonts.monoSemiBold,
    fontSize: 12,
    letterSpacing: 0.96,
    color: theme.colors.borderStrong,
  },
  viewerClose: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
});
