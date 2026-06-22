import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../../auth/authSlice";
import { UserRole } from "../../auth/authApiSlice";
import {
  useGetTrainerImagesQuery,
  useUploadGalleryImagesMutation,
  useUploadCredentialImagesMutation,
  useDeleteTrainerImageMutation,
} from "../trainerApiSlice";
import { pickImages, toImageFormData } from "../../../src/lib/imageUpload";
import { useLanguage } from "../../../src/lib/i18n/LanguageContext";

const MAX_TRAINER_IMAGES = 5;

export function useTrainerImages() {
  const user = useSelector(selectCurrentUser);
  const { t } = useLanguage();

  const { data: imagesResp } = useGetTrainerImagesQuery(undefined, {
    skip: user?.role !== UserRole.TRAINER,
  });
  const galleryImages = imagesResp?.data?.gallery ?? [];
  const credentialImages = imagesResp?.data?.credential ?? [];

  const [uploadGallery, { isLoading: isUploadingGallery }] = useUploadGalleryImagesMutation();
  const [uploadCredential, { isLoading: isUploadingCredential }] = useUploadCredentialImagesMutation();
  const [deleteTrainerImage] = useDeleteTrainerImageMutation();
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  const addImages = useCallback(
    async (category: "gallery" | "credential") => {
      const current = category === "gallery" ? galleryImages.length : credentialImages.length;
      const picked = await pickImages(MAX_TRAINER_IMAGES - current);
      if (picked.length === 0) return;
      const form = toImageFormData("images", picked);
      try {
        if (category === "gallery") await uploadGallery(form).unwrap();
        else await uploadCredential(form).unwrap();
      } catch (err: any) {
        Alert.alert(t("uploadFailed"), err?.data?.message || t("uploadError"));
      }
    },
    [galleryImages.length, credentialImages.length, uploadGallery, uploadCredential, t],
  );

  const removeImage = useCallback(
    async (id: number) => {
      setDeletingImageId(id);
      try {
        await deleteTrainerImage(id).unwrap();
      } catch (err: any) {
        Alert.alert(t("error"), err?.data?.message || t("deleteImageError"));
      } finally {
        setDeletingImageId(null);
      }
    },
    [deleteTrainerImage, t],
  );

  return {
    galleryImages,
    credentialImages,
    addImages,
    removeImage,
    isUploadingGallery,
    isUploadingCredential,
    deletingImageId,
  };
}
