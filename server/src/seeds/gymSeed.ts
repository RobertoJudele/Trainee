// server/src/seeds/gymSeed.ts
// Run with: npx ts-node src/seeds/gymSeed.ts

import sequelize from "../db";
import { Gym } from "../models/gym";

const gyms = [
  {
    name: "FitZone Central",
    address: "Calea Victoriei 45",
    city: "Bucharest",
    state: "Ilfov",
    country: "Romania",
    latitude: 44.4368,
    longitude: 26.0977,
    phone: "+40721000001",
    openingHours: "Mon-Fri 06:00-23:00, Sat-Sun 08:00-21:00",
  },
  {
    name: "PowerHouse Gym",
    address: "Bd. Unirii 12",
    city: "Bucharest",
    state: "Ilfov",
    country: "Romania",
    latitude: 44.4282,
    longitude: 26.1044,
    phone: "+40721000002",
    openingHours: "Mon-Sun 07:00-22:00",
  },
  {
    name: "Iron Temple",
    address: "Str. Floreasca 88",
    city: "Bucharest",
    state: "Ilfov",
    country: "Romania",
    latitude: 44.4612,
    longitude: 26.1021,
    phone: "+40721000003",
    openingHours: "Mon-Fri 06:30-22:30, Sat 08:00-20:00, Sun 09:00-18:00",
  },
  {
    name: "Olympus Fitness",
    address: "Bd. Dacia 77",
    city: "Bucharest",
    state: "Ilfov",
    country: "Romania",
    latitude: 44.4489,
    longitude: 26.0892,
    phone: "+40721000004",
    openingHours: "Mon-Fri 07:00-22:00, Sat-Sun 09:00-19:00",
  },
  {
    name: "CrossFit Titan",
    address: "Str. Aviatorilor 30",
    city: "Bucharest",
    state: "Ilfov",
    country: "Romania",
    latitude: 44.4698,
    longitude: 26.0834,
    phone: "+40721000005",
    openingHours: "Mon-Sat 06:00-21:00, Sun 08:00-16:00",
  },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    await sequelize.sync({ alter: true });
    console.log("✅ Models synced");

    for (const gym of gyms) {
      const [instance, created] = await Gym.findOrCreate({
        where: { name: gym.name, city: gym.city },
        defaults: gym,
      });
      console.log(`${created ? "✅ Created" : "⏭️  Exists"}: ${instance.name}`);
    }

    console.log("✅ Gym seed complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();