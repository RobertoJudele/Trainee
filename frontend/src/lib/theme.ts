import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

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

export const typography = {
  h1: {
    fontSize: 34,
    fontWeight: '800' as const,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 26,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    textTransform: 'uppercase' as const,
  },
};
