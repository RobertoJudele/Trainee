// src/lib/imageUpload.ts
//
// Shared helpers for picking images and turning them into multipart FormData that
// our RTK Query mutations POST to the backend. The server (sharp) does the real
// resizing, so on the client we only need to compress a bit and, for avatars,
// force a square crop so the in-app preview matches the stored 512x512 result.
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export interface PickedImage {
  uri: string;
  fileName: string;
  mimeType: string;
}

// Ask for library permission and return true if granted.
async function ensureLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === "granted";
}

function assetToPicked(asset: ImagePicker.ImagePickerAsset, index = 0): PickedImage {
  // RN's FormData needs a filename + mime type; expo doesn't always provide them.
  const mimeType = asset.mimeType ?? "image/jpeg";
  const ext = mimeType.split("/")[1] ?? "jpg";
  const fileName = asset.fileName ?? `image-${Date.now()}-${index}.${ext}`;
  return { uri: asset.uri, fileName, mimeType };
}

// Pick a single image and crop it to a square (for profile pictures).
export async function pickProfileImage(): Promise<PickedImage | null> {
  if (!(await ensureLibraryPermission())) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return assetToPicked(result.assets[0]);
}

// Pick up to `remaining` images (gallery / credentials). Falls back to single
// selection automatically on platforms that don't support multi-select.
export async function pickImages(remaining: number): Promise<PickedImage[]> {
  if (remaining <= 0) return [];
  if (!(await ensureLibraryPermission())) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return [];
  return result.assets.slice(0, remaining).map((a, i) => assetToPicked(a, i));
}

// Build multipart FormData from picked images under a given field name.
// React Native accepts `{ uri, name, type }` objects appended to FormData.
export function toImageFormData(field: string, images: PickedImage[]): FormData {
  const form = new FormData();
  for (const img of images) {
    form.append(field, {
      // iOS file URIs sometimes need the file:// prefix preserved; Android works as-is.
      uri: Platform.OS === "ios" ? img.uri.replace("file://", "file://") : img.uri,
      name: img.fileName,
      type: img.mimeType,
    } as any);
  }
  return form;
}
