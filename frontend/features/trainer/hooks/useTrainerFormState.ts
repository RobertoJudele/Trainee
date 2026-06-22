import { useCallback, useEffect, useState } from "react";

export interface TrainerFormFields {
  bio: string;
  experienceYears: string;
  locationCity: string;
  locationState: string;
  locationCountry: string;
  instagramUrl: string;
  facebookUrl: string;
  whatsappUrl: string;
  selectedSpecializationIds: number[];
}

export interface TrainerFormSetters {
  setBio: (v: string) => void;
  setExperienceYears: (v: string) => void;
  setLocationCity: (v: string) => void;
  setLocationState: (v: string) => void;
  setLocationCountry: (v: string) => void;
  setInstagramUrl: (v: string) => void;
  setFacebookUrl: (v: string) => void;
  setWhatsappUrl: (v: string) => void;
  toggleSpecialization: (id: number) => void;
}

interface TrainerLike {
  bio?: string | null;
  experienceYears?: number | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  specializations?: Array<{ id: number }>;
}

interface UseTrainerFormStateOptions {
  initialTrainer?: TrainerLike | null;
}

export interface UseTrainerFormStateReturn extends TrainerFormFields, TrainerFormSetters {
  resetToTrainer: (trainer: TrainerLike) => void;
}

function hydrateFromTrainer(trainer: TrainerLike | null | undefined) {
  return {
    bio: trainer?.bio ?? "",
    experienceYears: trainer?.experienceYears !== undefined && trainer?.experienceYears !== null
      ? String(trainer.experienceYears) : "",
    locationCity: trainer?.locationCity ?? "",
    locationState: trainer?.locationState ?? "",
    locationCountry: trainer?.locationCountry ?? "",
    instagramUrl: trainer?.instagramUrl ?? "",
    facebookUrl: trainer?.facebookUrl ?? "",
    whatsappUrl: trainer?.whatsappUrl ?? "",
    selectedSpecializationIds: Array.isArray(trainer?.specializations)
      ? trainer.specializations.map((s) => s.id) : [],
  };
}

export function useTrainerFormState(
  options?: UseTrainerFormStateOptions,
): UseTrainerFormStateReturn {
  const initialTrainer = options?.initialTrainer;

  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [selectedSpecializationIds, setSelectedSpecializationIds] = useState<number[]>([]);

  useEffect(() => {
    if (!initialTrainer) return;
    const values = hydrateFromTrainer(initialTrainer);
    setBio(values.bio);
    setExperienceYears(values.experienceYears);
    setLocationCity(values.locationCity);
    setLocationState(values.locationState);
    setLocationCountry(values.locationCountry);
    setInstagramUrl(values.instagramUrl);
    setFacebookUrl(values.facebookUrl);
    setWhatsappUrl(values.whatsappUrl);
    setSelectedSpecializationIds(values.selectedSpecializationIds);
  }, [initialTrainer]);

  const toggleSpecialization = useCallback((id: number) => {
    setSelectedSpecializationIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id],
    );
  }, []);

  const resetToTrainer = useCallback((trainer: TrainerLike) => {
    const values = hydrateFromTrainer(trainer);
    setBio(values.bio);
    setExperienceYears(values.experienceYears);
    setLocationCity(values.locationCity);
    setLocationState(values.locationState);
    setLocationCountry(values.locationCountry);
    setInstagramUrl(values.instagramUrl);
    setFacebookUrl(values.facebookUrl);
    setWhatsappUrl(values.whatsappUrl);
    setSelectedSpecializationIds(values.selectedSpecializationIds);
  }, []);

  return {
    bio, setBio,
    experienceYears, setExperienceYears,
    locationCity, setLocationCity,
    locationState, setLocationState,
    locationCountry, setLocationCountry,
    instagramUrl, setInstagramUrl,
    facebookUrl, setFacebookUrl,
    whatsappUrl, setWhatsappUrl,
    selectedSpecializationIds,
    toggleSpecialization,
    resetToTrainer,
  };
}
