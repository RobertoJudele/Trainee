import { MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { fonts } from './fonts';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    // Every token below that carries text, or sits under white text, passes
    // WCAG AA (4.5:1) on white. The bright logo green fails as text (2.5:1),
    // so it lives in brandBright for fills and marks that carry no text.
    primary: '#047857', // Emerald 700 — white on it 5.5:1
    secondary: '#0F766E', // Teal 700
    tertiary: '#065F46', // Emerald 800
    brandBright: '#10B981', // App-icon green: decoration only, never under text
    background: '#F8FAFC', // Crisp cool grey background
    surface: '#FFFFFF',
    error: '#DC2626', // 4.8:1 on white
    success: '#047857',
    warning: '#D97706', // icons only (3.2:1)
    text: '#0F172A', // Slate 900
    textSecondary: '#64748B', // Slate 500
    border: '#E2E8F0', // Slate 200
    card: '#FFFFFF',
  },
  roundness: 16, // Softer curves for modern look
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  shadows: {
    small: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    large: {
      shadowColor: '#10B981', // subtle green glow for emphasis items
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 8,
    },
  },
  // Gradient palettes used across the app for a cohesive, premium feel.
  gradients: {
    primary: ['#047857', '#065F46'] as const,
    brand: ['#047857', '#0F766E'] as const,
    surface: ['#FFFFFF', '#F8FAFC'] as const,
  },
  // Motion tokens — keep transitions consistent and snappy across screens.
  motion: {
    fast: 160,
    base: 240,
    slow: 380,
    // Per-item delay for staggered entrance animations.
    stagger: 70,
  },
};

// Option A, "Poster": condensed uppercase headings over calm Manrope text, mono
// for numbers. Families come from fonts.ts; weights are separate families, so
// these styles carry no fontWeight. Line heights leave room above uppercase
// diacritics (Î, Â) and below the comma of Ș and Ț.
const display = {
  fontFamily: fonts.display,
  fontSize: 36,
  lineHeight: 40,
  letterSpacing: -0.5,
  textTransform: 'uppercase' as const,
};
const title = {
  fontFamily: fonts.display,
  fontSize: 26,
  lineHeight: 30,
  letterSpacing: -0.2,
  textTransform: 'uppercase' as const,
};
const heading = { fontFamily: fonts.uiBold, fontSize: 18, lineHeight: 24 };
const body = { fontFamily: fonts.ui, fontSize: 16, lineHeight: 24 };
const small = { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20 };
const button = { fontFamily: fonts.uiBold, fontSize: 16, lineHeight: 20 };
const label = {
  fontFamily: fonts.monoSemiBold,
  fontSize: 12,
  lineHeight: 16,
  letterSpacing: 0.96,
  textTransform: 'uppercase' as const,
};
const price = { fontFamily: fonts.monoSemiBold, fontSize: 17, lineHeight: 22 };

export const typography = {
  display,
  title,
  heading,
  body,
  small,
  button,
  label,
  price,
  // Older names, still used across the screens. Each points at its new style
  // until the screens move over to the names above.
  h1: display,
  h2: title,
  h3: heading,
  body1: body,
  body2: small,
  caption: label,
};
