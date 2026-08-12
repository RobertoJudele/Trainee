import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, typography } from "../../lib/theme";
import { detailStyles } from "./styles";
import type { Review } from "../../../features/review/reviewApiSlice";

export type ReviewFormMode = "idle" | "write" | "edit";

type Translate = (key: string) => string;

type TrainerReviewsProps = {
  reviews: Review[];
  currentUserId?: number;
  mode: ReviewFormMode;
  formRating: number;
  formText: string;
  isSaving: boolean;
  isDeleting: boolean;
  canWriteReview: boolean;
  showGateHint: boolean;
  onRatingChange: (rating: number) => void;
  onTextChange: (text: string) => void;
  onOpenWrite: () => void;
  onOpenEdit: (review: Review) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onDelete: (reviewId: number) => void;
  onOptions: (review: Review) => void;
  t: Translate;
};

export default function TrainerReviews({
  reviews,
  currentUserId,
  mode,
  formRating,
  formText,
  isSaving,
  isDeleting,
  canWriteReview,
  showGateHint,
  onRatingChange,
  onTextChange,
  onOpenWrite,
  onOpenEdit,
  onCancel,
  onSubmit,
  onDelete,
  onOptions,
  t,
}: TrainerReviewsProps) {
  return (
    <>
      <Text style={detailStyles.sectionTitle}>
        {t("reviews")} ({reviews.length})
      </Text>

      {reviews.length === 0 && mode === "idle" && (
        <Text style={detailStyles.bodyText}>{t("noReviewsYet")}</Text>
      )}

      {reviews.map((review) => {
        const isOwn = review.client?.id === currentUserId;
        return (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewerAvatar}>
                <Text style={styles.reviewerInitial}>
                  {review.client?.firstName?.[0] ?? "?"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewerName}>
                  {review.client
                    ? `${review.client.firstName} ${review.client.lastName}`
                    : "Anonymous"}
                </Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= review.rating ? "star" : "star-outline"}
                      size={13}
                      color="#F59E0B"
                    />
                  ))}
                </View>
              </View>
              {isOwn ? (
                <View style={styles.reviewActions}>
                  <Pressable
                    onPress={() => onOpenEdit(review)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t("editYourReview")}
                    style={styles.reviewActionBtn}
                  >
                    <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => onDelete(review.id)}
                    disabled={isDeleting}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t("deleteReview")}
                    style={styles.reviewActionBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => onOptions(review)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t("reviewOptions")}
                  style={styles.reviewActionBtn}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              )}
            </View>
            {review.reviewText ? (
              <Text style={styles.reviewText}>{review.reviewText}</Text>
            ) : null}
          </View>
        );
      })}

      {(mode === "write" || mode === "edit") && (
        <View style={styles.reviewForm}>
          <Text style={styles.reviewFormTitle}>
            {mode === "edit" ? t("editYourReview") : t("writeAReview")}
          </Text>
          <View style={styles.starSelector}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable
                key={s}
                onPress={() => onRatingChange(s)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${s}`}
              >
                <Ionicons
                  name={s <= formRating ? "star" : "star-outline"}
                  size={30}
                  color="#F59E0B"
                  style={{ marginHorizontal: 4 }}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            placeholder={t("addComment")}
            placeholderTextColor={theme.colors.textSecondary}
            value={formText}
            onChangeText={onTextChange}
            multiline
            maxLength={100}
          />
          <Text style={styles.charCount}>{formText.length}/100</Text>
          <View style={styles.reviewFormActions}>
            <Pressable
              style={styles.cancelFormBtn}
              onPress={onCancel}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("cancel")}
            >
              <Text style={styles.cancelFormBtnText}>{t("cancel")}</Text>
            </Pressable>
            <Pressable
              style={[styles.submitFormBtn, isSaving && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={isSaving}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("submit")}
            >
              <Text style={styles.submitFormBtnText}>
                {isSaving ? t("saving") : t("submit")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {canWriteReview && (
        <Pressable
          style={styles.writeReviewBtn}
          onPress={onOpenWrite}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("writeReview")}
        >
          <Ionicons
            name="star-outline"
            size={16}
            color={theme.colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.writeReviewBtnText}>{t("writeReview")}</Text>
        </Pressable>
      )}

      {showGateHint && (
        <Text style={detailStyles.bodyText}>{t("reviewRequiresSession")}</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  reviewCard: {
    borderTopWidth: 1,
    borderTopColor: "#F3F6F9",
    paddingTop: 12,
    marginTop: 12,
    gap: 6,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  reviewerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewerInitial: {
    ...typography.caption,
    color: "#fff",
    fontWeight: "800",
  },
  reviewerName: {
    ...typography.body2,
    color: theme.colors.text,
    fontWeight: "700",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  reviewActionBtn: {
    padding: 4,
  },
  reviewText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginLeft: 44,
  },
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignSelf: "flex-start",
  },
  writeReviewBtnText: {
    ...typography.body2,
    color: theme.colors.primary,
    fontWeight: "700",
  },
  reviewForm: {
    marginTop: 14,
    gap: 10,
  },
  reviewFormTitle: {
    ...typography.body1,
    color: theme.colors.text,
    fontWeight: "700",
  },
  starSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    ...typography.body2,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  charCount: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    alignSelf: "flex-end",
  },
  reviewFormActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  cancelFormBtnText: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    fontWeight: "700",
  },
  submitFormBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  submitFormBtnText: {
    ...typography.body2,
    color: "#fff",
    fontWeight: "700",
  },
});
