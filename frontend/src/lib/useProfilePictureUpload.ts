// src/lib/useProfilePictureUpload.ts
//
// One hook both the client and trainer profile screens use to change the avatar.
// Picks a square-cropped image, uploads it, and (via the mutation's onQueryStarted)
// the auth slice user is updated so the new picture shows app-wide.
import { useCallback } from "react";
import { Alert } from "react-native";
import {
  useUploadProfilePictureMutation,
  useDeleteProfilePictureMutation,
} from "../../features/users/usersApiSlicet";
import { pickProfileImage, toImageFormData } from "./imageUpload";
import { getApiErrorMessage } from "./errors";

export function useProfilePictureUpload() {
  const [upload, { isLoading: isUploading }] = useUploadProfilePictureMutation();
  const [remove, { isLoading: isDeleting }] = useDeleteProfilePictureMutation();

  const pickAndUpload = useCallback(async () => {
    const picked = await pickProfileImage();
    if (!picked) return;
    try {
      const form = toImageFormData("profileImage", [picked]);
      await upload(form).unwrap();
    } catch (err: unknown) {
      Alert.alert("Upload failed", getApiErrorMessage(err, "Could not upload your photo."));
    }
  }, [upload]);

  const deletePicture = useCallback(async () => {
    try {
      await remove().unwrap();
    } catch (err: unknown) {
      Alert.alert("Error", getApiErrorMessage(err, "Could not remove your photo."));
    }
  }, [remove]);

  return { pickAndUpload, deletePicture, isUploading, isDeleting };
}
