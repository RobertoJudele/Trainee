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
import { useRef, useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { router } from "expo-router";
import { setCredentials } from "../../features/auth/authSlice";
import { UserRole, useSignupMutation } from "../../features/auth/authApiSlice";

export default function SignUp() {
  const userRef = useRef<TextInput>(null);
  const errRef = useRef<Text>(null);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const [signup, { isLoading }] = useSignupMutation();
  const dispatch = useDispatch();

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  useEffect(() => {
    setErrMsg("");
  }, [email, password]);

  const handleSubmit = async () => {
    if (!firstName || !lastName || !email || !password) {
      setErrMsg("Please fill all the required fields");
      return;
    }

    try {
      const result = await signup({
        email,
        password,
        phone,
        firstName,
        lastName,
        role: UserRole.CLIENT, // Default role
      }).unwrap();
      console.log(result);

      // dispatch(setCredentials({ user: result.user, token: result.token }));
      router.push("/");
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
  };

  return (
    <>
      <View style={styles.container}>
        <KeyboardAvoidingView>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            keyboardType="default"
            placeholder="John"
            value={firstName}
            onChangeText={setFirstName}
          ></TextInput>

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            keyboardType="default"
            placeholder="Doe"
            onChangeText={setLastName}
          ></TextInput>

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

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            keyboardType="default"
            value={phone}
            onChangeText={setPhone}
          ></TextInput>
          <Pressable
            style={(styles.input, styles.label)}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text>Create account</Text>
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
});
