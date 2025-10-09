import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Button,
  TouchableOpacity,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import { useRef, useState, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import { router } from "expo-router";
import { setCredentials } from "../../features/auth/authSlice";
import { useLoginMutation } from "../../features/auth/authApiSlice";

export default function Login() {
  const userRef = useRef<TextInput>(null);
  const errRef = useRef<Text>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useDispatch();

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  useEffect(() => {
    setErrMsg("");
  }, [email, password]);

  const testButtonPress = useCallback(() => {
    console.log("🟢 TEST BUTTON PRESSED - buttons are working!");
  }, []);

  const handleSubmit = useCallback(async () => {
    console.log("🔥 Login button pressed!"); // ✅ Debug log
    console.log("Email:", email, "Password:", password);
    if (!email || !password) {
      setErrMsg("Please fill all the required fields");
      return;
    }

    try {
      const result = await login({ email, password }).unwrap();
      console.log(result);
      const { token, user } = result.data;
      dispatch(setCredentials({ user: user, token: token }));
      router.push("/(auth)/Welcome");
    } catch (error: any) {
      if (!error.originalStatus) {
        setErrMsg("No server response");
      } else if (error.response.status === 400) {
        setErrMsg("Missing username or password");
      } else if (error.response.status === 401) {
        setErrMsg("Unauthorized");
      } else {
        setErrMsg("Login failed");
      }
      errRef.current?.focus();
    }
  }, [email, password]);

  return (
    <>
      <View style={styles.container}>
        <KeyboardAvoidingView>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            keyboardType="email-address"
            placeholder="exaple@gmail.com"
            value={email}
            onChangeText={setEmail}
          ></TextInput>

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            keyboardType="default"
            secureTextEntry
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
          ></TextInput>

          <Pressable
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit} // ✅ Direct function call, not arrow function
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? "Logging in..." : "Login"}
            </Text>
          </Pressable>

          {/* ✅ Test button to verify press events work */}
          <Pressable
            style={[styles.button, { backgroundColor: "green", marginTop: 10 }]}
            onPress={() => {
              console.log("🟦 ORIGINAL BUTTON PRESSED - arrow function");
              handleSubmit();
            }}
          >
            <Text style={styles.buttonText}>Test Button</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 200,
    justifyContent: "space-between",
  },
  label: { marginTop: 30 },
  input: {
    borderColor: "#c81515ff",
    backgroundColor: "#c4bdbdff",
    borderWidth: 1,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
