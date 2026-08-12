import { useCallback, useState } from "react";
import { Alert } from "react-native";
import {
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
  Review,
} from "../../../features/review/reviewApiSlice";
import { getApiErrorMessage } from "../../lib/errors";
import type { ReviewFormMode } from "./TrainerReviews";

type Translate = (key: string) => string;

/**
 * Write / edit / delete state for the review a client leaves on a trainer.
 * Owns the form fields and the three mutations so the screen only has to wire
 * the handlers to <TrainerReviews />.
 */
export function useReviewComposer(trainerInternalId: number | undefined, t: Translate) {
  const [createReview, { isLoading: isCreating }] = useCreateReviewMutation();
  const [updateReview, { isLoading: isUpdating }] = useUpdateReviewMutation();
  const [deleteReview, { isLoading: isDeleting }] = useDeleteReviewMutation();

  const [mode, setMode] = useState<ReviewFormMode>("idle");
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [formRating, setFormRating] = useState(5);
  const [formText, setFormText] = useState("");

  const openWriteForm = useCallback(() => {
    setFormRating(5);
    setFormText("");
    setEditingReviewId(null);
    setMode("write");
  }, []);

  const openEditForm = useCallback((review: Review) => {
    setFormRating(review.rating);
    setFormText(review.reviewText ?? "");
    setEditingReviewId(review.id);
    setMode("edit");
  }, []);

  const cancelForm = useCallback(() => {
    setMode("idle");
    setEditingReviewId(null);
  }, []);

  const submitReview = useCallback(async () => {
    if (!trainerInternalId) return;
    const text = formText.trim();
    if (text && text.length < 10) {
      Alert.alert(t("tooShort"), t("reviewTooShort"));
      return;
    }
    if (text && text.length > 100) {
      Alert.alert(t("tooLong"), t("reviewTooLong"));
      return;
    }
    try {
      if (mode === "write") {
        await createReview({
          trainerId: trainerInternalId,
          rating: formRating,
          reviewText: text || undefined,
        }).unwrap();
      } else if (mode === "edit" && editingReviewId) {
        await updateReview({
          reviewId: editingReviewId,
          trainerId: trainerInternalId,
          rating: formRating,
          reviewText: text || undefined,
        }).unwrap();
      }
      setMode("idle");
      setEditingReviewId(null);
    } catch (err: unknown) {
      // 403 is the "not your trainer" gate; server messages are English-only.
      const message =
        (err as { status?: number })?.status === 403
          ? t("reviewRequiresSession")
          : getApiErrorMessage(err, t("couldNotSaveReview"));
      Alert.alert(t("error"), message);
    }
  }, [trainerInternalId, mode, formRating, formText, editingReviewId, createReview, updateReview, t]);

  const handleDeleteReview = useCallback((reviewId: number) => {
    if (!trainerInternalId) return;
    Alert.alert(t("deleteReview"), t("deleteReviewConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReview({ reviewId, trainerId: trainerInternalId }).unwrap();
          } catch (err: unknown) {
            Alert.alert(t("error"), getApiErrorMessage(err, t("couldNotDeleteReview")));
          }
        },
      },
    ]);
  }, [trainerInternalId, deleteReview, t]);

  return {
    mode,
    formRating,
    formText,
    isSaving: isCreating || isUpdating,
    isDeleting,
    setFormRating,
    setFormText,
    openWriteForm,
    openEditForm,
    cancelForm,
    submitReview,
    handleDeleteReview,
  };
}
