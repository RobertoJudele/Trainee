// frontend/src/components/ui/index.tsx
// A small, dependency-free animated UI kit built on React Native's Animated API.
// Provides consistent motion (entrance, press, focus) across every screen.
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { presets, theme, typography } from '../../lib/theme';
import { fonts } from '../../lib/fonts';

// Mirrors the system "Reduce Motion" setting. Read at render time rather than
// through state: a screen that mounts after the setting changes picks it up, and
// no component re-renders just because the setting flipped.
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotion = v; }).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });

/* -------------------------------------------------------------------------- */
/*  FadeInUp — entrance animation (fade + rise). Use `delay` to stagger.       */
/* -------------------------------------------------------------------------- */
export function FadeInUp({
  children,
  delay = 0,
  distance = 18,
  duration = theme.motion.base,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      // Entrance animations must never decide whether content is visible. Stopping a
      // staggered card before its `delay` elapses used to freeze progress at 0 — the
      // row stayed mounted and fully transparent, and nothing re-ran this effect to
      // recover it. If we get interrupted, snap to the final state instead.
      if (!finished) progress.setValue(1);
    });

    // Failsafe. The callback above only fires if the driver reports back, and a
    // native-driven node can be detached mid-flight when a FlatList recycles the cell
    // — leaving a row that occupies space and takes touches while painting nothing.
    // Past this deadline the entrance has had its chance; show the content regardless.
    const failsafe = setTimeout(() => progress.setValue(1), delay + duration + 250);

    return () => {
      clearTimeout(failsafe);
      anim.stop();
    };
  }, [delay, duration, progress]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  PressableScale — springs down slightly when pressed for tactile feedback.  */
/* -------------------------------------------------------------------------- */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  onPress,
  ...rest
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (toValue: number) =>
    !reduceMotion && Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      onPress={onPress}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  Button — the one button. Solid, no gradients.                              */
/*    primary   green, the main action on a screen (one per screen)            */
/*    secondary outlined, the alternative next to a primary                    */
/*    ghost     text only, low-emphasis actions                                */
/*    danger    red, destructive actions                                       */
/*  Sizes: lg 52 (main actions), md 44, sm 36 (+ hitSlop, so taps reach 44).   */
/* -------------------------------------------------------------------------- */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

const BUTTON_HEIGHT: Record<ButtonSize, number> = { lg: 52, md: 44, sm: 36 };

const BUTTON_COLORS: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: theme.colors.primary, pressed: theme.colors.primaryPressed, fg: '#FFFFFF' },
  secondary: { bg: theme.colors.surface, pressed: theme.colors.surfaceSunken, fg: theme.colors.text, border: theme.colors.borderStrong },
  ghost: { bg: 'transparent', pressed: theme.colors.surfaceSunken, fg: theme.colors.primary },
  danger: { bg: theme.colors.error, pressed: theme.colors.errorPressed, fg: '#FFFFFF' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;
  const c = BUTTON_COLORS[variant];
  const fg = isDisabled && variant !== 'ghost' ? theme.colors.textDisabled : c.fg;
  const iconSize = size === 'sm' ? 16 : 20;

  const animate = (toValue: number) =>
    !reduceMotion && Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPressIn={() => !isDisabled && animate(0.97)}
      onPressOut={() => animate(1)}
      onPress={isDisabled ? undefined : onPress}
      hitSlop={size === 'sm' ? 4 : undefined}
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? title}
      style={style}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            btn.base,
            {
              height: BUTTON_HEIGHT[size],
              paddingHorizontal: size === 'sm' ? 14 : 20,
              backgroundColor: isDisabled && variant !== 'ghost'
                ? theme.colors.surfaceSunken
                : pressed ? c.pressed : c.bg,
              borderWidth: c.border ? 1.5 : 0,
              borderColor: c.border,
              transform: [{ scale }],
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <>
              {icon ? <Ionicons name={icon} size={iconSize} color={fg} /> : null}
              <Text
                style={[size === 'sm' ? btn.textSmall : btn.text, { color: fg }]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {iconRight ? <Ionicons name={iconRight} size={iconSize} color={fg} /> : null}
            </>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Older name for a primary Button; `colors` is ignored now that buttons are solid. */
export function GradientButton({
  colors: _colors,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'variant'> & { colors?: readonly string[] }) {
  return <Button {...props} variant="primary" />;
}

/** Older name for a secondary Button. */
export function OutlineButton(props: Omit<React.ComponentProps<typeof Button>, 'variant'>) {
  return <Button {...props} variant="secondary" />;
}

/* -------------------------------------------------------------------------- */
/*  Card — flat white panel with a hairline border. `raised` adds a shadow,    */
/*  for things that float over the screen. With onPress it is tappable.       */
/* -------------------------------------------------------------------------- */
export function Card({
  children,
  raised = false,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  raised?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const surface = [raised ? presets.cardRaised : presets.card, { padding: 16 }, style];
  if (!onPress) return <View style={surface}>{children}</View>;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      style={surface}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </PressableScale>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chip — pill for filters and tags. Selected is ink with white text.         */
/* -------------------------------------------------------------------------- */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
  style,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const fg = selected ? '#FFFFFF' : disabled ? theme.colors.textDisabled : theme.colors.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={4}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        presets.chip,
        selected && presets.chipSelected,
        pressed && !selected && { backgroundColor: theme.colors.surfaceSunken },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <Text style={[presets.chipText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  Field — text input with animated focus border, error state + password eye. */
/* -------------------------------------------------------------------------- */
export function Field({
  label,
  error,
  secure = false,
  containerStyle,
  ...inputProps
}: TextInputProps & {
  label?: string;
  error?: string;
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const focus = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  useEffect(() => {
    Animated.timing(focus, {
      toValue: focused ? 1 : 0,
      duration: theme.motion.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [focused, focus]);

  const borderColor = error
    ? theme.colors.error
    : focus.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.colors.borderInput, theme.colors.primary],
      });

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {label ? <Text style={field.label}>{label}</Text> : null}
      <Animated.View
        style={[
          field.wrap,
          {
            borderColor,
            borderWidth: focused || error ? 2 : 1,
          },
        ]}
      >
        <TextInput
          style={field.input}
          placeholderTextColor={theme.colors.textSecondary}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          {...inputProps}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            style={field.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </Animated.View>
      {error ? <Text style={field.error}>{error}</Text> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  FieldError — the validation message under a field. Renders nothing without */
/*  a message; announced by screen readers when it appears.                    */
/* -------------------------------------------------------------------------- */
export function FieldError({ message, style }: { message?: string; style?: StyleProp<ViewStyle> }) {
  if (!message) return null;
  return (
    <View style={[fieldError.row, style]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
      <Text style={fieldError.text}>{message}</Text>
    </View>
  );
}

const fieldError = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  text: { ...typography.small, color: theme.colors.error, flex: 1 },
});

const btn = StyleSheet.create({
  base: {
    borderRadius: theme.radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  text: { ...typography.button },
  textSmall: { ...typography.button, fontSize: 14 },
});

const field = StyleSheet.create({
  label: { ...typography.body2, fontFamily: fonts.uiSemiBold, color: theme.colors.text },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...typography.body,
    color: theme.colors.text,
  },
  eye: { paddingHorizontal: theme.spacing.md },
  error: { ...typography.small, color: theme.colors.error },
});
