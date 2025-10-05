import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "react-native";
import { RootStackParamList } from "../types/navigation";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function Home() {
  const navigation = useNavigation<NavigationProp>();
  return (
    <Button
      title="Test signup screen"
      onPress={() => navigation.navigate("SignUp")}
    />
  );
}
