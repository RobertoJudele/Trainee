import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../../auth/authSlice";
import { UserRole } from "../../auth/authApiSlice";
import {
  useGetTrainerTransformationsQuery,
  useCreateTrainerTransformationMutation,
  useDeleteTrainerTransformationMutation,
} from "../trainerApiSlice";
import { appendImage, PickedImage } from "../../../src/lib/imageUpload";
import { useLanguage } from "../../../src/lib/i18n/LanguageContext";
import { getApiErrorMessage } from "../../../src/lib/errors";

export const MAX_TRANSFORMATIONS = 5;

export function useTrainerTransformations() {
  const user = useSelector(selectCurrentUser);
  const { t } = useLanguage();

  const { data } = useGetTrainerTransformationsQuery(undefined, {
    skip: user?.role !== UserRole.TRAINER,
  });
  const transformations = data?.data ?? [];

  const [createTransformation, { isLoading: isCreating }] = useCreateTrainerTransformationMutation();
  const [deleteTransformation] = useDeleteTrainerTransformationMutation();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Resolves true once saved, so the sheet knows to close and reset.
  const create = useCallback(
    async (before: PickedImage, after: PickedImage, description: string): Promise<boolean> => {
      const form = new FormData();
      appendImage(form, "before", before);
      appendImage(form, "after", after);
      form.append("description", description.trim());
      form.append("consent", "true");
      try {
        await createTransformation(form).unwrap();
        return true;
      } catch (err: unknown) {
        Alert.alert(t("uploadFailed"), getApiErrorMessage(err, t("addTransformationError")));
        return false;
      }
    },
    [createTransformation, t],
  );

  const remove = useCallback(
    async (id: number) => {
      setDeletingId(id);
      try {
        await deleteTransformation(id).unwrap();
      } catch (err: unknown) {
        Alert.alert(t("error"), getApiErrorMessage(err, t("deleteTransformationError")));
      } finally {
        setDeletingId(null);
      }
    },
    [deleteTransformation, t],
  );

  return { transformations, create, remove, isCreating, deletingId };
}
