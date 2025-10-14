import { Button, Pressable, View, Text } from "react-native";
import { Link } from "expo-router";
import { useEffect } from "react";
import { useSearchTrainerQuery } from "../../features/trainer/trainerApiSlice";
export default function Home() {
  const {
    data: trainers,
    isLoading,
    isSuccess,
    isError,
    error,
    refetch,
  } = useSearchTrainerQuery();
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
      <Link href="/trainersIndex"></Link>
    </View>
  );
}
