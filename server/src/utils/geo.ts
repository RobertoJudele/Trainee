export interface PointGeometry {
  type: "Point";
  coordinates: [number, number];
}

export const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const isValidLatitude = (value: number): boolean => value >= -90 && value <= 90;

export const isValidLongitude = (value: number): boolean => value >= -180 && value <= 180;

export const buildPointFromLatLng = (
  latitude?: number,
  longitude?: number
): PointGeometry | null => {
  if (
    latitude === undefined ||
    longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !isValidLatitude(latitude) ||
    !isValidLongitude(longitude)
  ) {
    return null;
  }

  return {
    type: "Point",
    coordinates: [longitude, latitude],
  };
};
