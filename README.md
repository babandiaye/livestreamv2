# LiveStreamV2 — Plateforme Webinaire UN-CHK

Plateforme de webinaire institutionnelle basée sur LiveKit, Next.js 15, Prisma et Keycloak SSO. Intègre un plugin Moodle natif pour la gestion des sessions depuis le LMS.

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Temps réel | LiveKit (WebRTC) |
| Base de données | PostgreSQL 16 + Prisma 7 |
| Auth | Keycloak SSO via NextAuth |
| Stockage vidéo | MinIO (compatible S3) |
| LMS | Moodle 4.5+ + Plugin PHP mod_livestream |
| Serveur | Ubuntu 22/24, Node.js 20+, pnpm |
| Process manager | systemd |
| Orchestration | Docker Compose |

---

## Prérequis

### Système
- Ubuntu 22.04 ou 24.04
- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose
- Git

### Services requis (à déployer séparément)
- **LiveKit Server** — SFU WebRTC
- **LiveKit Egress** — enregistrement vidéo
- **LiveKit Ingress** — flux OBS/RTMP
- **Redis** — coordination LiveKit
- **PostgreSQL 16** — base de données
- **MinIO** — stockage S3 des enregistrements
- **Keycloak** — SSO institutionnel
- **Moodle 4.5+** — LMS

---

## Infrastructure Docker (LiveKit Stack)

Le fichier `compose.yaml` orchestre les services LiveKit :
```yaml
# /opt/livekit/compose.yaml
services:
  postgresql:   # PostgreSQL 16 — base de données
  redis:        # Redis 7 — coordination LiveKit
  livekit:      # LiveKit SFU — moteur WebRTC
  egress:       # LiveKit Egress — enregistrement + streaming
  ingress:      # LiveKit Ingress — flux OBS RTMP/WHIP
```

### Démarrer la stack LiveKit
```bash
cd /opt/livekit
docker compose up -d

# Vérifier que tous les services sont up
docker compose ps
```

### Variables d'environnement PostgreSQL
```bash
# /opt/livekit/env.d/postgresql
POSTGRES_DB=<nom_base>
POSTGRES_USER=<utilisateur>
POSTGRES_PASSWORD=<mot_de_passe>
```

---

## Installation LiveStreamV2

### 1. Cloner le dépôt
```bash
git clone git@github.com:babandiaye/livestreamv2.git /var/www/html/livestreamv2
cd /var/www/html/livestreamv2
git checkout main
```

### 2. Installer les dépendances
```bash
pnpm install
```

### 3. Configurer les variables d'environnement
```bash
cp .env.example .env
nano .env
```

Renseigner toutes les variables (voir `.env.example` ci-dessous).

### 4. Initialiser la base de données
```bash
# Appliquer les migrations Prisma
pnpm prisma migrate deploy

# Générer le client Prisma
pnpm prisma generate
```

### 5. Builder l'application
```bash
pnpm build
```

### 6. Configurer le service systemd
```bash
nano /etc/systemd/system/livestream.service
```
```ini
[Unit]
Description=LiveKit Livestream Frontend
After=network.target

[Service]
User=root
Group=root
WorkingDirectory=/var/www/html/livestreamv2
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5
Environment="NODE_ENV=production"
LimitNOFILE=50000
StandardOutput=append:/var/log/livestream_outpout.log
StandardError=append:/var/log/livestream_error.log

[Install]
WantedBy=multi-user.target
```
```bash
systemctl daemon-reload
systemctl enable livestream
systemctl start livestream
```

---

## Variables d'environnement (.env)

Créer un fichier `.env` à la racine du projet. **Ne jamais committer ce fichier.**
```env
# ── Application ──────────────────────────────────────
NEXT_PUBLIC_SITE_URL=https://<votre-domaine>
AUTH_URL=https://<votre-domaine>
AUTH_TRUST_HOST=true

# ── LiveKit ──────────────────────────────────────────
LIVEKIT_WS_URL=wss://<livekit-domain>
LIVEKIT_API_KEY=<votre-api-key>
LIVEKIT_API_SECRET=<votre-api-secret>

# ── MinIO S3 ─────────────────────────────────────────
S3_ACCESS_KEY=<access-key>
S3_SECRET=<secret-key>
S3_ENDPOINT=http://<minio-host>:<port>
S3_REGION=us-east-1
S3_BUCKET=<nom-du-bucket>

# ── Keycloak SSO ─────────────────────────────────────
KEYCLOAK_ENABLED=true
KEYCLOAK_AUTO_REDIRECT=true
NEXT_PUBLIC_KEYCLOAK_ENABLED=true
KEYCLOAK_CLIENT_ID=<client-id>
KEYCLOAK_CLIENT_SECRET=<client-secret>
KEYCLOAK_ISSUER=https://<keycloak-host>/realms/<realm>

# ── NextAuth ─────────────────────────────────────────
AUTH_SECRET=<secret-32-chars-minimum>

# ── PostgreSQL ───────────────────────────────────────
DATABASE_URL="postgresql://<user>:<password>@127.0.0.1:5432/<database>"

# ── Plugin Moodle ────────────────────────────────────
MOODLE_API_KEY=<cle-api-sans-caracteres-speciaux>

# ── Divers ───────────────────────────────────────────
WATCH_PUBLIC=true
```

> **Note** : La clé `MOODLE_API_KEY` ne doit pas contenir de caractères spéciaux (`#`, `$`, `!`, etc.) pour éviter les problèmes d'interprétation shell.

---

## Commandes de déploiement

### Déployer une mise à jour
```bash
cd /var/www/html/livestreamv2

# 1. Récupérer les dernières modifications
git pull origin main

# 2. Installer les nouvelles dépendances si nécessaire
pnpm install

# 3. Appliquer les migrations Prisma si nécessaire
pnpm prisma migrate deploy

# 4. Rebuilder l'application
pnpm build

# 5. Redémarrer le service
service livestream restart
```

### Vérifier les logs
```bash
# Logs applicatifs (webhooks, enregistrements, etc.)
tail -f /var/log/livestream_outpout.log

# Logs d'erreur
tail -f /var/log/livestream_error.log

# Statut du service systemd
systemctl status livestream

# Logs Egress LiveKit
docker logs livekit_egress -f
```

### Gérer le service
```bash
# Redémarrer
service livestream restart

# Arrêter
service livestream stop

# Démarrer
service livestream start
```

### Gérer la stack Docker LiveKit
```bash
cd /opt/livekit

# Démarrer
docker compose up -d

# Arrêter
docker compose down

# Redémarrer un service
docker compose restart egress

# Voir les logs Egress
docker compose logs egress -f

# Statut de tous les services
docker compose ps
```

### Commandes base de données utiles
```bash
# Accéder à PostgreSQL
docker exec -it livekit_postgresql psql -U <user> -d <database> -h 127.0.0.1

# Lister les sessions
docker exec livekit_postgresql psql -U <user> -d <database> -h 127.0.0.1 \
  -c "SELECT id, \"roomName\", status, \"createdAt\" FROM \"Session\" ORDER BY \"createdAt\" DESC LIMIT 10;"

# Lister les utilisateurs
docker exec livekit_postgresql psql -U <user> -d <database> -h 127.0.0.1 \
  -c "SELECT id, email, name, role FROM \"User\" ORDER BY \"createdAt\" DESC LIMIT 10;"

# Voir les enrollments d'une salle
docker exec livekit_postgresql psql -U <user> -d <database> -h 127.0.0.1 \
  -c "SELECT e.id, u.email, e.\"sessionId\", e.\"createdBy\" FROM \"Enrollment\" e JOIN \"User\" u ON u.id = e.\"userId\" WHERE e.\"sessionId\" = '<session-id>';"

# Forcer le statut ENDED d'une session
docker exec livekit_postgresql psql -U <user> -d <database> -h 127.0.0.1 \
  -c "UPDATE \"Session\" SET status = 'ENDED', \"endedAt\" = NOW() WHERE \"roomName\" = '<room-name>';"

# Supprimer tous les enrollments d'une salle (pour tests)
docker exec livekit_postgresql psql -U <user> -d <database> -h 127.0.0.1 \
  -c "DELETE FROM \"Enrollment\" WHERE \"sessionId\" = '<session-id>';"
```

### Prisma (migrations)
```bash
cd /var/www/html/livestreamv2

# Appliquer les migrations en production
pnpm prisma migrate deploy

# Voir le statut des migrations
pnpm prisma migrate status

# Régénérer le client Prisma
pnpm prisma generate

# Ouvrir Prisma Studio (développement uniquement)
pnpm prisma studio
```

---

## Plugin Moodle (mod_livestream)

### Installation
```bash
# Sur le serveur Moodle
cp -r mod_livestream /var/www/html/<moodle>/mod/livestream/
chown -R www-data:www-data /var/www/html/<moodle>/mod/livestream/
```

Puis aller dans **Administration Moodle → Notifications** pour finaliser l'installation.

### Configuration admin Moodle

Aller dans **Administration → Plugins → Modules d'activité → LiveStream** :

| Paramètre | Valeur |
|-----------|--------|
| URL LiveStream | `https://<votre-domaine>` |
| Clé API | `<MOODLE_API_KEY>` |
| Timeout | `30` secondes |
| Enrôlement auto | Activé |

### API Moodle disponibles

Toutes les routes nécessitent le header `X-Api-Key: <MOODLE_API_KEY>`.

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/moodle/rooms` | Créer ou récupérer une salle |
| GET | `/api/moodle/rooms/[id]/status` | Statut de la salle |
| GET | `/api/moodle/rooms/[id]/recordings` | Liste des enregistrements |
| POST | `/api/moodle/join` | Rejoindre en tant qu'étudiant |
| POST | `/api/moodle/start` | Démarrer en tant que modérateur |
| POST | `/api/moodle/enroll` | Enrôlement masse depuis Moodle |
| DELETE | `/api/moodle/recordings/[id]` | Supprimer un enregistrement |

---

## Architecture
```
┌─────────────────────────────────────────────────────┐
│                    Moodle (LMS)                     │
│              mod_livestream (PHP)                   │
└────────────────────┬────────────────────────────────┘
                     │ API REST (X-Api-Key)
┌────────────────────▼────────────────────────────────┐
│           LiveStreamV2 (Next.js 15)                 │
│  /host  /watch  /admin  /moderator  /student        │
│              API Routes Next.js                     │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌────▼────────┐
│  LiveKit    │ │PostgreSQL │ │   MinIO S3  │
│  (WebRTC)   │ │ (Prisma)  │ │(Enreg. MP4)│
│  + Egress   │ └───────────┘ └────────────┘
└──────┬──────┘
       │
┌──────▼──────┐
│   Keycloak  │
│    (SSO)    │
└─────────────┘
```

---

## Rôles utilisateurs

| Rôle | Redirection | Accès |
|------|-------------|-------|
| `ADMIN` | `/dashboard` | Gestion complète — salles, utilisateurs, enregistrements |
| `MODERATOR` | `/moderator` | Ses salles, enrôlement CSV/individuel, enregistrements |
| `VIEWER` | `/student` | Sessions auxquelles il est enrôlé |

---

## Enrôlement CSV

Le modèle CSV est téléchargeable depuis l'interface :
**Import CSV → Télécharger le modèle**

Format accepté :
```csv
email,prenom,nom
etudiant@domaine.sn,Prénom,Nom
```

- Séparateur `,` ou `;`
- Colonnes : `email` obligatoire, `prenom` et `nom` optionnels
- Les utilisateurs inexistants sont **créés automatiquement**
- Traitement par batch de 500 — supporte jusqu'à 10 000 utilisateurs

---

## Versions

| Version | Description |
|---------|-------------|
| v1.0.0 | MVP — LiveKit + auth Keycloak |
| v2.0.0 | Enrôlement, enregistrements S3, dashboard admin |
| v3.0.0 | Plugin Moodle + fix Egress + CSV + statut session + kick |

---

## Équipe

**DITSI — Université Numérique Cheikh Hamidou Kane (UN-CHK)**
© 2026 — Tous droits réservés
