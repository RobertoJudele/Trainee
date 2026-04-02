import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { StripeProvider } from "@stripe/stripe-react-native";
import { store } from "./store";

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.example.trainee"
      urlScheme="trainee"
    >
      <Provider store={store}>
        <Stack>
          <Stack.Screen name="index" options={{ title: "Home" }} />
          <Stack.Screen name="login" options={{ title: "Login" }} />
          <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
          <Stack.Screen name="search" options={{ title: "Find Trainers" }} />
          <Stack.Screen name="map" options={{ title: "Map" }} />
          <Stack.Screen name="trainers/[id]" options={{ title: "Trainer Details" }} />
          <Stack.Screen name="my-gyms" options={{ title: "My Gyms" }} />
          <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
          <Stack.Screen name="report-issue" options={{ title: "Report Issue" }} />
          <Stack.Screen name="admin-issues" options={{ title: "Admin Issues" }} />
          <Stack.Screen name="trainer-schedule" options={{ title: "Trainer Schedule" }} />
          <Stack.Screen name="trainer-schedule/[date]" options={{ title: "Day Schedule" }} />
          <Stack.Screen name="my-schedule" options={{ title: "My Schedule" }} />
          <Stack.Screen name="forgot-password" options={{ title: "Forgot Password" }} />
          <Stack.Screen name="reset-password" options={{ title: "Reset Password" }} />
        </Stack>
      </Provider>
    </StripeProvider>
  );
}
