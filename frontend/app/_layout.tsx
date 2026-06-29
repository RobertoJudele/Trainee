import { Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Provider } from "react-redux";
import { useSelector } from "react-redux";
import { StripeProvider } from "@stripe/stripe-react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import { store, persistor } from "./store";
import { PersistGate } from "redux-persist/integration/react";
import { selectCurrentUser } from "../features/auth/authSlice";
import { theme } from "../src/lib/theme";
import { StatusBar } from "expo-status-bar";
import { TourProvider } from "../src/components/onboarding/TourContext";
import CoachMark from "../src/components/onboarding/CoachMark";
import TourGate from "../src/components/onboarding/TourGate";
import { LanguageProvider } from "../src/lib/i18n/LanguageContext";

const isNativeBillingPlatform = Platform.OS === "ios" || Platform.OS === "android";

let hasConfiguredRevenueCat = false;

const getRevenueCatApiKey = () => {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || "";
  }

  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || "";
  }

  return "";
};

function RevenueCatIdentityBridge() {
  const user = useSelector(selectCurrentUser);
  const lastRevenueCatUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isNativeBillingPlatform) {
      return;
    }

    let isCancelled = false;

    const syncRevenueCatIdentity = async () => {
      try {
        const apiKey = getRevenueCatApiKey();
        if (!apiKey) {
          return;
        }

        if (!hasConfiguredRevenueCat) {
          Purchases.setLogLevel(
            process.env.EXPO_PUBLIC_REVENUECAT_DEBUG === "1"
              ? LOG_LEVEL.VERBOSE
              : LOG_LEVEL.INFO
          );
          await Purchases.configure({ apiKey });
          hasConfiguredRevenueCat = true;
        }

        if (isCancelled) {
          return;
        }

        const nextUserId = user?.id ? String(user.id) : null;
        const lastUserId = lastRevenueCatUserIdRef.current;

        if (!nextUserId) {
          if (lastUserId) {
            await Purchases.logOut();
            lastRevenueCatUserIdRef.current = null;
          }
          return;
        }

        if (nextUserId !== lastUserId) {
          await Purchases.logIn(nextUserId);
          lastRevenueCatUserIdRef.current = nextUserId;
        }
      } catch {
        // RevenueCat sync is best-effort — app continues without it
      }
    };

    void syncRevenueCatIdentity();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  return null;
}

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.example.trainee"
      urlScheme="trainee"
    >
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
        <LanguageProvider>
        <TourProvider>
        <RevenueCatIdentityBridge />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.primary },
            headerTintColor: "#fff",
            headerTitleStyle: { fontWeight: "bold" },
            headerShadowVisible: false,
            animation: "slide_from_right",
            animationDuration: 280,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="TrainerProfile" options={{ headerShown: false }} />
          <Stack.Screen name="UserProfile" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ title: "Find Trainers", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="map" options={{ headerShown: false }} />
          <Stack.Screen name="trainers/[id]" options={{ title: "Trainer Details", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="my-gyms" options={{ title: "My Gyms" }} />
          <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
          <Stack.Screen name="report-issue" options={{ title: "Report Issue" }} />
          <Stack.Screen name="request-gym" options={{ title: "Request a Gym" }} />
          <Stack.Screen name="admin-issues" options={{ title: "Admin Issues" }} />
          <Stack.Screen name="trainer-schedule" options={{ headerShown: false }} />
          <Stack.Screen name="trainer-schedule/[date]" options={{ headerShown: false }} />
          <Stack.Screen name="trainer-schedule/week-snapshot" options={{ title: "Week Snapshot" }} />
          <Stack.Screen name="trainer-analytics" options={{ title: "Trainer Analytics" }} />
          <Stack.Screen name="my-schedule" options={{ title: "My Schedule" }} />
          <Stack.Screen name="preferences" options={{ headerShown: false }} />
          <Stack.Screen name="legal" options={{ title: "Legal & Policies" }} />
          <Stack.Screen name="forgot-password" options={{ title: "Forgot Password" }} />
          <Stack.Screen name="reset-password" options={{ title: "Reset Password" }} />
        </Stack>
        <CoachMark />
        <TourGate />
        </TourProvider>
        </LanguageProvider>
        </PersistGate>
      </Provider>
    </StripeProvider>
  );
}
