// server/src/seeds/demoScreenshotSeed.ts
// Run with: npx ts-node src/seeds/demoScreenshotSeed.ts
// Idempotent: re-running updates the same demo rows (matched by email).
import sequelize from "../db";
import { User } from "../models/user";
import { Trainer } from "../models/trainer";
import { Specialization } from "../models/specialization";
import { TrainerPackage } from "../models/trainerPackage";
import { Review } from "../models/review";
import { TrainerGym } from "../models/trainerGym";
import { Gym } from "../models/gym";
import {
  ensureDatabaseExtensions,
  ensureSpatialAndSearchInfrastructure,
} from "../services/databaseBootstrap";

const portrait = (g: "men" | "women", n: number) =>
  `https://randomuser.me/api/portraits/${g}/${n}.jpg`;

type DemoTrainer = {
  email: string;
  firstName: string;
  lastName: string;
  photo: string;
  sex: "male" | "female";
  bio: string;
  experienceYears: number;
  hourlyRate: number;
  sessionRate: number;
  city: string;
  state: string;
  rating: number; // shown on card (4.7–5.0)
  reviewCount: number; // shown on card
  featured: boolean;
};

const DEMO_TRAINERS: DemoTrainer[] = [
  {
    email: "andrei.popescu.demo@trainee.app",
    firstName: "Andrei", lastName: "Popescu", sex: "male", photo: portrait("men", 32),
    bio: "Antrenor de forță și hipertrofie. Te ajut să construiești mușchi și să ridici corect, în siguranță.",
    experienceYears: 8, hourlyRate: 120, sessionRate: 40,
    city: "București", state: "Ilfov", rating: 4.9, reviewCount: 42, featured: true,
  },
  {
    email: "maria.ionescu.demo@trainee.app",
    firstName: "Maria", lastName: "Ionescu", sex: "female", photo: portrait("women", 44),
    bio: "Fitness funcțional și nutriție. Programe personalizate pentru energie și echilibru.",
    experienceYears: 6, hourlyRate: 110, sessionRate: 45,
    city: "București", state: "Ilfov", rating: 5.0, reviewCount: 28, featured: false,
  },
  {
    email: "elena.dumitru.demo@trainee.app",
    firstName: "Elena", lastName: "Dumitru", sex: "female", photo: portrait("women", 68),
    bio: "Yoga și mobilitate. Recâștigă-ți flexibilitatea și scapă de tensiune.",
    experienceYears: 5, hourlyRate: 95, sessionRate: 38,
    city: "Cluj-Napoca", state: "Cluj", rating: 4.8, reviewCount: 31, featured: false,
  },
  {
    email: "cristian.stan.demo@trainee.app",
    firstName: "Cristian", lastName: "Stan", sex: "male", photo: portrait("men", 51),
    bio: "CrossFit și condiție fizică. Antrenamente intense, rezultate vizibile.",
    experienceYears: 7, hourlyRate: 115, sessionRate: 42,
    city: "Timișoara", state: "Timiș", rating: 4.7, reviewCount: 19, featured: false,
  },
  {
    email: "alexandru.radu.demo@trainee.app",
    firstName: "Alexandru", lastName: "Radu", sex: "male", photo: portrait("men", 12),
    bio: "Slăbire și cardio. Te aduc în cea mai bună formă a ta, pas cu pas.",
    experienceYears: 4, hourlyRate: 90, sessionRate: 35,
    city: "București", state: "Ilfov", rating: 4.9, reviewCount: 23, featured: false,
  },
];

const DEMO_CLIENTS = [
  { email: "client1.demo@trainee.app", firstName: "Ioana", lastName: "Marin", sex: "female" as const, photo: portrait("women", 21) },
  { email: "client2.demo@trainee.app", firstName: "Vlad", lastName: "Georgescu", sex: "male" as const, photo: portrait("men", 5) },
  { email: "client3.demo@trainee.app", firstName: "Diana", lastName: "Petre", sex: "female" as const, photo: portrait("women", 9) },
];

// Reviews shown on the flagship trainer detail (frame 2). review_text must be 10–100 chars.
const FLAGSHIP_REVIEWS = [
  { rating: 5, text: "Cel mai bun antrenor cu care am lucrat. Rezultate reale în 3 luni!" },
  { rating: 5, text: "Profesionist, atent și mereu punctual. Recomand cu încredere." },
  { rating: 4, text: "Ședințe bine structurate, am învățat tehnica corectă de la zero." },
];

// Packages on the flagship (frame 4). Lowest per-session = 800/20 = 40 → matches sessionRate.
const FLAGSHIP_PACKAGES = [
  { name: "Start", price: 250, sessionCount: 5, sortOrder: 0 },
  { name: "Popular", price: 450, sessionCount: 10, sortOrder: 1 },
  { name: "Pro", price: 800, sessionCount: 20, sortOrder: 2 },
];

async function upsertUser(args: {
  email: string; firstName: string; lastName: string; role: "trainer" | "client";
  sex: "male" | "female"; photo: string;
}): Promise<User> {
  const [user] = await User.findOrCreate({
    where: { email: args.email },
    defaults: {
      email: args.email,
      password: "DemoPass123!", // hashed by the User beforeCreate hook
      firstName: args.firstName,
      lastName: args.lastName,
      role: args.role,
      sex: args.sex,
      profileImageUrl: args.photo,
      isVerified: true,
      isActive: true,
    } as any,
  });
  // keep photo/name fresh on re-runs
  await user.update({ firstName: args.firstName, lastName: args.lastName, profileImageUrl: args.photo });
  return user;
}

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");
    await ensureDatabaseExtensions();
    await sequelize.sync({ alter: true });
    await ensureSpatialAndSearchInfrastructure();
    console.log("✅ Models synced");

    const specs = await Specialization.findAll();
    if (specs.length === 0) {
      throw new Error("No specializations found — run `npm run seed:specializations` first (Task 1).");
    }
    const gyms = await Gym.findAll({ limit: 5 });
    if (gyms.length === 0) {
      throw new Error("No gyms found — run `npm run seed:gyms` first (Task 1).");
    }

    // demo clients (for reviews)
    const clientUsers: User[] = [];
    for (const c of DEMO_CLIENTS) {
      clientUsers.push(await upsertUser({ ...c, role: "client" }));
    }

    let flagshipTrainerId: number | null = null;

    for (let i = 0; i < DEMO_TRAINERS.length; i++) {
      const d = DEMO_TRAINERS[i];
      const user = await upsertUser({
        email: d.email, firstName: d.firstName, lastName: d.lastName,
        role: "trainer", sex: d.sex, photo: d.photo,
      });

      const [trainer] = await Trainer.findOrCreate({
        where: { userId: user.id },
        defaults: {
          userId: user.id,
          bio: d.bio,
          experienceYears: d.experienceYears,
          hourlyRate: d.hourlyRate,
          sessionRate: d.sessionRate,
          locationCity: d.city,
          locationState: d.state,
          locationCountry: "Romania",
          isAvailable: true,
          isFeatured: d.featured,
          subscriptionStatus: "active", // ensures it shows in search
          billingProvider: "none",
        } as any,
      });
      await trainer.update({
        bio: d.bio, experienceYears: d.experienceYears, hourlyRate: d.hourlyRate,
        sessionRate: d.sessionRate, locationCity: d.city, locationState: d.state,
        locationCountry: "Romania", isAvailable: true, isFeatured: d.featured,
        subscriptionStatus: "active", billingProvider: "none",
      } as any);

      // assign 2 specializations
      const chosen = [specs[i % specs.length], specs[(i + 1) % specs.length]];
      await (trainer as any).$set("specializations", chosen);

      // link to 2 gyms (for the map frame)
      await TrainerGym.destroy({ where: { trainerId: trainer.id } });
      for (const g of gyms.slice(0, 2)) {
        await TrainerGym.create({ trainerId: trainer.id, gymId: g.id, isAvailable: true } as any);
      }

      if (d.featured) {
        flagshipTrainerId = trainer.id;

        // packages (frame 4)
        await TrainerPackage.destroy({ where: { trainerId: trainer.id } });
        for (const p of FLAGSHIP_PACKAGES) {
          await TrainerPackage.create({ trainerId: trainer.id, ...p } as any);
        }

        // text reviews (frame 2) — triggers rating recompute via Review hook
        await Review.destroy({ where: { trainerId: trainer.id } });
        for (let r = 0; r < FLAGSHIP_REVIEWS.length; r++) {
          await Review.create({
            trainerId: trainer.id,
            clientId: clientUsers[r % clientUsers.length].id,
            rating: FLAGSHIP_REVIEWS[r].rating,
            reviewText: FLAGSHIP_REVIEWS[r].text,
            isVerified: true,
          } as any);
        }
      }

      // Override rating/count for a polished card look (set AFTER reviews so the
      // Review hook doesn't clobber it). Persists because Trainer has no rating hook.
      await trainer.update({ totalRating: d.rating, reviewCount: d.reviewCount });
      console.log(`✅ Trainer ready: ${d.firstName} ${d.lastName} (id=${trainer.id})`);
    }

    console.log(`✅ Demo seed complete. Flagship trainer id = ${flagshipTrainerId}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Demo seed failed:", error);
    process.exit(1);
  }
}

seed();
