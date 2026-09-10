# Salvio — descriere factuală a produsului

**Scop:** brief intern pentru comunicare. Totul de mai jos e citit din cod la
2026-08-20 (branch `dev`). Unde codul nu răspunde, scrie „neclar din cod".

---

## 1. Ce este aplicația

Aplicație mobilă (iOS + Android, React Native/Expo) cu backend propriu, prin care
antrenorii personali își administrează programul, clienții și pachetele de
ședințe, iar clienții își văd ședințele alocate de antrenor.

Conține și un director de antrenori cu căutare și filtre, plus o hartă cu săli de
fitness importate din Google Places.

Antrenorii plătesc abonament ca să fie vizibili în căutare; clienții folosesc
aplicația gratuit.

---

## 2. Tipuri de utilizatori

Rolurile existente în cod sunt exact trei (`UserRole`, identic în aplicație și pe
server): `client`, `trainer`, `admin`.

**Nu există rol de „sală".** Sălile sunt date, nu conturi — nimeni nu se
autentifică „ca sală" și nicio sală nu-și administrează pagina.

### Client
- Se înregistrează normal, din ecranul de înregistrare. Rolul implicit e `client`.
- Caută antrenori, vede profiluri publice, deschide harta sălilor.
- Își vede ședințele alocate de antrenor și generează coduri de check-in.
- Lasă recenzii **doar** antrenorilor cu care e conectat (serverul respinge restul cu 403).
- Își setează preferințe de potrivire (obiectiv, nivel, buget, distanță).
- Poate raporta probleme și poate bloca utilizatori.

### Antrenor
- **Nu e un tip de cont separat.** Un client își creează profil de antrenor din
  „Devino antrenor", iar rolul contului devine `trainer`.
- Își administrează profilul, pozele, certificările, specializările și pachetele.
- Se alătură sălilor din listă / le părăsește.
- Își definește programul de lucru, generează intervale, alocă clienți pe zile.
- Confirmă prezența prin codul de check-in al clientului.
- Administrează pachetele de ședințe ale clienților (creare, editare, ștergere).
- Vede statistici despre vizualizările profilului.

### Admin
- Singura diferență vizibilă în aplicație: cardul „Probleme admin" pe ecranul
  principal, care duce la gestionarea problemelor raportate (inclusiv cererile de
  adăugare a unei săli).
- **Nu există interfață de înregistrare ca admin** — rolul se setează în baza de date.

---

## 3. Lista de ecrane

Titlurile sunt cele exacte din interfața în română (limba implicită).

### Comune / neautentificat

| Ecran | Ce vede | Ce poate face |
|---|---|---|
| Welcome | Ecran de intrare | Mergi la autentificare sau înregistrare |
| Autentificare | Email + parolă | Intră în cont; „Am uitat parola" |
| Înregistrare | Formular de cont | Creează cont (rol `client`) |
| „Am uitat parola" / „Resetează parola" | Formular email, apoi parolă nouă | Cere link, setează parola |
| „Legal și Politici" | Termeni și politica de confidențialitate | Doar citire |
| „Raportează o problemă" | Formular (titlu max 140, descriere max 2000 caractere) | Trimite raport |

### Ecran principal (după autentificare)

Carduri, filtrate pe rol:

- **Client:** „Găsește antrenori", „Devino antrenor" (ascuns dacă ești deja
  antrenor), „Profilul meu", „Harta sălilor", „Programul meu"
- **Antrenor:** „Profilul meu", „Harta sălilor", „Programul antrenorului"
- **Admin:** „Probleme admin"

### Client

| Ecran | Ce vede | Ce poate face |
|---|---|---|
| „Găsește antrenori" | Listă de antrenori cu preț „de la", rating, specializări | Caută text; filtrează după oraș/județ, interval de preț, experiență, rating, specializări, disponibilitate; sortează după „Cele mai bune recenzii", preț crescător, „Cei mai experimentați" |
| „Detalii antrenor" | Poză, nume, disponibilitate, rating, vizualizări, „Despre mine", „Specializări", „Experiență și Tarife", pachete, locație, „Săli disponibile", galerie, „Certificări și Premii", „Recenzii" | Scrie/editează/șterge propria recenzie; raportează recenzie sau antrenor; blochează; deschide Instagram/Facebook/WhatsApp |
| „Harta sălilor" | Hartă cu săli grupate în clustere | Vede detalii sală și antrenorii de acolo; „Solicită o sală" |
| „Programul meu" | Ședințe viitoare | „Generează cod de check-in" (afișat cu „Dă acest cod antrenorului tău" și „Expiră:"); „Anulează rezervarea"; introduce „Cod antrenor" pentru a se conecta la un antrenor; comutator pentru memento-uri |
| „Profilul meu" | Datele contului, poză | Editează profilul, schimbă limba, conturi blocate, ștergere cont |
| Preferințe | Obiectiv (slăbire, masă musculară, rezistență, flexibilitate, recuperare, fitness general), nivel, buget, distanță maximă | Salvează preferințele |

### Antrenor

| Ecran | Ce vede | Ce poate face |
|---|---|---|
| „Profil Antrenor" | Propriul profil, poze (max 5), pachete, specializări | Editează tot; „Distribuie linkul meu"; „Gestionează abonamentul"; tur de prezentare; ștergere profil/cont |
| „Programul antrenorului" | Calendar lunar cu indicatori | Definește programul de lucru; generează intervale; blochează zile; intră în ziua respectivă |
| Planificatorul zilei | Intervalele zilei + lista de clienți | Trage clientul peste interval pentru alocare; dezalocă; creează interval punctual; șterge interval; confirmă prezența cu codul clientului; administrează „Pachete de ședințe" |
| „Rezumatul săptămânii" | Vedere pe șapte zile | Doar citire |
| „Sălile mele" | Sălile la care e asociat | Se alătură / părăsește o sală; „Solicită o sală" |
| „Analize Antrenor" | Vizualizări ale profilului pe zile | Doar citire |
| „Finalizare comandă" | Starea abonamentului sau planurile disponibile | Cumpără abonament (1/3/6/12 luni); restaurează achiziții |

### Admin

| Ecran | Ce vede | Ce poate face |
|---|---|---|
| „Probleme admin" | Probleme raportate, inclusiv cereri de săli | Schimbă starea, gestionează cererile |

### Ecrane care există în cod dar nu sunt accesibile

- `app/trainersIndex.tsx` — **nu e funcțional**: nu e înregistrat în navigator și
  nu e referit din niciun ecran.

---

## 4. Fluxuri complete

### 4.1 Cum devine un antrenor listat și vizibil

1. **În aplicație:** utilizatorul își face cont normal (rol `client`).
2. **În aplicație:** apasă „Devino antrenor" și completează formularul — descriere,
   experiență, tarife, specializări (obligatorii), locație, pachete, linkuri sociale.
3. **În aplicație, automat:** rolul contului devine `trainer` și pornește turul de antrenor.
4. **Pe server, automat:** profilul se creează cu `trialEndsAt` egal cu momentul
   creării — adică **perioada de probă e expirată din prima clipă**. Fără altceva,
   antrenorul **nu apare în căutare**.
5. **Pe server, automat:** dacă data curentă e înainte de termenul promoției
   (2026-09-30), se acordă un entitlement promoțional de 3 luni, care îl face activ
   și deci vizibil. Altfel îi trebuie abonament plătit.
6. **În aplicație, manual:** antrenorul se alătură sălilor din „Sălile mele" —
   altfel nu apare la nicio sală pe hartă.
7. **În afara aplicației:** dacă sala lui nu există în listă, trimite „Solicită o
   sală", care ajunge ca problemă la admin și trebuie rezolvată manual.

**Filtrarea după abonament e reală:** căutarea, recomandările și căutarea după
nume/descriere folosesc `Trainer.scope("active")`. Un antrenor fără abonament activ
și fără grant nu apare în rezultate.

### 4.2 Cum ajunge un client la un antrenor

Există patru căi, iar una singură e „descoperire" propriu-zisă.

**A. Căutare în aplicație** — „Găsește antrenori", filtre, deschide „Detalii
antrenor". De acolo, contactul se face **în afara aplicației**: butoanele deschid
Instagram, Facebook sau WhatsApp.

**B. Harta sălilor** — găsește o sală, vede antrenorii asociați ei, deschide profilul.

**C. Cod de la antrenor** — antrenorul îi dă clientului un „Cod antrenor" pe care
acesta îl introduce în „Programul meu" și apasă „Conectează". Clientul devine
conectat la antrenor și poate lăsa recenzie.

**D. Pagină web publică** — fiecare antrenor are o pagină la `/t/<slug>`, pe care o
poate distribui din „Distribuie linkul meu". **Nu e încă publicată**: codul
funcționează local și pe mediul de dezvoltare, dar producția n-are domeniu,
certificat și `PUBLIC_WEB_URL` configurate.

### 4.3 Cum se stabilește și se înregistrează o ședință

1. **În aplicație (antrenor):** definește programul de lucru și generează intervale
   pentru o zi sau o perioadă.
2. **În afara aplicației:** clientul și antrenorul se înțeleg pe WhatsApp, telefon
   sau în sală asupra orei. **Aplicația nu are rezervare de către client.**
3. **În aplicație (antrenor):** în planificatorul zilei, trage clientul peste
   interval. Intervalul trece în starea „Rezervat".
4. **În aplicație, automat:** dacă acel client are un pachet activ, alocarea consumă
   o ședință; anularea o restituie.
5. **În aplicație (client), la sală:** apasă „Generează cod de check-in" și îi arată
   antrenorului codul de 6 cifre.
6. **În aplicație (antrenor):** introduce codul și confirmă prezența.
7. **În aplicație, automat:** cu o zi înainte, la ora 19:00 (fus București),
   serverul trimite notificare push clienților care au memento-urile activate.

### 4.4 Plăți și abonamente

- **Cine plătește:** doar antrenorii. Clienții nu plătesc nimic în aplicație.
- **Cum:** achiziție în aplicație prin RevenueCat (App Store / Google Play), în
  ecranul „Finalizare comandă". Planuri de 1, 3, 6 și 12 luni.
- **Stripe:** există în cod, dar **e dezactivat pe iOS și Android**
  (`canUseStripeWebCheckout` cere platformă non-nativă). Practic, plata pe telefon
  se face exclusiv prin magazinele de aplicații.
- **Perioadă de probă: nu există.** `trialEndsAt` se setează la momentul creării.
- **Grant de fondator:** 3 luni gratuite pentru orice profil de antrenor creat
  până la 2026-09-30 inclusiv. Fără card, fără taxare automată, fără limită de
  număr de antrenori. Cele 3 luni curg din momentul acordării.
- **Plata ședințelor:** **nu se întâmplă în aplicație.** Pachetele afișate pe profil
  sunt doar informative — nu există niciun buton de cumpărare. Banii se dau în
  afara aplicației, iar antrenorul înregistrează manual pachetul clientului.

---

## 5. Ce NU face aplicația

Cele mai probabile presupuneri greșite:

- **Clientul nu poate rezerva singur.** Nu există auto-rezervare. Doar antrenorul
  alocă un client pe un interval.
- **Clientul nu vede programul antrenorului.** Nu există ecran în care un client să
  vadă intervalele libere ale cuiva. Vede doar ședințele deja alocate lui.
- **Nu există chat sau mesagerie.** Contactul se face prin Instagram, Facebook sau
  WhatsApp, cu ieșire din aplicație.
- **Nu se plătesc ședințe sau pachete în aplicație.** Pachetele de pe profil sunt
  preț afișat, nimic mai mult. Singura plată din aplicație e abonamentul antrenorului.
- **Nu există conturi de sală.** Sălile sunt date importate; nicio sală nu-și
  administrează prezența, orarul sau prețurile.
- **Nu există perioadă de probă gratuită** pentru antrenori.
- **Nu există program de recomandare, puncte, insigne, serii de prezență sau
  clasamente.**
- **Nu există jurnal de antrenamente, bibliotecă de exerciții sau urmărirea
  progresului** (greutate, măsurători, poze).
- **Nu există plan de nutriție sau conținut video.**
- **Nu există anulare automată cu penalizare.** Anularea restituie ședința în
  pachet, indiferent cât de târziu.
- **Antrenorul nu-și poate crea cont direct.** Trebuie întâi cont de client.
- **Paginile web publice nu sunt live** în producție.
- **Notificările push nu funcționează pe Android fără configurare FCM.**
  `google-services.json` lipsește din proiect, deci în starea actuală push-ul pe
  Android **nu e funcțional**.
- **Nu există mod întunecat.** Interfața e blocată pe tema luminoasă.
- **Nu există versiune web pentru utilizatori.** Aplicația e doar mobilă.

---

## 6. Terminologia din interfață

Termenii exacți, în română. A se folosi aceștia în comunicare.

| Termen | Unde apare |
|---|---|
| **Ședință** / **ședințe** | unitatea de antrenament |
| **Pachete de ședințe** | blocul de ședințe preplătite al unui client |
| **Interval** / **intervale** | sloturile generate în program |
| **Program** | orarul antrenorului |
| **Programul meu** | ecranul clientului cu ședințele lui |
| **Programul antrenorului** | ecranul de administrare a orarului |
| **Rezervat** / **Blocat** / **Disponibil** | stările din calendar |
| **Cod de check-in** | codul de 6 cifre pentru confirmarea prezenței |
| **Cod antrenor** | codul prin care un client se conectează la un antrenor |
| **Săli disponibile** | sălile unde lucrează antrenorul |
| **Harta sălilor** | ecranul cu harta |
| **Specializări** | domeniile antrenorului |
| **Recenzii** | evaluările clienților |
| **Despre mine** | descrierea antrenorului |
| **Tarif/ședință** | prețul unei ședințe |
| **Devino antrenor** | trecerea de la client la antrenor |
| **Analize Antrenor** | statisticile de profil |
| **Solicită o sală** | cererea de adăugare a unei săli |

**De evitat**, pentru că nu corespund produsului: „rezervare online", „booking",
„programare instantanee", „chat", „plată în aplicație" (pentru ședințe),
„abonament la sală".

---

## 7. Numere și limite din cod

| Element | Valoare |
|---|---|
| Durata implicită a unui interval | 60 de minute (configurabilă la generare) |
| Cod de check-in | 6 cifre, valabil **10 minute**, maximum **3 încercări** |
| Memento ședință | ora **19:00**, fus **Europe/Bucharest**, pentru ziua următoare |
| Frecvența verificării memento-urilor | din oră în oră |
| Poze pe profilul de antrenor | maximum **5** |
| Recenzie | între **10** și **100** de caractere (textul e opțional) |
| Rază maximă pe hartă | **14 km** |
| Săli randate simultan pe hartă | maximum **120** (input de clusterizare: 900) |
| Raport de problemă | titlu **140**, descriere **2000** de caractere |
| Cerere de sală | **200** de caractere |
| Planuri de abonament | 1, 3, 6, 12 luni |
| Perioadă de probă | **nu există** (expiră la creare) |
| Grant de fondator | **3 luni**, termen **2026-09-30**, fără limită de număr |
| Limbi | română (implicită) și engleză |

**Numărul de săli:** baza de date de dezvoltare are **1795** de săli, acoperind mai
multe orașe din România. Numărul din producție **nu poate fi verificat din cod** —
neclar din cod.

**Prețurile abonamentului nu sunt în cod** — sunt definite în RevenueCat și Stripe.
Neclar din cod.

**Nu există limită** pentru numărul de clienți, de pachete sau de ședințe per
antrenor.
