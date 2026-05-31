// server/src/seeds/gymSeed.ts
// Run with: npx ts-node src/seeds/gymSeed.ts

import sequelize from "../db";
import { Gym } from "../models/gym";
import {
  ensureDatabaseExtensions,
  ensureSpatialAndSearchInfrastructure,
} from "../services/databaseBootstrap";
import { fetchRomaniaGymsFromGooglePlaces } from "../services/googlePlacesImport";

type SeedGym = {
  name: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  openingHours?: string;
};

type BoundingBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

const DEFAULT_OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

const configuredOverpassUrls = process.env.OSM_OVERPASS_URLS
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const singleOverpassUrl = process.env.OSM_OVERPASS_URL?.trim();

const OVERPASS_URLS =
  configuredOverpassUrls && configuredOverpassUrls.length > 0
    ? configuredOverpassUrls
    : singleOverpassUrl
      ? [singleOverpassUrl]
      : DEFAULT_OVERPASS_URLS;

const OSM_MAX_RETRIES = Math.max(0, Number(process.env.OSM_MAX_RETRIES ?? 2));
const OSM_REQUEST_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.OSM_REQUEST_TIMEOUT_MS ?? 90000)
);
const OSM_REQUEST_PAUSE_MS = Math.max(0, Number(process.env.OSM_REQUEST_PAUSE_MS ?? 600));
const IMPORT_GOOGLE_PLACES_ROMANIA = process.env.IMPORT_GOOGLE_PLACES_ROMANIA === "1";
const IMPORT_OSM_ROMANIA = process.env.IMPORT_OSM_ROMANIA === "1";

const ROMANIA_BBOXES: BoundingBox[] = [
  { south: 43.5, west: 20.2, north: 45.2, east: 24.9 },
  { south: 43.5, west: 24.9, north: 45.2, east: 29.9 },
  { south: 45.2, west: 20.2, north: 46.8, east: 24.9 },
  { south: 45.2, west: 24.9, north: 46.8, east: 29.9 },
  { south: 46.8, west: 20.2, north: 48.4, east: 24.9 },
  { south: 46.8, west: 24.9, north: 48.4, east: 29.9 },
];

const fallbackGyms: SeedGym[] = [
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

const truncate = (value: string, maxLength: number): string =>
  value.trim().slice(0, maxLength);

const buildAddress = (tags: Record<string, string>): string => {
  const street = tags["addr:street"];
  const houseNumber = tags["addr:housenumber"];
  const fullAddress = tags["addr:full"];

  if (fullAddress) {
    return truncate(fullAddress, 200);
  }

  if (street && houseNumber) {
    return truncate(`${street} ${houseNumber}`, 200);
  }

  if (street) {
    return truncate(street, 200);
  }

  return "Unknown address";
};

const pickCity = (tags: Record<string, string>): string => {
  const city =
    tags["addr:city"] ||
    tags["addr:town"] ||
    tags["addr:village"] ||
    tags["addr:municipality"] ||
    tags["addr:county"] ||
    tags["is_in:city"];

  if (!city) {
    return "Unknown city";
  }

  return truncate(city, 100);
};

const toSeedGym = (element: OverpassElement): SeedGym | null => {
  const tags = element.tags || {};

  const name = tags.name ? truncate(tags.name, 100) : "";
  if (name.length < 2) {
    return null;
  }

  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const safeLatitude = Number(latitude);
  const safeLongitude = Number(longitude);

  const phone = tags["contact:phone"] || tags.phone;
  const openingHours = tags.opening_hours;

  return {
    name,
    address: buildAddress(tags),
    city: pickCity(tags),
    state: truncate(tags["addr:state"] || tags["is_in:state"] || "Romania", 50),
    country: "Romania",
    latitude: safeLatitude,
    longitude: safeLongitude,
    phone: phone ? truncate(phone, 20) : undefined,
    openingHours: openingHours ? truncate(openingHours, 300) : undefined,
  };
};

const buildOverpassQuery = ({ south, west, north, east }: BoundingBox): string => `
[out:json][timeout:240];
(
  node["amenity"="gym"](${south},${west},${north},${east});
  way["amenity"="gym"](${south},${west},${north},${east});
  relation["amenity"="gym"](${south},${west},${north},${east});
  node["leisure"="fitness_centre"](${south},${west},${north},${east});
  way["leisure"="fitness_centre"](${south},${west},${north},${east});
  relation["leisure"="fitness_centre"](${south},${west},${north},${east});
);
out center tags;
`;
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const fetchOverpass = async (
  overpassUrl: string,
  query: string
): Promise<OverpassElement[]> => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, OSM_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(overpassUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Overpass request failed (${response.status}): ${errorText.slice(0, 300)}`
      );
    }

    const payload = (await response.json()) as OverpassResponse;
    return payload.elements ?? [];
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const fetchBoxGyms = async (bbox: BoundingBox): Promise<OverpassElement[]> => {
  const query = buildOverpassQuery(bbox);

  let attempt = 0;
  let lastError: unknown;

  const totalAttempts = OSM_MAX_RETRIES + 1;
  while (attempt < totalAttempts) {
    for (const overpassUrl of OVERPASS_URLS) {
      try {
        const result = await fetchOverpass(overpassUrl, query);
        if (attempt > 0) {
          console.log(
            `✅ Recovered bbox via ${overpassUrl} on retry ${attempt}/${OSM_MAX_RETRIES}`
          );
        }
        return result;
      } catch (error) {
        lastError = error;
        console.warn(
          `⚠️ Overpass attempt failed via ${overpassUrl} (retry ${attempt}/${OSM_MAX_RETRIES}):`,
          error
        );
      }
    }

    attempt += 1;
    if (attempt <= OSM_MAX_RETRIES) {
      await wait(500 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Overpass request failed after all retries");
};

const fetchRomaniaGymsFromOSM = async (): Promise<SeedGym[]> => {
  const osmMap = new Map<string, SeedGym>();
  const dedupeMap = new Map<string, SeedGym>();
  let failedBoxes = 0;

  for (let i = 0; i < ROMANIA_BBOXES.length; i += 1) {
    const bbox = ROMANIA_BBOXES[i];
    console.log(
      `🌍 Querying OSM gyms (${i + 1}/${ROMANIA_BBOXES.length}) for bbox ${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
    );

    try {
      const elements = await fetchBoxGyms(bbox);
      console.log(`ℹ️  Received ${elements.length} OSM elements for bbox ${i + 1}`);

      for (const element of elements) {
        const gym = toSeedGym(element);
        if (!gym) {
          continue;
        }

        const osmKey = `${element.type}:${element.id}`;
        osmMap.set(osmKey, gym);
      }
    } catch (error) {
      failedBoxes += 1;
      console.warn(`⚠️ Skipping failed bbox ${i + 1}:`, error);
    }

    if (OSM_REQUEST_PAUSE_MS > 0 && i < ROMANIA_BBOXES.length - 1) {
      await wait(OSM_REQUEST_PAUSE_MS);
    }
  }

  if (failedBoxes === ROMANIA_BBOXES.length) {
    throw new Error("All OSM bbox requests failed. No gym data imported from OSM.");
  }

  if (failedBoxes > 0) {
    console.warn(`⚠️ OSM import completed with ${failedBoxes} failed bbox request(s).`);
  }

  for (const gym of osmMap.values()) {
    const geoKey = `${Math.round(gym.latitude * 10000)}:${Math.round(gym.longitude * 10000)}`;
    const textKey = `${gym.name.toLowerCase()}|${geoKey}`;
    if (!dedupeMap.has(textKey)) {
      dedupeMap.set(textKey, gym);
    }
  }

  return [...dedupeMap.values()];
};

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    await ensureDatabaseExtensions();
    await sequelize.sync({ alter: true });
    await ensureSpatialAndSearchInfrastructure();
    console.log("✅ Models synced");

    if (IMPORT_GOOGLE_PLACES_ROMANIA && IMPORT_OSM_ROMANIA) {
      console.warn(
        "⚠️ Both IMPORT_GOOGLE_PLACES_ROMANIA and IMPORT_OSM_ROMANIA are enabled. Using Google Places mode."
      );
    }

    let gyms: SeedGym[];
    let seedSourceLabel: string;

    if (IMPORT_GOOGLE_PLACES_ROMANIA) {
      gyms = await fetchRomaniaGymsFromGooglePlaces();
      seedSourceLabel = "Google Places Romania";
    } else if (IMPORT_OSM_ROMANIA) {
      gyms = await fetchRomaniaGymsFromOSM();
      seedSourceLabel = "OSM Romania";
    } else {
      gyms = fallbackGyms;
      seedSourceLabel = "fallback sample";
    }

    console.log(
      `🏋️ Starting gym seed with ${gyms.length} records (${seedSourceLabel})`
    );

    let createdCount = 0;
    let existingCount = 0;

    for (const gym of gyms) {
      const [instance, created] = await Gym.findOrCreate({
        where: { name: gym.name, city: gym.city, address: gym.address },
        defaults: gym,
      });

      if (created) {
        createdCount += 1;
      } else {
        existingCount += 1;
      }

      console.log(`${created ? "✅ Created" : "⏭️  Exists"}: ${instance.name}`);
    }

    console.log(`✅ Gym seed summary: created=${createdCount}, existing=${existingCount}`);
    console.log("✅ Gym seed complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();