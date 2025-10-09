import { Button, Pressable, View, Text } from "react-native";
import { Link } from "expo-router";
export default function Home() {
  return (
    <View>
      <Link href="/signup" asChild>
        <Button title="Test signup screen" />
      </Link>
      <Link href="/login">
        <Pressable>
          <Text>Login</Text>
        </Pressable>
      </Link>
    </View>
  );
}
