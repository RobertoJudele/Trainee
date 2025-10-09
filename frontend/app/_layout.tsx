import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { store } from "./store";

export default function RootLayout() {
  return (
    <Provider store={store}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Home" }} />
        <Stack.Screen name="login" options={{ title: "Login" }} />

        <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
      </Stack>
    </Provider>
  );
}
