import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { useSelector } from "react-redux";
import { selectCurrentTrainer } from "../auth/authSlice";

function TrainerProfile() {
  useEffect(() => {});
  const trainer = useSelector(selectCurrentTrainer);

  return (
    <View>
      <Text>{`Bio: ${trainer?.bio}`}</Text>
    </View>
  );
}

export default TrainerProfile;
