# Testarea memento-urilor de ședință

Sweep-ul trimite la **19:00 Europe/Bucharest**, pentru ședințele de **a doua zi**.
Rulează din oră în oră (`startSessionReminderScheduler`), iar sweep-urile de după
19:00 servesc drept recuperare dacă serverul a fost oprit — tabelul
`slot_reminders` împiedică dublurile.

## Cele cinci condiții

O notificare pleacă doar dacă **toate** sunt adevărate:

1. E ora 19:00 sau mai târziu în București
2. Există un slot cu `status = 'assigned'` mâine
3. Slotul are `client_id`
4. Nu există deja rând în `slot_reminders` pentru el
5. Clientul are `expo_push_token` și `reminders_enabled = true`

## Diagnostic

```bash
cd server
npm run reminders:check -- <userId>          # spune care condiție cade
npm run reminders:check -- <userId> --send   # trimite pe loc
```

`--send` ocolește **doar ceasul**. Slotul de mâine, tokenul și comutatorul rămân
condiții reale, deci o notificare primită înseamnă că și sweep-ul real ar trimite.
Nu scrie în `slot_reminders`, așa că sweep-ul de la 19:00 va trimite normal.

## Cum îți creezi cazul de test

Cel mai simplu: din aplicație, ca antrenor, alocă-i clientului o ședință **mâine**
în planificatorul zilei. Alternativ, mută una existentă:

```sql
UPDATE trainer_schedule_slots
SET starts_at = (CURRENT_DATE + INTERVAL '1 day 18 hours') AT TIME ZONE 'Europe/Bucharest',
    ends_at   = (CURRENT_DATE + INTERVAL '1 day 19 hours') AT TIME ZONE 'Europe/Bucharest'
WHERE id = <slotId>;
```

Ca să retestezi aceeași ședință, șterge rândul de deduplicare:

```sql
DELETE FROM slot_reminders WHERE slot_id = <slotId>;
```

## Capcana cu Expo Go

Tokenul se obține în aplicație, dar **Expo Go nu mai livrează notificări push pe
Android începând cu SDK 53**. Un token valid poate exista fără ca notificarea să
ajungă vreodată. Pentru un test real îți trebuie un **development build**, nu Expo
Go.

Verifică răspunsul lui Expo la `--send`: un tichet `DeviceNotRegistered` sau
`InvalidCredentials` înseamnă că tokenul e mort ori lipsesc credențialele FCM —
nu că sweep-ul e greșit. Pentru Android în producție, FCM trebuie configurat în
EAS.

## Trimitere fără Node (VPS, container, orice)

`npm run push:test` are nevoie de `ts-node`, care e devDependency — deci lipsește
în imaginea de producție și oriunde s-a rulat `npm ci --omit=dev`. Trimiterea e
însă doar un POST, deci `curl` e suficient.

Ia tokenul:

```bash
docker compose exec db psql -U dev_app -d trainee_dev -t -A \
  -c "select expo_push_token from user_push_tokens where user_id=<userId>;"
```

Trimite:

```bash
curl -sS -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '[{"to":"ExponentPushToken[...]","title":"Salvio — test","body":"Test","sound":"default"}]'
```

Răspunsul conține un `id`. **Ăsta e doar un bilet de intrare în coadă, nu o
livrare.** Motivul real al eșecului apare în confirmare, câteva secunde mai
târziu:

```bash
curl -sS -X POST https://exp.host/--/api/v2/push/getReceipts \
  -H "Content-Type: application/json" \
  -d '{"ids":["<id-ul-de-mai-sus>"]}'
```

`"status":"ok"` înseamnă că Expo a predat mesajul către APNs sau FCM. Dacă tot
nu apare pe telefon, cauza e pe dispozitiv: permisiune refuzată, mod de
concentrare, economie de energie — sau Expo Go pe Android, care nu primește push
din SDK 53.
