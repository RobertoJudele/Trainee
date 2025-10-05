import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Button,
  TouchableOpacity,
  KeyboardAvoidingView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
export default function SignUp() {
  return (
    <>
      <View style={styles.container}>
        <KeyboardAvoidingView>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            keyboardType="default"
            placeholder="John"
          ></TextInput>

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            keyboardType="default"
            placeholder="Doe"
          ></TextInput>

          <Text style={styles.label}>EmailTextText</Text>
          <TextInput
            style={styles.input}
            keyboardType="email-address"
            placeholder="exaple@gmail.com"
          ></TextInput>

          <Text style={styles.label}>PasswordTextText</Text>
          <TextInput
            style={styles.input}
            keyboardType="default"
            secureTextEntry
            placeholder="Password"
          ></TextInput>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} keyboardType="default"></TextInput>
          <Button title="Create account" />
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
