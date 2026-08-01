import { User } from "../models/user";
import { Trainer } from "../models/trainer";
import { Gym } from "../models/gym";
import { generateToken } from "../utils/jwt";
import { UserRole } from "../types/common";
import { subStatus } from "../types/trainer";

let counter = 0;

function uniqueEmail(): string {
  counter += 1;
  return `testuser${Date.now()}${counter}@test.com`;
}

interface TestUserOverrides {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

interface TestUserResult {
  user: User;
  token: string;
}

export async function createTestUser(
  overrides?: TestUserOverrides
): Promise<TestUserResult> {
  const user = await User.create({
    email: overrides?.email ?? uniqueEmail(),
    password: overrides?.password ?? "Test123!",
    firstName: overrides?.firstName ?? "Test",
    lastName: overrides?.lastName ?? "User",
    role: (overrides?.role ?? "client") as any,
  });

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });

  return { user, token };
}

interface TestTrainerOverrides extends TestUserOverrides {
  bio?: string;
  experienceYears?: number;
  locationCity?: string;
  locationState?: string;
}

interface TestTrainerResult extends TestUserResult {
  trainer: Trainer;
}

export async function createTestTrainer(
  overrides?: TestTrainerOverrides
): Promise<TestTrainerResult> {
  const { user, token } = await createTestUser({
    ...overrides,
    role: "trainer",
  });

  const trainer = await Trainer.create({
    userId: user.id,
    bio: overrides?.bio ?? "Test trainer bio",
    experienceYears: overrides?.experienceYears ?? 5,
    locationCity: overrides?.locationCity ?? "Bucharest",
    locationState: overrides?.locationState ?? "Bucharest",
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    subscriptionStatus: subStatus.TRIAL,
    stripeCustomerId: "",
    stripeSubscriptionId: "",
  });

  return { user, trainer, token };
}

export async function createTestAdmin(
  overrides?: TestUserOverrides
): Promise<TestUserResult> {
  return createTestUser({ ...overrides, role: "admin" });
}

interface TestGymOverrides {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface TestGymResult {
  gym: Gym;
}

export async function createTestGym(
  overrides?: TestGymOverrides
): Promise<TestGymResult> {
  counter += 1;
  const gym = await Gym.create({
    name: overrides?.name ?? `Test Gym ${counter}`,
    address: overrides?.address ?? "123 Test Street",
    city: overrides?.city ?? "Bucharest",
    state: overrides?.state ?? "Bucharest",
    country: overrides?.country ?? "Romania",
    latitude: overrides?.latitude ?? 44.4268,
    longitude: overrides?.longitude ?? 26.1025,
  });
  return { gym };
}
