import { Specialization } from "../models/specialization";

export const seedSpecializations = async () => {
  try {
    const specializationsData = [
      {
        name: "Strength Training",
        description: "Building muscle and strength through resistance training.",
        iconUrl: "barbell",
        isActive: true,
      },
      {
        name: "Weight Loss",
        description: "Programs focused on fat loss and sustainable weight management.",
        iconUrl: "scale",
        isActive: true,
      },
      {
        name: "Bodybuilding",
        description: "Hypertrophy-focused training for muscle size and physique.",
        iconUrl: "body",
        isActive: true,
      },
      {
        name: "Functional Training",
        description: "Movement-based training that improves everyday strength and coordination.",
        iconUrl: "fitness",
        isActive: true,
      },
      {
        name: "HIIT",
        description: "High-intensity interval training for cardio and fat burning.",
        iconUrl: "flash",
        isActive: true,
      },
      {
        name: "Powerlifting",
        description: "Squat, bench press and deadlift focused strength training.",
        iconUrl: "trophy",
        isActive: true,
      },
      {
        name: "Rehabilitation",
        description: "Injury recovery and post-rehab strengthening programs.",
        iconUrl: "medkit",
        isActive: true,
      },
      {
        name: "Mobility & Flexibility",
        description: "Stretching and mobility work to improve range of motion.",
        iconUrl: "body-outline",
        isActive: true,
      },
      {
        name: "Sports Performance",
        description: "Athletic performance training for speed, power and agility.",
        iconUrl: "football",
        isActive: true,
      },
      {
        name: "Prenatal & Postnatal",
        description: "Safe training programs for during and after pregnancy.",
        iconUrl: "heart",
        isActive: true,
      },
      {
        name: "Yoga",
        description: "Yoga-based training for flexibility, balance and mindfulness.",
        iconUrl: "leaf",
        isActive: true,
      },
      {
        name: "Pilates",
        description: "Core-focused, low-impact training for strength and posture.",
        iconUrl: "body",
        isActive: true,
      },
      {
        name: "CrossFit",
        description: "Varied, high-intensity functional movements performed at a high pace.",
        iconUrl: "barbell-outline",
        isActive: true,
      },
      {
        name: "Cardio Conditioning",
        description: "Endurance-focused cardiovascular training programs.",
        iconUrl: "heart-circle",
        isActive: true,
      },
      {
        name: "Nutrition Coaching",
        description: "Diet and nutrition guidance to support fitness goals.",
        iconUrl: "nutrition",
        isActive: true,
      },
      {
        name: "Senior Fitness",
        description: "Low-impact training tailored for older adults.",
        iconUrl: "walk",
        isActive: true,
      },
      {
        name: "Boxing & Kickboxing",
        description: "Combat-sport inspired conditioning and technique training.",
        iconUrl: "hand-left",
        isActive: true,
      },
      {
        name: "Calisthenics",
        description: "Bodyweight strength and skill training.",
        iconUrl: "body-sharp",
        isActive: true,
      },
      {
        name: "Endurance & Marathon Training",
        description: "Structured programs for distance running and endurance events.",
        iconUrl: "speedometer",
        isActive: true,
      },
      {
        name: "Group Fitness & Bootcamp",
        description: "High-energy group workouts and bootcamp-style classes.",
        iconUrl: "people",
        isActive: true,
      },
    ];

    for (const spec of specializationsData) {
      // Folosim findOrCreate pentru a evita duplicarea datelor dacă rulezi seed-ul de mai multe ori
      await Specialization.findOrCreate({
        where: { name: spec.name },
        defaults: spec
      });
    }

    console.log("✅ Seed-ul pentru specializări a rulat cu succes!");
  } catch (error) {
    console.error("❌ Eroare la rularea seed-ului pentru specializări:", error);
  }
};