// src/components/TrainerImageCarousel.tsx
//
// Read-only swipeable carousel for one image category (gallery OR
// certifications). Renders a full-width horizontal pager with dot indicators
// and a tap-to-open fullscreen viewer (handy for reading certificate text).
// Presentational only — the parent owns the data.
import React, { useCallback, useRef, useState } from "react";
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
import { TrainerImageItem } from "../../features/trainer/trainerApiSlice";

interface Props {
  title: string;
  images: TrainerImageItem[];
  // "cover" fills the slide (gallery photos); "contain" preserves the whole
  // image without cropping (certificates with text).
  resizeMode?: "cover" | "contain";
  height?: number;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function TrainerImageCarousel({
  title,
  images,
  resizeMode = "cover",
  height = 240,
}: Props) {
  const [slideWidth, setSlideWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewerScrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (slideWidth <= 0) return;
      const index = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
      setActiveIndex(index);
    },
    [slideWidth]
  );

  // Update the viewer page only once the swipe settles. Tracking it on every
  // scroll frame re-rendered the ScrollView mid-drag, which re-applied the
  // `contentOffset` prop and yanked the scroll back — so it never finished
  // paging and rested showing parts of two images.
  const handleViewerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      setViewerIndex(index);
    },
    []
  );

  if (images.length === 0) {
    return null;
  }

  const isViewerOpen = viewerIndex !== null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>

      <View
        style={[styles.carousel, { height }]}
        onLayout={(e) => setSlideWidth(e.nativeEvent.layout.width)}
      >
        {slideWidth > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            // Single image: nothing to swipe, keep it static.
            scrollEnabled={images.length > 1}
          >
            {images.map((img, index) => (
              <Pressable
                key={img.id}
                onPress={() => setViewerIndex(index)}
                style={{ width: slideWidth, height }}
                accessibilityRole="imagebutton"
                accessibilityLabel={`${title} image ${index + 1} of ${images.length}. Tap to view fullscreen.`}
              >
                <Image
                  source={{ uri: img.imageUrl }}
                  style={styles.slideImage}
                  resizeMode={resizeMode}
                />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {images.length > 1 && (
          <View style={styles.counterPill} pointerEvents="none">
            <Text style={styles.counterText}>
              {activeIndex + 1}/{images.length}
            </Text>
          </View>
        )}
      </View>

      {images.length > 1 && (
        <View style={styles.dotsRow}>
          {images.map((img, index) => (
            <View
              key={img.id}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Fullscreen viewer */}
      <Modal
        visible={isViewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <StatusBar hidden={isViewerOpen} />
        <View style={styles.viewerBackdrop}>
          <ScrollView
            ref={viewerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleViewerScroll}
            scrollEnabled={images.length > 1}
            contentOffset={{ x: (viewerIndex ?? 0) * SCREEN_W, y: 0 }}
          >
            {images.map((img) => (
              <View key={img.id} style={styles.viewerSlide}>
                <Image
                  source={{ uri: img.imageUrl }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          {images.length > 1 && (
            <View style={styles.viewerCounterPill} pointerEvents="none">
              <Text style={styles.counterText}>
                {(viewerIndex ?? 0) + 1}/{images.length}
              </Text>
            </View>
          )}

          <Pressable
            style={styles.viewerClose}
            onPress={() => setViewerIndex(null)}
            accessibilityRole="button"
            accessibilityLabel="Close fullscreen image viewer"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
    ...theme.shadows.small,
  },
  title: {
    ...typography.h3,
    color: theme.colors.text,
  },
  carousel: {
    borderRadius: theme.roundness,
    overflow: "hidden",
    backgroundColor: theme.colors.background,
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  counterPill: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(15,23,42,0.7)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    ...typography.caption,
    color: "#fff",
    fontWeight: "700",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    width: 20,
  },
  // ── Fullscreen viewer ──
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
  },
  viewerSlide: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  viewerCounterPill: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.7)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  viewerClose: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15,23,42,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
});
