import { Request, Response } from "express";
import { Trainer } from "../models/trainer";
import { User } from "../models/user";
import { Gym } from "../models/gym";
import { TrainerGym } from "../models/trainerGym";
import { Specialization } from "../models/specialization";
import { publicWebBaseUrl } from "../utils/publicUrl";
import {
  renderPublicProfile,
  renderNotFound,
  PageOptions,
  PublicProfileData,
} from "../services/publicProfilePage";

/**
 * Public, unauthenticated trainer page at /t/<slug> — the link a trainer puts in
 * their Instagram bio.
 *
 * Serves HTML, not JSON, and is deliberately outside /trainer: search engines and
 * link-preview crawlers fetch it, and it must keep working if the API surface
 * changes.
 */

/**
 * Both store listings, defaulted rather than required: the identifiers are fixed
 * and already documented in docs/force-update.md, and leaving them to env vars
 * meant the download link silently vanished wherever they weren't set.
 */
const DEFAULT_APPLE_STORE_URL = "https://apps.apple.com/app/id6775085258";
const DEFAULT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.juroctech.frontend";

const pageOptions = (): PageOptions => ({
  // Empty until a consumer domain exists, which makes the renderer omit
  // canonical/og:url rather than emit a relative one.
  baseUrl: publicWebBaseUrl(),
  appleStoreUrl: process.env.PUBLIC_APPLE_STORE_URL?.trim() || DEFAULT_APPLE_STORE_URL,
  playStoreUrl: process.env.PUBLIC_PLAY_STORE_URL?.trim() || DEFAULT_PLAY_STORE_URL,
});

export const getPublicTrainerPage = async (req: Request, res: Response) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();

  try {
    // Gyms hang off TrainerGym, not off Trainer directly — there is no
    // Trainer↔Gym association, so they are fetched separately the same way
    // getPublicTrainerDetails does.
    const trainer = slug
      ? await Trainer.findOne({
          where: { slug },
          include: [
            { model: User, attributes: ["firstName", "lastName", "profileImageUrl"] },
            { model: Specialization, attributes: ["name"] },
          ],
        })
      : null;

    if (!trainer) {
      // 404 status with a real page: a wrong link should look intentional, and
      // the noindex keeps dead slugs out of search results.
      res.status(404).type("html").send(renderNotFound(pageOptions()));
      return;
    }

    const trainerGyms = await TrainerGym.findAll({
      where: { trainerId: trainer.id },
      include: [{ model: Gym, attributes: ["name", "city"] }],
    });

    const anyTrainer = trainer as unknown as {
      user?: { firstName?: string; lastName?: string; profileImageUrl?: string | null };
      specializations?: { name: string }[];
    };

    const fullName =
      [anyTrainer.user?.firstName, anyTrainer.user?.lastName].filter(Boolean).join(" ") ||
      "Antrenor personal";

    const data: PublicProfileData = {
      slug,
      fullName,
      photoUrl: anyTrainer.user?.profileImageUrl ?? null,
      bio: trainer.bio ?? null,
      city: trainer.locationCity ?? null,
      experienceYears: trainer.experienceYears ?? null,
      rating: Number(trainer.totalRating ?? 0),
      reviewCount: Number(trainer.reviewCount ?? 0),
      specializations: (anyTrainer.specializations ?? []).map((s) => s.name).filter(Boolean),
      gyms: trainerGyms
        .map((entry) => (entry as unknown as { gym?: { name: string; city?: string | null } }).gym)
        .filter((gym): gym is { name: string; city?: string | null } => Boolean(gym?.name))
        .map((gym) => ({ name: gym.name, city: gym.city ?? null })),
      priceLabel: formatPrice(trainer.sessionRate),
      instagramUrl: trainer.instagramUrl ?? null,
      whatsappUrl: trainer.whatsappUrl ?? null,
    };

    // Crawlers and social scrapers hit this repeatedly; a short cache spares the
    // database without making an edited profile stale for long.
    res.set("Cache-Control", "public, max-age=300");
    res.type("html").send(renderPublicProfile(data, pageOptions()));
  } catch (error) {
    console.error(`Public trainer page failed for slug "${slug}":`, error);
    res.status(500).type("html").send(renderNotFound(pageOptions()));
  }
};

const formatPrice = (sessionRate?: number | string | null): string | null => {
  const price = Number(sessionRate);
  if (!Number.isFinite(price) || price <= 0) return null;
  return `De la ${Math.round(price * 100) / 100} lei/ședință`;
};
