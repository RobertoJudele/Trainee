import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";

const { height: SCREEN_H } = Dimensions.get("window");

export interface ProfileMenuItem {
  key: string;
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
  trailing?: React.ReactNode;
}

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
  items: ProfileMenuItem[];
  dividerAfter?: number[];
}

export default function ProfileMenuModal({
  visible,
  onClose,
  items,
  dividerAfter = [],
}: ProfileMenuModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.menu}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {items.map((item, index) => (
              <React.Fragment key={item.key}>
                <Pressable
                  style={styles.item}
                  onPress={item.onPress}
                  disabled={item.disabled}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  {item.loading ? (
                    <ActivityIndicator
                      size="small"
                      color={item.destructive ? theme.colors.error : theme.colors.text}
                    />
                  ) : (
                    <Ionicons
                      name={item.icon as any}
                      size={18}
                      color={item.destructive ? theme.colors.error : theme.colors.text}
                    />
                  )}
                  <Text
                    style={[
                      styles.itemText,
                      item.destructive && { color: theme.colors.error },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.trailing}
                </Pressable>
                {dividerAfter.includes(index) && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: 16,
  },
  menu: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 200,
    maxHeight: SCREEN_H * 0.7,
    ...theme.shadows.medium,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  itemText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: "500",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
    marginHorizontal: 16,
  },
});
