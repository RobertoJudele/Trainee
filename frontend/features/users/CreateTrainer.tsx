import { useCallback, useRef, useState } from "react";
import { useCreateTrainerMutation } from "./usersApiSlicet";
import { useDispatch } from "react-redux";
import { setTrainerProfile } from "../../features/auth/authSlice";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
} from "react-native";

export default function CreateTrainer() {
  const [bio, setBio] = useState("");
  const [exp, setExp] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [sessionRate, setSessionRate] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("0");
  const [longitude, setLongitude] = useState("0");

  const errRef = useRef<Text>(null);

  const [errMsg, setErrMsg] = useState("");

  const [creatingTrainer, { isLoading }] = useCreateTrainerMutation();
  const dispatch = useDispatch();

  const handleSubmit = useCallback(async () => {
    console.log("Create button pressed!");
    if (!bio.trim()) {
      setErrMsg("Bio is required");
      return;
    }

    if (!exp.trim()) {
      setErrMsg("Experience is required");
      return;
    }

    if (!hourlyRate.trim()) {
      setErrMsg("Hourly rate is required");
      return;
    }

    if (!sessionRate.trim()) {
      setErrMsg("Session rate is required");
      return;
    }

    if (!city.trim()) {
      setErrMsg("City is required");
      return;
    }

    if (!county.trim()) {
      setErrMsg("County is required");
      return;
    }

    if (!country.trim()) {
      setErrMsg("Country is required");
      return;
    }

    setErrMsg("");

    try {
      const trainerData = {
        bio: bio.trim(),
        experience: exp.trim(),
        hourlyRate: parseFloat(hourlyRate),
        sessionRate: parseFloat(sessionRate),
        city: city.trim(),
        county: county.trim(),
        country: country.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };
      console.log("Trainer data: ", trainerData);

      const result = await creatingTrainer(trainerData);
      console.log(result);

      const { data } = result;

      dispatch(setTrainerProfile({ trainer: data }));

      //Nu s sigur ca ramane asa
      router.push("/(auth)/Welcome");
    } catch (error: any) {
      if (!error.originalStatus) {
        setErrMsg("No server response");
      } else if (error.response.status === 400) {
        setErrMsg("Missing username or password");
      } else if (error.response.status === 401) {
        setErrMsg("Unauthorized");
      } else {
        setErrMsg("Login failed");
      }
      errRef.current;
    }
  }, [
    bio,
    hourlyRate,
    sessionRate,
    latitude,
    longitude,
    city,
    country,
    county,
    exp,
  ]);
  return (
    <>
      <View>
        <KeyboardAvoidingView>
          <Text>Bio</Text>
          <TextInput
            style={styles.input}
            value={bio}
            placeholder="Tell us about yourself"
            onChangeText={setBio}
          ></TextInput>
          <Text>Experience</Text>
          <TextInput
            style={styles.input}
            value={exp}
            placeholder="Tell us about yourself"
            onChangeText={setExp}
          ></TextInput>
          <Text>Hourly rate</Text>
          <TextInput
            style={styles.input}
            value={hourlyRate}
            placeholder="Tell us about yourself"
            onChangeText={setHourlyRate}
          ></TextInput>
          <Text>Session rate</Text>
          <TextInput
            style={styles.input}
            value={sessionRate}
            placeholder="Tell us about yourself"
            onChangeText={setSessionRate}
          ></TextInput>
          <Text>City</Text>
          <TextInput
            style={styles.input}
            value={city}
            placeholder="Tell us about yourself"
            onChangeText={setCity}
          ></TextInput>
          <Text>County</Text>
          <TextInput
            style={styles.input}
            value={county}
            placeholder="Tell us about yourself"
            onChangeText={setCounty}
          ></TextInput>
          <Text>Country</Text>
          <TextInput
            style={styles.input}
            value={country}
            placeholder="Tell us about yourself"
            onChangeText={setCountry}
          ></TextInput>

          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            style={[styles.button, isLoading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              {isLoading
                ? "Creating profile..."
                : "Create trainer profile"}{" "}
            </Text>
          </Pressable>
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
