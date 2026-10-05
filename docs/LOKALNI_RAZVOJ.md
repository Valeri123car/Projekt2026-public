# Lokalni razvoj — zagon in dostop do baze

Vse spodaj je preverjeno na Windows 11 (Git Bash / PowerShell). Ukazi delujejo v obeh lupinah, razen kjer je navedeno drugače.

## Predpogoji

| Orodje         | Preverjeno z | Opomba                                                 |
| -------------- | ------------ | ------------------------------------------------------ |
| Node.js        | 24.x         | ≥ 20.6 (zaradi `--env-file`)                           |
| Docker Desktop | 29.x         | mora **teči**, preden zaženeš bazo                     |
| Python         | 3.12         | + `pip install openpyxl` (uvoz/izvoz Excel)            |

`psql` na računalniku **ni** potreben — uporabljamo tistega v Docker kontejnerju.

## 1. Prvi zagon (enkrat)

```bash
# .env datoteke (niso v gitu) — skopiraj primere in izpolni skrivnosti
cp api/.env.example api/.env
cp web/.env.example web/.env
cp mobile/.env.example mobile/.env      # vpiši IP svojega PC-ja (ipconfig → Wi-Fi IPv4)

# Odvisnosti
cd api && npm install && cd ..
cd web && npm install && cd ..
cd mobile && npm install && cd ..
pip install openpyxl

# Baza + migracije
cd api
docker compose up -d
npx prisma migrate deploy
npx prisma generate
```

## 2. Vsakodnevni zagon (3 terminali)

```bash
# Terminal 1 — baza + API
cd api
docker compose up -d        # če Docker Desktop še ni zagnan, ga najprej odpri
npm run dev                 # http://localhost:3000   (health: /health, Swagger: /docs)

# Terminal 2 — web
cd web
npm run dev                 # http://localhost:5173

# Terminal 3 — mobile (neobvezno)
cd mobile
npx expo start              # QR koda → Expo Go; telefon mora biti na istem Wi-Fi
```

> Če Windows Firewall ob prvem zagonu API-ja vpraša za dovoljenje za Node.js, dovoli **zasebna omrežja**, sicer telefon ne pride do API-ja.

### Uporabniki

Sveža baza je prazna. Gesla za lokalno bazo si izmisli sam; nikoli ne uporabljaj istih kot v produkciji.

**Prvi admin** (javne registracije ni — `/auth/register` lahko kliče samo admin):

```bash
cd api
node --env-file=.env src/scripts/ustvari-admina.js <email> <geslo>
```

**Ostali uporabniki:** prijavi se v web kot admin → stran **Uporabniki** → dodaj. Ali prek terminala z admin žetonom (`dostop`: 1 = voznik, 2 = admin, 3 = vodstvo):

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<email>","geslo":"<geslo>"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -X POST http://localhost:3000/api/v1/admin/uporabniki \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"ime":"Janez","priimek":"Novak","email":"janez@example.com","geslo":"<geslo>","dostop":1}'
```

> Login ima omejitev **3 poskuse na minuto**. Ob HTTP 429 počakaj eno minuto.

## 3. Dostop do baze

**Podatki za povezavo** (iz `api/docker-compose.yml`):

| Polje    | Vrednost    |
| -------- | ----------- |
| Host     | `localhost` |
| Port     | `5433` (ne 5432!) |
| Baza     | `sirena`    |
| User     | `sirena`    |
| Geslo    | `postgres` (ali vrednost `POSTGRES_PASSWORD` iz `api/.env`) |

Connection string: `postgresql://sirena:postgres@localhost:5433/sirena`

### a) Terminal — psql v Docker kontejnerju

```bash
cd api
docker compose exec db psql -U sirena -d sirena
```

Ali od koderkoli (ime kontejnerja je `api-db-1`):

```bash
docker exec -it api-db-1 psql -U sirena -d sirena
```

> V Git Bash, če dobiš napako `the input device is not a TTY`, dodaj `winpty` spredaj: `winpty docker exec -it api-db-1 psql -U sirena -d sirena`. V PowerShellu to ni potrebno.

**Uporabni psql ukazi:**

| Ukaz                   | Kaj naredi                                  |
| ---------------------- | ------------------------------------------- |
| `\dt`                  | seznam tabel                                |
| `\d "Uporabnik"`       | struktura tabele                            |
| `\x`                   | vklop/izklop navpičnega izpisa (široke vrstice) |
| `\q`                   | izhod                                       |

**Pozor na imena tabel:** tabele z veliko začetnico **morajo** biti v dvojnih narekovajih, drugače jih Postgres ne najde.

```sql
SELECT id_uporabnik, ime, priimek, email, dostop FROM "Uporabnik";
SELECT * FROM "Voznja" ORDER BY datum DESC LIMIT 20;
SELECT * FROM "Vozilo";
SELECT * FROM "Stranka";
SELECT * FROM tip_vozila;                         -- male črke, brez narekovajev
SELECT stanje, vir, count(*) FROM tahograf_zapis GROUP BY 1, 2;
SELECT * FROM "LOG_voznja" ORDER BY timestamp DESC LIMIT 20;

-- Nekoga naredi za admina
UPDATE "Uporabnik" SET dostop = 2 WHERE email = 'voznik@example.com';
```

Ukaz brez interaktivne seje (enkraten SQL):

```bash
docker exec api-db-1 psql -U sirena -d sirena -c 'SELECT email, dostop FROM "Uporabnik";'
```

### b) Prisma Studio (GUI v brskalniku)

```bash
cd api
npx prisma studio            # odpre http://localhost:5555
```

### c) Zunanji GUI (DBeaver, pgAdmin, TablePlus, VS Code ekstenzija)

Nova PostgreSQL povezava s podatki iz tabele zgoraj (port **5433**).

## 4. Upravljanje baze

```bash
cd api

# Sprememba sheme: uredi prisma/schema.prisma, nato
npx prisma migrate dev --name kratek_opis_spremembe

# Stanje migracij
npx prisma migrate status

# Varnostna kopija / obnova
docker exec api-db-1 pg_dump -U sirena sirena > backup.sql
docker exec -i api-db-1 psql -U sirena -d sirena < backup.sql

# Počisti vse podatke in ponovno poženi migracije (BRIŠE PODATKE)
npx prisma migrate reset

# Ustavi bazo (podatki ostanejo v Docker volumnu)
docker compose stop
# Ustavi in izbriši tudi podatke (BRIŠE PODATKE)
docker compose down -v
```

## 5. Produkcija (Fly.io) — samo branje, previdno

Produkcijska baza je na Fly.io in ni javno dostopna. Za dostop rabiš `flyctl` in pravice na Fly.io računu:

```bash
fly auth login
fly postgres list                          # ime Postgres aplikacije
fly postgres connect -a <ime-postgres-app> # psql seja v produkcijsko bazo
# ali tunel na lokalni port, nato GUI na localhost:15432:
fly proxy 15432:5432 -a <ime-postgres-app>
```

> Vsak push na `main` avtomatsko deploya na produkcijo. Migracije se tam poženejo same.

## Pogoste težave

| Simptom | Vzrok / rešitev |
| --- | --- |
| `failed to connect to the docker API ... dockerDesktopLinuxEngine` | Docker Desktop ni zagnan — odpri ga in počakaj ~1 min. |
| `Can't reach database server at localhost:5433` | Baza ne teče → `cd api && docker compose up -d`. |
| API: `ENCRYPTION_KEY` / `secret` napaka ob zagonu | Manjka `api/.env` ali API ni zagnan z `npm run dev` iz mape `api/`. |
| Web se prijavi, a ni lokalnih podatkov | `web/.env` kaže na produkcijo; nastavi `VITE_API_URL=http://localhost:3000/api/v1` in ponovno zaženi `npm run dev`. |
| Mobile: `Network Error` | Napačen IP v `mobile/.env`, telefon ni na istem Wi-Fi ali firewall blokira port 3000. Po spremembi `.env` zaženi `npx expo start -c`. |
| Uvoz Excel: „Nobeden od voznikov ni najden“ | V bazi mora obstajati uporabnik z imenom/priimkom iz datoteke (`"Priimek Ime"`). |
| HTTP 429 na loginu | Rate limit 3/min — počakaj minuto. |
