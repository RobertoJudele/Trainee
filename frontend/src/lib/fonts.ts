// The three type families of the Salvio design system (option A, "Poster"):
//   display — Archivo Condensed ExtraBold, uppercase screen titles and names
//   ui      — Manrope, everything read as a sentence
//   mono    — IBM Plex Mono, prices, times, counts and small labels
//
// React Native picks a face by family name, not by fontWeight, so every weight
// is its own family. Set `fontFamily` from here and leave `fontWeight` unset.
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono";

export const fonts = {
  display: "ArchivoCondensed-ExtraBold",
  ui: "Manrope_500Medium",
  uiSemiBold: "Manrope_600SemiBold",
  uiBold: "Manrope_700Bold",
  uiExtraBold: "Manrope_800ExtraBold",
  mono: "IBMPlexMono_500Medium",
  monoSemiBold: "IBMPlexMono_600SemiBold",
} as const;

// Archivo Condensed is a static instance (wdth 75, wght 800) cut from Google's
// variable Archivo, which Android can't render at a chosen width. OFL licence
// beside it in assets/fonts.
export const fontAssets = {
  [fonts.display]: require("../../assets/fonts/ArchivoCondensed-ExtraBold.ttf"),
  [fonts.ui]: Manrope_500Medium,
  [fonts.uiSemiBold]: Manrope_600SemiBold,
  [fonts.uiBold]: Manrope_700Bold,
  [fonts.uiExtraBold]: Manrope_800ExtraBold,
  [fonts.mono]: IBMPlexMono_500Medium,
  [fonts.monoSemiBold]: IBMPlexMono_600SemiBold,
};
