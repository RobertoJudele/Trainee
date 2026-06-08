import { Stack } from "expo-router";
import { theme } from "../../src/lib/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationDuration: 260,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
