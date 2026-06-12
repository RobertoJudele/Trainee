// frontend/src/components/ui/index.tsx
// A small, dependency-free animated UI kit built on React Native's Animated API.
// Provides consistent motion (entrance, press, focus) across every screen.
import React, { useEffect, useRef, useState } from 'react';
import {
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, typography } from '../../lib/theme';

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
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
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
    Animated.spring(scale, {
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
/*  GradientButton — primary CTA with gradient fill, icon, loading + press.    */
/* -------------------------------------------------------------------------- */
export function GradientButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  iconRight,
  style,
  colors = theme.gradients.primary,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  colors?: readonly [string, string, ...string[]];
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const animate = (toValue: number) =>
    Animated.spring(scale, {
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
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <Animated.View style={[{ transform: [{ scale }] }, isDisabled && { opacity: 0.6 }, style]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={btn.gradient}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={btn.row}>
              {icon ? <Ionicons name={icon} size={20} color="#FFFFFF" /> : null}
              <Text style={btn.text}>{title}</Text>
              {iconRight ? <Ionicons name={iconRight} size={20} color="#FFFFFF" /> : null}
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  OutlineButton — secondary action with press scale.                         */
/* -------------------------------------------------------------------------- */
export function OutlineButton({
  title,
  onPress,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      style={[btn.outline, style]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <Text style={btn.outlineText}>{title}</Text>
    </PressableScale>
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
        outputRange: [theme.colors.border, theme.colors.primary],
      });

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {label ? <Text style={field.label}>{label}</Text> : null}
      <Animated.View
        style={[
          field.wrap,
          {
            borderColor,
            shadowOpacity: focus.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
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

const btn = StyleSheet.create({
  gradient: {
    borderRadius: theme.roundness,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  text: { ...typography.h3, color: '#FFFFFF', fontWeight: '700' },
  outline: {
    borderRadius: theme.roundness,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: 'transparent',
  },
  outlineText: { ...typography.h3, color: theme.colors.primary, fontWeight: '700' },
});

const field = StyleSheet.create({
  label: { ...typography.body2, fontWeight: '600', color: theme.colors.text },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderRadius: theme.roundness,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 0,
  },
  input: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    ...typography.body1,
    color: theme.colors.text,
  },
  eye: { paddingHorizontal: theme.spacing.md },
  error: { ...typography.caption, color: theme.colors.error, textTransform: 'none' },
});
