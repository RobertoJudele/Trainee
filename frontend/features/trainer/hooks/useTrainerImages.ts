import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../../auth/authSlice";
import { UserRole } from "../../auth/authApiSlice";
import {
  useGetTrainerImagesQuery,
  useUploadCredentialImagesMutation,
  useDeleteTrainerImageMutation,
} from "../trainerApiSlice";
import { pickImages, toImageFormData } from "../../../src/lib/imageUpload";
import { useLanguage } from "../../../src/lib/i18n/LanguageContext";
import { getApiErrorMessage } from "../../../src/lib/errors";

const MAX_TRAINER_IMAGES = 5;

export function useTrainerImages() {
  const user = useSelector(selectCurrentUser);
  const { t } = useLanguage();

  const { data: imagesResp } = useGetTrainerImagesQuery(undefined, {
    skip: user?.role !== UserRole.TRAINER,
  });
  const credentialImages = imagesResp?.data?.credential ?? [];

  const [uploadCredential, { isLoading: isUploadingCredential }] = useUploadCredentialImagesMutation();
  const [deleteTrainerImage] = useDeleteTrainerImageMutation();
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  const addImages = useCallback(async () => {
    const picked = await pickImages(MAX_TRAINER_IMAGES - credentialImages.length);
    if (picked.length === 0) return;
    const form = toImageFormData("images", picked);
    try {
      await uploadCredential(form).unwrap();
    } catch (err: unknown) {
      Alert.alert(t("uploadFailed"), getApiErrorMessage(err, t("uploadError")));
    }
  }, [credentialImages.length, uploadCredential, t]);

  const removeImage = useCallback(
    async (id: number) => {
      setDeletingImageId(id);
      try {
        await deleteTrainerImage(id).unwrap();
      } catch (err: unknown) {
        Alert.alert(t("error"), getApiErrorMessage(err, t("deleteImageError")));
      } finally {
        setDeletingImageId(null);
      }
    },
    [deleteTrainerImage, t],
  );

  return {
    credentialImages,
    addImages,
    removeImage,
    isUploadingCredential,
    deletingImageId,
  };
}
