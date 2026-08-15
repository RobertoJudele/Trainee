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
