import { useDispatch, useSelector } from "react-redux";
import {
  logOut,
  selectCurrentToken,
  selectCurrentTrainer,
  selectCurrentUser,
  setCredentials,
  setTrainerProfile,
} from "../../features/auth/authSlice";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import { UserRole } from "../../features/auth/authApiSlice";
import {
  useDeleteTrainerProfileMutation,
  useGetTrainerProfileQuery,
} from "../../features/trainer/trainerApiSlice";
import { useCallback, useEffect } from "react";
import TrainerProfile from "../../features/trainer/TrainerProfile";
import { useDeleteProfileMutation } from "../../features/users/usersApiSlicet";

const Welcome = () => {
  const user = useSelector(selectCurrentUser);
  const token = useSelector(selectCurrentToken);
  const welcome = user ? `Welcome ${user.firstName}` : "Welcom";
  const tokenAbbr = `${token?.slice(0, 9)}...`;
  const trainerProfile = useSelector(selectCurrentTrainer);
  const [deleteProfile, { isLoading: isDeleting }] = useDeleteProfileMutation();
  const dispatch = useDispatch();

  const {
    data: trainerData,
    isLoading,
    isSuccess,
    isError,
  } = useGetTrainerProfileQuery(undefined, {
    skip: user?.role !== "trainer" || !!trainerProfile, // Skip dacă nu e trainer sau deja avem profile
  });

  console.log("Succes: ", isSuccess);

  useEffect(() => {
    if (isSuccess && trainerData?.data) {
      console.log("Setting trainer profile:", trainerData);

      // Only update role if it's not already set
      if (user?.role !== "trainer") {
        const updatedTrainer = { ...user, role: "trainer" as UserRole };
        dispatch(setCredentials({ user: updatedTrainer }));
      }

      dispatch(setTrainerProfile(trainerData.data));
    }
  }, [
    isSuccess,
    trainerData?.data,
    trainerProfile,
    user?.role,
    token,
    dispatch,
  ]); // ✅ Fixed dependencies

  console.log("!!!Trainer data: ", trainerProfile);

  const handleDeleteProfile = useCallback(async () => {
    await deleteProfile({});
    dispatch(logOut());
    router.push("/");
  }, []);

  const handleLogout = () => {
    dispatch(logOut());
    router.push("/");
  };

  const handleCreateTrainer = () => {
    router.push("/create-trainer");
  };
  const content = (
    <View>
      <Text>{welcome}</Text>
      <Text>{tokenAbbr}</Text>
      {user?.role === UserRole.TRAINER ? (
        <Pressable
          onPress={() => {
            router.push("/TrainerProfile");
          }}
        >
          <Text>See your trainer proile</Text>
        </Pressable>
      ) : (
        <Pressable onPress={handleCreateTrainer}>
          <Text>Create trainer profile</Text>
        </Pressable>
      )}
      <Pressable onPress={handleLogout}>
        <Text>Logout</Text>
      </Pressable>
      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleDeleteProfile}
        disabled={isDeleting}
      >
        <Text>{isLoading ? "Deleting profile..." : "Delete profile"} </Text>
      </Pressable>
    </View>
  );
  return content;
};
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
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default Welcome;
