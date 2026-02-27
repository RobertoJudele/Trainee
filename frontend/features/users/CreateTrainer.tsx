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
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
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

  const validateForm = () => {
    if (!bio.trim()) {
      setErrMsg("Bio is required");
      return false;
    }
    if (!exp.trim()) {
      setErrMsg("Experience is required");
      return false;
    }
    if (!hourlyRate.trim()) {
      setErrMsg("Hourly rate is required");
      return false;
    }
    if (!sessionRate.trim()) {
      setErrMsg("Session rate is required");
      return false;
    }
    if (!city.trim()) {
      setErrMsg("City is required");
      return false;
    }
    if (!county.trim()) {
      setErrMsg("County is required");
      return false;
    }
    if (!country.trim()) {
      setErrMsg("Country is required");
      return false;
    }

    // Validate rates are numbers
    if (isNaN(parseFloat(hourlyRate)) || parseFloat(hourlyRate) <= 0) {
      setErrMsg("Please enter a valid hourly rate");
      return false;
    }
    if (isNaN(parseFloat(sessionRate)) || parseFloat(sessionRate) <= 0) {
      setErrMsg("Please enter a valid session rate");
      return false;
    }

    return true;
  };

  const handleSubmit = useCallback(async () => {
    console.log("Create button pressed!");
    
    if (!validateForm()) {
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

      Alert.alert(
        "Success! 🎉",
        "Your trainer profile has been created successfully!",
        [
          {
            text: "Continue",
            onPress: () => router.push("/"),
          },
        ]
      );
    } catch (error: any) {
      if (!error.originalStatus) {
        setErrMsg("No server response. Please check your connection.");
      } else if (error.response?.status === 400) {
        setErrMsg("Invalid data provided. Please check your inputs.");
      } else if (error.response?.status === 401) {
        setErrMsg("Unauthorized. Please log in again.");
      } else {
        setErrMsg("Failed to create profile. Please try again.");
      }
      errRef.current;
    }
  }, [bio, hourlyRate, sessionRate, latitude, longitude, city, country, county, exp]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>✨ Create Your Trainer Profile</Text>
          <Text style={styles.subtitle}>
            Tell us about yourself and start connecting with clients
          </Text>
        </View>

        <View style={styles.form}>
          {/* Error Message */}
          {errMsg ? (
            <View style={styles.errorContainer}>
              <Text ref={errRef} style={styles.errorText}>
                ⚠️ {errMsg}
              </Text>
            </View>
          ) : null}

          {/* Bio Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 About You</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                placeholder="Tell clients about yourself, your passion for fitness, and what makes you unique..."
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Experience *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={exp}
                placeholder="Describe your certifications, years of experience, specializations..."
                onChangeText={setExp}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Pricing Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Pricing</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Hourly Rate * ($)</Text>
                <TextInput
                  style={styles.input}
                  value={hourlyRate}
                  placeholder="50"
                  onChangeText={setHourlyRate}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Session Rate * ($)</Text>
                <TextInput
                  style={styles.input}
                  value={sessionRate}
                  placeholder="75"
                  onChangeText={setSessionRate}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Location</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={styles.input}
                value={city}
                placeholder="Enter your city"
                onChangeText={setCity}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>County *</Text>
                <TextInput
                  style={styles.input}
                  value={county}
                  placeholder="County/State"
                  onChangeText={setCounty}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Country *</Text>
                <TextInput
                  style={styles.input}
                  value={country}
                  placeholder="Country"
                  onChangeText={setCountry}
                />
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              style={[
                styles.button,
                isLoading && styles.buttonDisabled
              ]}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="white" size="small" />
                  <Text style={styles.buttonText}>Creating Profile...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>🚀 Create Trainer Profile</Text>
              )}
            </Pressable>

            <Text style={styles.footerText}>
              * Required fields
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 30,
    backgroundColor: "white",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  form: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1A1A1A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#3B82F6",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 14,
    color: "#6B7280",
    fontStyle: "italic",
  },
});
