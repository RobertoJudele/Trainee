import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface StarRatingProps {
  rating: number;
  size?: number;
  maxStars?: number;
}

export default function StarRating({ rating, size = 14, maxStars = 5 }: StarRatingProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {Array.from({ length: maxStars }, (_, i) => (
        <Ionicons
          key={i}
          name={i < Math.floor(rating) ? "star" : "star-outline"}
          size={size}
          color={i < Math.floor(rating) ? "#F59E0B" : "#E5E7EB"}
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  );
}
