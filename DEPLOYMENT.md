# Deployment pe Railway — Red Medica

## Pași rapizi

### 1. Pregătire repository Git

```bash
cd medical-asistenta

# Inițializare Git (dacă nu există)
git init
git add .
git commit -m "Initial commit - Red Medica"

# Conectare la GitHub/GitLab
git remote add origin https://github.com/username/red-medica.git
git push -u origin main
```

### 2. Creare proiect pe Railway

1. Mergeți la [railway.app](https://railway.app) și autentificați-vă
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Selectați repository-ul `red-medica`
4. Railway detectează automat `railway.json` și pornește build-ul

### 3. Configurare variabile de mediu pe Railway

În dashboard Railway → **Variables**, adăugați:

| Variabilă | Valoare | Obligatorie |
|-----------|---------|-------------|
| `NODE_ENV` | `production` | ✓ |
| `JWT_SECRET` | *(șir aleatoriu lung)* | ✓ |
| `DATABASE_PATH` | `/data/asistenta.db` | recomandat |
| `ADMIN_EMAIL` | `admin@asistenta.ro` | opțional |
| `ADMIN_PASSWORD` | `Admin123!` | opțional |
| `ADMIN_NAME` | `Administrator` | opțional |

**Generați JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Adăugare Volume pentru baza de date

> ⚠️ **IMPORTANT**: Fără Volume, baza de date SQLite se pierde la fiecare restart!

1. În Railway, mergeți la serviciul dvs.
2. **Settings** → **Volumes** → **Add Volume**
3. **Mount Path**: `/data`
4. Setați `DATABASE_PATH=/data/asistenta.db` în Variables

### 5. Deploy

Railway face deploy automat la fiecare `git push`. Pentru deploy manual:
- Dashboard → **Deploy** → **Trigger Deploy**

---

## Ce face build-ul Railway

```
railway build:
  1. npm install                    ← root devDependencies
  2. npm run build:
     a. npm install --prefix backend   ← backend dependencies
     b. npm install --prefix frontend  ← React dependencies
     c. npm run build --prefix frontend ← build React → frontend/build/

railway start:
  node backend/server.js            ← servește API + React static files
```

## Arhitectura în producție

```
Client Browser
     ↓ HTTPS
Railway (single process, PORT auto)
     ↓
backend/server.js
  ├── /api/auth/*      → Express routes
  ├── /api/patients/*  → Express routes
  ├── /api/visits/*    → Express routes
  ├── /api/reports/*   → Express routes
  ├── /api/health      → Health check
  └── /*               → React app (frontend/build/index.html)
```

## Verificare deployment

```bash
# Health check
curl https://your-app.railway.app/api/health

# Login test
curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@asistenta.ro","password":"Admin123!"}'
```

---

## Development local

```bash
# Instalare dependențe
npm run build   # sau: cd backend && npm i && cd ../frontend && npm i

# Pornire (opțiunea 1 - script)
start.bat

# Pornire (opțiunea 2 - manual, două terminale)
node backend/server.js          # Terminal 1 - Backend pe :5000
cd frontend && npm start         # Terminal 2 - Frontend pe :3000
```

---

## Troubleshooting

### Baza de date se pierde după restart
→ Adăugați un Volume Railway montat la `/data` și setați `DATABASE_PATH=/data/asistenta.db`

### Eroare "Cannot find module"
→ Verificați că `npm run build` s-a executat cu succes în Railway Logs

### Frontend nu se încarcă
→ Verificați că `frontend/build/` există (generat de build command)
→ `NODE_ENV=production` trebuie setat în Railway Variables

### Userul admin nu se creează
→ Verificați că `DATABASE_PATH` pointează la un loc cu permisiuni de scriere
→ Verificați Railway Logs pentru erori la `initDatabase()`
