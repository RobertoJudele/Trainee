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

export function useProfilePictureUpload() {
  const [upload, { isLoading: isUploading }] = useUploadProfilePictureMutation();
  const [remove, { isLoading: isDeleting }] = useDeleteProfilePictureMutation();

  const pickAndUpload = useCallback(async () => {
    const picked = await pickProfileImage();
    if (!picked) return;
    try {
      const form = toImageFormData("profileImage", [picked]);
      await upload(form).unwrap();
    } catch (err: any) {
      Alert.alert("Upload failed", err?.data?.message || "Could not upload your photo.");
    }
  }, [upload]);

  const deletePicture = useCallback(async () => {
    try {
      await remove().unwrap();
    } catch (err: any) {
      Alert.alert("Error", err?.data?.message || "Could not remove your photo.");
    }
  }, [remove]);

  return { pickAndUpload, deletePicture, isUploading, isDeleting };
}
