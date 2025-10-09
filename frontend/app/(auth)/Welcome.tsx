import { useSelector } from "react-redux";
import {
  selectCurrentToken,
  selectCurrentUser,
} from "../../features/auth/authSlice";
import { Pressable, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { UserRole } from "../../features/auth/authApiSlice";

const Welcome = () => {
  const user = useSelector(selectCurrentUser);
  const token = useSelector(selectCurrentToken);
  const welcome = user ? `Welcome ${user.firstName}` : "Welcom";
  const tokenAbbr = `${token?.slice(0, 9)}...`;
  const handleCreateTrainer = () => {
    router.push("/create-trainer");
  };
  const content = (
    <View>
      <Text>{welcome}</Text>
      <Text>{tokenAbbr}</Text>
      {user?.role === UserRole.TRAINER ? (
        <Pressable onPress={handleCreateTrainer}>
          <Text>Create trainer profile</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            router.push("/TrainerProfile");
          }}
        >
          <Text>See your trainer profile</Text>
        </Pressable>
      )}
    </View>
  );
  return content;
};

export default Welcome;
