# Projekt2026 — Sirena d.o.o.

Logistični sistem (vožnje, tahograf, vozni park, stranke) za podjetje Sirena d.o.o. Monorepo s tremi deli:

| Mapa      | Kaj je                                  | Tehnologija                                        |
| --------- | --------------------------------------- | -------------------------------------------------- |
| `api/`    | REST API (`/api/v1/...`)                | Fastify 5, Prisma 5, PostgreSQL 16, Python skripte |
| `web/`    | Admin/vodstvo spletna aplikacija        | React 19, Vite, Tailwind 3, Zustand, React Query   |
| `mobile/` | Aplikacija za voznike (tahograf, vožnje) | Expo 54, React Native 0.81                         |

Podroben opis arhitekture, diagramov in ADR-jev je v `README.md`. Lokalni zagon in dostop do baze: `docs/LOKALNI_RAZVOJ.md`.

## Ukazi

```bash
# Baza (Docker, port 5433!)
cd api && docker compose up -d

# API — mora teči iz mape api/ (Python poti so relativne na process.cwd())
cd api && npm run dev          # node --watch --env-file=.env src/app.js → :3000
cd api && npm test             # vitest (Prisma je mockan, baza ni potrebna)
cd api && npx prisma migrate dev --name <opis>   # po spremembi schema.prisma
cd api && npx prisma studio    # GUI za bazo → :5555

# Web
cd web && npm run dev          # Vite → :5173
cd web && npm test

# Mobile
cd mobile && npx expo start    # API URL iz mobile/.env (EXPO_PUBLIC_API_URL)
```

## Arhitektura API-ja

- `api/src/app.js` — registrira plugine (rate-limit 100/min, CORS, multipart 50MB, JWT, Swagger na `/docs` z basic auth `DOCS_USER`/`DOCS_PASS`) in vse route module s prefiksom `/api/v1/<modul>`.
- `api/src/plugins/` — `prisma.js` (`app.prisma`), `crypto.js` (`app.encrypt`/`app.decrypt`, AES-256-GCM za EMŠO, ključ `ENCRYPTION_KEY` hex), `audit.js` (onResponse hook: uspešni POST/PUT/PATCH/DELETE → tabela `LOG_voznja`).
- `api/src/routes/*.js` — en modul na področje. Zaščita: `onRequest: [app.authenticate]`, nato ročno preverjanje `request.user.vloga`.
- `api/python/` — `readExcelFile.py` / `readDDDfile.py` (uvoz tahografa, kliče `ddd_upload.js`), `json_to_delovni_zapis.py` (izvoz Excel, kliče `voznje.js` `/voznjeMesec/export`). Node jih zažene s `spawn` (`python` na Windows, `python3` drugje) in bere JSON s stdout. Potreben je `openpyxl`.

## Vloge (RBAC)

JWT payload: `{ id, email, vloga }`, velja 8h. `vloga` = stolpec `Uporabnik.dostop`:

- `1` Voznik — lastne vožnje, tahograf (mobile)
- `2` Admin — vse (uporabniki, vozila, stranke, audit, uvoz)
- `3` Vodstvo — dashboard, pregled voženj/računov, brez urejanja

Web routing (`web/src/App.jsx`) uporablja `<ProtectedRoute vlogaRequired={[2,3]}>`.

## Baza (Prisma, `api/prisma/schema.prisma`)

Modeli → imena tabel v Postgresu (pomembno pri pisanju SQL, velike črke zahtevajo narekovaje):

| Prisma model    | Tabela            | Opomba                                                      |
| --------------- | ----------------- | ----------------------------------------------------------- |
| `Uporabnik`     | `"Uporabnik"`     | centralna entiteta, `dostop` = vloga, `email` unique        |
| `Voznja`        | `"Voznja"`        | poslovni podatki: stranka, relacija, cena, `placano`        |
| `TahografZapis` | `tahograf_zapis`  | `stanje` (VOZNJA/ODMOR/POCITEK/DELO/RAZPOLOZLJIVOST/DRUGO), `vir` (POSNETO/UVOZ) |
| `Vozilo`        | `"Vozilo"`        | FK na `tip_vozila`                                          |
| `TipVozila`     | `tip_vozila`      |                                                             |
| `Stranka`       | `"Stranka"`       |                                                             |
| `LOG_voznja`    | `"LOG_voznja"`    | audit log; Prisma accessor je `app.prisma.lOG_voznja`       |

## Pasti in znane težave

- **Konvencije:** koda, imena spremenljivk, sporočila napak in commiti so v slovenščini — tako tudi nadaljuj.
- **Deploy:** vsak push na `main` avtomatsko deploya API na Fly.io (`projekt2026`), spremembe v `web/**` pa web (`sirena-web`). Migracije se v produkciji poženejo same (`release_command = npm run migrate`).
- **SonarCloud je izklopljen** (`gh workflow disable sonar.yml`, sept. 2026) — token je potekel. Navodila za ponovni vklop so v README, razdelek 18.
- **Produkcijski URL-ji:** `web/src/api/client.js` in `mobile/src/api/client.js` padeta nazaj na `https://projekt2026.fly.dev/api/v1`, če env spremenljivka ni nastavljena → brez `.env` lokalni frontend piše v **produkcijsko** bazo.
- **Login rate limit 3/min na IP** — pri lokalnem testiranju hitro dobiš HTTP 429; počakaj minuto.
- **`/auth/register` je samo za admine** (`app.authenticate` + `vloga === 2`). Javne registracije ni; prvega admina v prazni bazi ustvariš s `node --env-file=.env src/scripts/ustvari-admina.js <email> <geslo>` (iz `api/`).
- **Mrtve route:** `racuni.js` in `urna_postavka.js` kličeta `app.prisma.racun` / `app.prisma.urnaPostavka`, ki ju v shemi ni več (odstranjeno v migraciji `unified_voznja_remove_urnik`) → vedno HTTP 500. Stran „Računi“ na webu uporablja `/admin/voznje`.
- **Uvoz Excel:** voznik se poišče po imenu iz datoteke v obliki `"Priimek Ime"` (`findUser` v `ddd_upload.js`) — uporabnik mora obstajati s točno tem imenom/priimkom.
- **Web testi:** 3 testi (`Sidebar.test.jsx`, `ProtectedRoute.test.jsx`) padejo, ker iščejo besedila, ki jih v komponentah ni več (zastareli testi).
- **Google OAuth client ID** se bere iz okolja: `GOOGLE_CLIENT_ID` (API; brez njega `/auth/google-token` vrne 503) in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (mobile).
- **Izvoz Excel:** naziv in naslov podjetja v glavi prideta iz `PODJETJE_NAZIV` / `PODJETJE_NASLOV` / `PODJETJE_KRAJ` (prazno, če niso nastavljene).
- **Rate limit** se šteje po glavi `Fly-Client-IP` (`api/src/lib/ipOdjemalca.js`) — na Fly.io je `request.ip` naslov proxyja, enak za vse.
- **`/auth/refresh`** preveri podpis in sprejme tudi potekel žeton, a le do 30 dni po izdaji; potem je potrebna nova prijava.
- **Osebni podatki:** pravih `.DDD` / `.xlsx` datotek voznikov ne dodajaj v git (so v `.gitignore`); koda je objavljena tudi javno.
- `mobile/CLAUDE.md` → pred pisanjem Expo kode preberi dokumentacijo za Expo SDK 54.
