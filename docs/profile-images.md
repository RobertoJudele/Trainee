# Profile pictures & trainer image galleries

This document explains the image-upload feature added for users and trainers: what
it does, the decisions behind it, and how every piece fits together end to end.

## What it does

- **Every user (client, trainer, admin)** can upload / replace / remove a single
  **profile picture**.
- **Every trainer** additionally gets two managed image collections:
  - **Gallery** — up to **5** showcase photos.
  - **Certifications & Awards** — up to **5** images (certifications and contest
    awards combined into one category).
- Clients viewing a trainer's public profile see the trainer's gallery and
  certifications/awards.

## Key decisions (and why)

### 1. Resize & re-encode on the server with `sharp`
Phone photos are 3–12 MB. We never store the original. Every image runs through
`sharp` (`server/src/services/imageProcessor.ts`) before hitting storage:

| Type | Transform | Why |
|------|-----------|-----|
| Profile | square **512×512** (`cover`), JPEG q80 | Avatars are always shown small and round; a square guarantees no awkward cropping. |
| Gallery | max **1280px** long edge (`inside`), JPEG q80 | Crisp full-width on a phone, small file. |
| Certifications & Awards | max **1600px** long edge, JPEG q80 | Certificates contain text that must stay legible when zoomed. |

We resize on the **server** (not only the client) because it's the only place we
can *guarantee* the result regardless of who calls the API — old app builds, web,
or a malicious client posting a huge file straight to the endpoint. `.rotate()`
bakes in EXIF orientation (so nothing appears sideways) and `.jpeg()` strips all
metadata (so we don't store camera GPS EXIF). The client *also* compresses lightly
(`quality: 0.8`) just to speed up the upload.

### 2. Profile picture lives on `User.profileImageUrl`, not in a side table
A profile picture is one-per-user and applies to every role, so it belongs on the
`User` row. The old code also wrote a duplicate `isPrimary` row into
`trainer_images` and leaked the old row on replace — that redundancy was removed.
Now `trainer_images` holds **only** gallery and credential images.

### 3. One `trainer_images` table with a `category` column
Rather than separate tables for gallery vs credentials, we reuse the existing
`TrainerImage` model and add a `category` discriminator (`"gallery"` |
`"credential"`). One model, one set of endpoints, one UI component — less code,
same flexibility. (Certifications and awards were merged into a single
`credential` category per product decision.)

`category` is a plain `VARCHAR(20)` (not a Postgres `ENUM`) on purpose: the app
boots with `sequelize.sync({ alter: false })` and has **no migration framework**,
so a `VARCHAR` column can be added with a one-line `ALTER TABLE`. Allowed values
are enforced in the model (`isIn`) and the controllers.

### 4. Multipart upload through the existing S3/R2 service
The backend already had Cloudflare R2 wiring (`s3ImageService.uploadImage(buffer,
key, contentType)`). Because that takes a raw buffer, we use **memory-storage
multer** (`uploadImageMemory` in `server/src/config/s3.ts`) so we get `file.buffer`,
run it through `sharp`, then upload the processed buffer. Keys are generated with a
forced `.jpg` extension (since we always re-encode to JPEG).

## How it works end to end

### Backend (`server/`)

| Concern | File |
|---------|------|
| Resizing | `src/services/imageProcessor.ts` |
| Memory multer + key gen | `src/config/s3.ts` (`uploadImageMemory`, `generateS3key(..., ext)`) |
| R2 upload/delete/url | `src/services/s3ImageService.ts` (unchanged) |
| Profile picture (any user) | `src/controllers/user.ts` → routes in `src/routes/user.ts` |
| Trainer gallery/credentials | `src/controllers/trainerImages.ts` → `src/routes/trainerImages.ts` |
| Public trainer images | `src/controllers/trainer.ts` (`getTrainer` includes `TrainerImage`) |
| Model + types | `src/models/trainerImage.ts`, `src/types/trainerImage.ts` |
| Schema migration | `migrations/001_add_trainer_image_category.sql` |

**Endpoints**

| Method & path | Auth | Body | Notes |
|---------------|------|------|-------|
| `POST /users/profile-picture` | any user | multipart, field `profileImage` | resize 512², store on `User.profileImageUrl`, delete old object, returns updated `user` |
| `DELETE /users/profile-picture` | any user | — | removes object + clears field |
| `GET /trainer-images` | trainer | — | `{ gallery: [], credential: [] }` |
| `POST /trainer-images/gallery` | trainer | multipart, field `images` (≤5) | enforces 5 cap → `422` if exceeded |
| `POST /trainer-images/credential` | trainer | multipart, field `images` (≤5) | enforces 5 cap |
| `DELETE /trainer-images/:id` | trainer | — | ownership-checked, removes object + row |

The public `GET /trainer/:id` response gains `galleryImages` and
`credentialImages` arrays.

### Frontend (`frontend/`)

| Concern | File |
|---------|------|
| Pick images + build FormData | `src/lib/imageUpload.ts` |
| Profile-picture hook | `src/lib/useProfilePictureUpload.ts` |
| Avatar component | `src/components/EditableAvatar.tsx` |
| Image grid (gallery/credentials) | `src/components/TrainerImageSection.tsx` |
| Profile-picture mutations | `features/users/usersApiSlicet.ts` |
| Trainer image mutations/query | `features/trainer/trainerApiSlice.ts` |
| Client profile screen | `src/screens/UserProfile.tsx` |
| Trainer profile screen | `features/trainer/TrainerProfile.tsx` |
| Public trainer detail | `app/trainers/[id].tsx` |

**Upload flow**: `expo-image-picker` selects an image (profile pictures use
`allowsEditing` + `aspect:[1,1]` for an in-app square crop). The asset is turned
into multipart `FormData` (`{ uri, name, type }`) and POSTed by an RTK Query
mutation. We deliberately **don't set `Content-Type`** — `fetch` adds the multipart
boundary itself; our `prepareHeaders` only sets `Authorization`.

**State sync**: after a profile-picture change the server returns the updated user;
`usersApiSlicet.ts` patches it into the auth slice via `setCredentials` (keeping the
current tokens), so the new avatar appears everywhere instantly. Trainer image
mutations invalidate the `TrainerImages` cache tag so the management grid refetches.

## Deploying this change

1. **Run the migration** once per environment (the column is not auto-added):
   ```bash
   docker compose exec db psql -U "$DB_USER" -d "$DB_NAME" \
     -c "ALTER TABLE trainer_images ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'gallery';"
   ```
2. **Deploy the backend** (`server/DEPLOY.md`): `git pull && docker compose build app && docker compose up -d app`.
3. **Rebuild the app** — `expo-image-picker` is a **native** module, so a new dev
   build / store build is required (`cd frontend && npm run android`). A JS-only
   reload is not enough.
4. Ensure `S3_ENDPOINT` and `S3_PUBLIC_URL` are set in the server `.env` (the S3
   config throws on boot without them).

## Limits & validation
- Per-category cap: **5** (gallery, credentials). Enforced server-side (`422`).
- Accepted: any `image/*` MIME (multer `fileFilter`); re-encoded to JPEG.
- Raw upload size cap: **12 MB** before resize (`uploadImageMemory`).

## Out of scope (possible follow-ups)
Drag-to-reorder, multiple CDN size variants/thumbnails, captions/alt-text editing,
video.
