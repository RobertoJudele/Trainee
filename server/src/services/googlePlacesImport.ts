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

type GoogleNearbyPlace = {
  place_id?: string;
  name?: string;
  vicinity?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GoogleNearbyResponse = {
  status: string;
  error_message?: string;
  next_page_token?: string;
  results?: GoogleNearbyPlace[];
};

type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GooglePlaceDetails = {
  formatted_address?: string;
  formatted_phone_number?: string;
  opening_hours?: {
    weekday_text?: string[];
  };
  address_components?: GoogleAddressComponent[];
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GooglePlaceDetailsResponse = {
  status: string;
  error_message?: string;
  result?: GooglePlaceDetails;
};

type RomaniaBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type GridPoint = {
  latitude: number;
  longitude: number;
};

const GOOGLE_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const GOOGLE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

const ROMANIA_BOUNDS: RomaniaBounds = {
  south: 43.5,
  west: 20.2,
  north: 48.4,
  east: 29.9,
};

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY?.trim() || "";
const GOOGLE_PLACES_MAX_RETRIES = Math.max(
  0,
  Number(process.env.GOOGLE_PLACES_MAX_RETRIES ?? 2)
);
const GOOGLE_PLACES_REQUEST_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.GOOGLE_PLACES_REQUEST_TIMEOUT_MS ?? 30000)
);
const GOOGLE_PLACES_REQUEST_PAUSE_MS = Math.max(
  0,
  Number(process.env.GOOGLE_PLACES_REQUEST_PAUSE_MS ?? 120)
);
const GOOGLE_PLACES_PAGE_TOKEN_WAIT_MS = Math.max(
  1200,
  Number(process.env.GOOGLE_PLACES_PAGE_TOKEN_WAIT_MS ?? 2200)
);
const GOOGLE_PLACES_RADIUS_METERS = Math.max(
  1000,
  Math.min(50000, Number(process.env.GOOGLE_PLACES_RADIUS_METERS ?? 25000))
);
const GOOGLE_PLACES_GRID_STEP_DEGREES = Math.max(
  0.2,
  Number(process.env.GOOGLE_PLACES_GRID_STEP_DEGREES ?? 0.35)
);
const GOOGLE_PLACES_MAX_PAGES_PER_CELL = Math.max(
  1,
  Number(process.env.GOOGLE_PLACES_MAX_PAGES_PER_CELL ?? 3)
);
const GOOGLE_PLACES_MAX_CELLS = Math.max(
  0,
  Number(process.env.GOOGLE_PLACES_MAX_CELLS ?? 0)
);
const GOOGLE_PLACES_FETCH_DETAILS = process.env.GOOGLE_PLACES_FETCH_DETAILS !== "0";

const RETRYABLE_STATUSES = new Set(["UNKNOWN_ERROR", "OVER_QUERY_LIMIT"]);

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const truncate = (value: string, maxLength: number): string =>
  value.trim().slice(0, maxLength);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRomaniaCountryValue = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "romania" || normalized === "ro";
};

const isInsideRomaniaBounds = (latitude: number, longitude: number): boolean =>
  latitude >= ROMANIA_BOUNDS.south &&
  latitude <= ROMANIA_BOUNDS.north &&
  longitude >= ROMANIA_BOUNDS.west &&
  longitude <= ROMANIA_BOUNDS.east;

const getAddressComponent = (
  components: GoogleAddressComponent[] | undefined,
  type: string
): string | undefined => {
  const match = components?.find((component) => component.types?.includes(type));
  return match?.long_name?.trim() || match?.short_name?.trim();
};

const inferCityFromVicinity = (vicinity: string | undefined): string | undefined => {
  if (!vicinity) {
    return undefined;
  }

  const parts = vicinity
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return undefined;
  }

  return parts[parts.length - 1];
};

const extractGymFromGooglePlace = (
  place: GoogleNearbyPlace,
  details: GooglePlaceDetails | null
): SeedGym | null => {
  const placeName = place.name?.trim() || "";
  if (placeName.length < 2) {
    return null;
  }

  const detailsLocation = details?.geometry?.location;
  const baseLocation = place.geometry?.location;

  const latitude =
    detailsLocation && isFiniteNumber(detailsLocation.lat)
      ? detailsLocation.lat
      : baseLocation && isFiniteNumber(baseLocation.lat)
        ? baseLocation.lat
        : undefined;
  const longitude =
    detailsLocation && isFiniteNumber(detailsLocation.lng)
      ? detailsLocation.lng
      : baseLocation && isFiniteNumber(baseLocation.lng)
        ? baseLocation.lng
        : undefined;

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return null;
  }

  if (!isInsideRomaniaBounds(latitude, longitude)) {
    return null;
  }

  const components = details?.address_components;

  // Keep only country-verified RO places so border queries do not import neighbors.
  const countryFromAddress = getAddressComponent(components, "country");
  if (!isRomaniaCountryValue(countryFromAddress)) {
    return null;
  }

  const city =
    getAddressComponent(components, "locality") ||
    getAddressComponent(components, "postal_town") ||
    getAddressComponent(components, "administrative_area_level_2") ||
    inferCityFromVicinity(place.vicinity) ||
    "Unknown city";

  const state =
    getAddressComponent(components, "administrative_area_level_1") ||
    "Romania";

  const openingHoursText = details?.opening_hours?.weekday_text?.length
    ? details.opening_hours.weekday_text.join(", ")
    : undefined;

  return {
    name: truncate(placeName, 100),
    address: truncate(details?.formatted_address || place.vicinity || "Unknown address", 200),
    city: truncate(city, 100),
    state: truncate(state, 50),
    country: "Romania",
    latitude,
    longitude,
    phone: details?.formatted_phone_number
      ? truncate(details.formatted_phone_number, 20)
      : undefined,
    openingHours: openingHoursText ? truncate(openingHoursText, 300) : undefined,
  };
};

const fetchJsonWithTimeout = async <T>(url: string): Promise<T> => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, GOOGLE_PLACES_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(
        `Google Places HTTP ${response.status}: ${responseBody.slice(0, 300)}`
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const requestNearbyPage = async (
  latitude: number,
  longitude: number,
  pageToken?: string
): Promise<GoogleNearbyResponse> => {
  const endpoint = new URL(GOOGLE_NEARBY_URL);
  endpoint.searchParams.set("key", GOOGLE_PLACES_API_KEY);

  if (pageToken) {
    endpoint.searchParams.set("pagetoken", pageToken);
  } else {
    endpoint.searchParams.set("location", `${latitude},${longitude}`);
    endpoint.searchParams.set("radius", String(GOOGLE_PLACES_RADIUS_METERS));
    endpoint.searchParams.set("type", "gym");
  }

  let attempt = 0;
  while (attempt <= GOOGLE_PLACES_MAX_RETRIES) {
    const response = await fetchJsonWithTimeout<GoogleNearbyResponse>(endpoint.toString());

    if (response.status === "OK" || response.status === "ZERO_RESULTS") {
      return response;
    }

    const tokenPending = response.status === "INVALID_REQUEST" && Boolean(pageToken);
    const shouldRetry = tokenPending || RETRYABLE_STATUSES.has(response.status);

    if (!shouldRetry || attempt === GOOGLE_PLACES_MAX_RETRIES) {
      throw new Error(
        `Nearby search failed with status ${response.status}: ${response.error_message || "no details"}`
      );
    }

    const delayMs = tokenPending
      ? GOOGLE_PLACES_PAGE_TOKEN_WAIT_MS
      : 700 * (attempt + 1);

    await wait(delayMs);
    attempt += 1;
  }

  throw new Error("Nearby search failed after retry budget");
};

const requestPlaceDetails = async (
  placeId: string,
  includeExtendedFields: boolean
): Promise<GooglePlaceDetails | null> => {
  const endpoint = new URL(GOOGLE_DETAILS_URL);
  endpoint.searchParams.set("key", GOOGLE_PLACES_API_KEY);
  endpoint.searchParams.set("place_id", placeId);

  const fields = ["formatted_address", "address_component", "geometry/location"];
  if (includeExtendedFields) {
    fields.push("formatted_phone_number", "opening_hours");
  }

  endpoint.searchParams.set(
    "fields",
    fields.join(",")
  );

  let attempt = 0;
  while (attempt <= GOOGLE_PLACES_MAX_RETRIES) {
    const response = await fetchJsonWithTimeout<GooglePlaceDetailsResponse>(
      endpoint.toString()
    );

    if (response.status === "OK") {
      return response.result || null;
    }

    if (response.status === "NOT_FOUND") {
      return null;
    }

    const shouldRetry = RETRYABLE_STATUSES.has(response.status);
    if (!shouldRetry || attempt === GOOGLE_PLACES_MAX_RETRIES) {
      throw new Error(
        `Place details failed for ${placeId} with status ${response.status}: ${response.error_message || "no details"}`
      );
    }

    await wait(700 * (attempt + 1));
    attempt += 1;
  }

  return null;
};

const buildGrid = (): GridPoint[] => {
  const grid: GridPoint[] = [];

  for (
    let latitude = ROMANIA_BOUNDS.south;
    latitude <= ROMANIA_BOUNDS.north;
    latitude += GOOGLE_PLACES_GRID_STEP_DEGREES
  ) {
    for (
      let longitude = ROMANIA_BOUNDS.west;
      longitude <= ROMANIA_BOUNDS.east;
      longitude += GOOGLE_PLACES_GRID_STEP_DEGREES
    ) {
      grid.push({ latitude, longitude });

      if (GOOGLE_PLACES_MAX_CELLS > 0 && grid.length >= GOOGLE_PLACES_MAX_CELLS) {
        return grid;
      }
    }
  }

  return grid;
};

export const fetchRomaniaGymsFromGooglePlaces = async (): Promise<SeedGym[]> => {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is required when IMPORT_GOOGLE_PLACES_ROMANIA=1"
    );
  }

  const grid = buildGrid();
  const gymsByPlaceId = new Map<string, SeedGym>();

  let fetchedPlaces = 0;
  let normalizedPlaces = 0;
  let skippedPlaces = 0;

  console.log(
    `[Google Places] Starting Romania import across ${grid.length} grid cells` +
      ` (radius=${GOOGLE_PLACES_RADIUS_METERS}m, step=${GOOGLE_PLACES_GRID_STEP_DEGREES}deg, details=${GOOGLE_PLACES_FETCH_DETAILS ? "extended" : "country-only"})`
  );

  for (let cellIndex = 0; cellIndex < grid.length; cellIndex += 1) {
    const cell = grid[cellIndex];
    console.log(
      `[Google Places] Cell ${cellIndex + 1}/${grid.length} at ${cell.latitude.toFixed(4)},${cell.longitude.toFixed(4)}`
    );

    let pageToken: string | undefined;
    let page = 0;

    do {
      const nearby = await requestNearbyPage(cell.latitude, cell.longitude, pageToken);
      const results = nearby.results || [];
      fetchedPlaces += results.length;

      for (const place of results) {
        const placeId = place.place_id;
        if (!placeId) {
          skippedPlaces += 1;
          continue;
        }

        if (gymsByPlaceId.has(placeId)) {
          continue;
        }

        const details = await requestPlaceDetails(placeId, GOOGLE_PLACES_FETCH_DETAILS);
        if (!details) {
          skippedPlaces += 1;
          continue;
        }

        if (GOOGLE_PLACES_REQUEST_PAUSE_MS > 0) {
          await wait(GOOGLE_PLACES_REQUEST_PAUSE_MS);
        }

        const gym = extractGymFromGooglePlace(place, details);
        if (!gym) {
          skippedPlaces += 1;
          continue;
        }

        gymsByPlaceId.set(placeId, gym);
        normalizedPlaces += 1;
      }

      page += 1;
      pageToken = nearby.next_page_token;

      if (pageToken && page < GOOGLE_PLACES_MAX_PAGES_PER_CELL) {
        await wait(GOOGLE_PLACES_PAGE_TOKEN_WAIT_MS);
      }

      if (GOOGLE_PLACES_REQUEST_PAUSE_MS > 0) {
        await wait(GOOGLE_PLACES_REQUEST_PAUSE_MS);
      }
    } while (pageToken && page < GOOGLE_PLACES_MAX_PAGES_PER_CELL);
  }

  const dedupeByTextAndGeo = new Map<string, SeedGym>();
  for (const gym of gymsByPlaceId.values()) {
    const geoKey = `${Math.round(gym.latitude * 10000)}:${Math.round(gym.longitude * 10000)}`;
    const textKey = `${gym.name.toLowerCase()}|${geoKey}`;
    if (!dedupeByTextAndGeo.has(textKey)) {
      dedupeByTextAndGeo.set(textKey, gym);
    }
  }

  console.log(
    `[Google Places] Import summary: fetched=${fetchedPlaces}, normalized=${normalizedPlaces},` +
      ` skipped=${skippedPlaces}, unique=${dedupeByTextAndGeo.size}`
  );

  return [...dedupeByTextAndGeo.values()];
};
