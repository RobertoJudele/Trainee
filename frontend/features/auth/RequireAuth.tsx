import { useSelector } from "react-redux";
import { selectCurrentToken } from "./authSlice";

import React, { useEffect } from "react";
import { View } from "react-native";
import { useRouter, useSegments } from "expo-router";

const RequireAuth = () => {
  const token = useSelector(selectCurrentToken);
  const segments = useSegments();
  const router = useRouter();
  const inAuthGroup = segments[0] === "(auth)";
  console.log("Current segments: ", segments);
  console.log("In auth group:", inAuthGroup);

  useEffect(() => {
    if (!token && !inAuthGroup) {
      router.replace("/login");
    } else if (token && inAuthGroup) {
      router.replace("/");
    }
  }, [token, segments]);

  return <View>RequireAuth</View>;
};

export default RequireAuth;
