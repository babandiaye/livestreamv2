# LiveStreamV2 — Plateforme Webinaire UN-CHK

Clone fonctionnel de Greenlight/BigBlueButton utilisant LiveKit comme moteur WebRTC et LiveKit Egress pour les enregistrements.

## Stack technique

- **Frontend** : Next.js 15, React 19, Tailwind CSS
- **WebRTC** : LiveKit (server-sdk + components-react)
- **Enregistrements** : LiveKit Egress → MinIO S3
- **Base de données** : PostgreSQL + Prisma 7
- **Authentification** : Keycloak SSO (SenID) via NextAuth v5
- **Package manager** : pnpm

## Infrastructure

- **Serveur** : srv-livekit-formation3 (102.36.138.100)
- **App** : `/var/www/html/livestreamv2` — port 4000
- **Service** : systemd `livestream`
- **Repo** : git@github.com:babandiaye/livestreamv2.git
- **Branches** : `main` (v1.0.0 taggée), `v2` (branche active)

## Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| `ADMIN` | Dashboard admin complet — toutes les salles, tous les utilisateurs, tous les enregistrements |
| `MODERATOR` | Dashboard modérateur — ses salles uniquement, enrôlement des participants, ses enregistrements |
| `VIEWER` | Vue étudiant — salles enrôlées, enregistrements accessibles, rejoindre une session |

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Page de connexion SSO SenID |
| `/` | Redirection selon le rôle |
| `/dashboard` | Dashboard ADMIN — salles + enregistrements |
| `/moderator` | Dashboard MODERATOR — salles + enrôlement + enregistrements |
| `/admin` | Interface admin — stats, salles, utilisateurs, enregistrements |
| `/student` | Vue VIEWER — salles enrôlées + enregistrements |
| `/host` | Interface animateur LiveKit |
| `/watch/[roomName]` | Vue spectateur LiveKit |

## Routes API

### Salles
- `GET/POST /api/rooms` — salles selon le rôle
- `DELETE/PATCH /api/rooms/[id]` — modifier ou supprimer une salle

### Admin
- `GET /api/admin/rooms` — toutes les salles avec compteurs
- `GET/POST/DELETE /api/admin/rooms/[id]/enroll` — enrôlement individuel
- `POST /api/admin/rooms/[id]/enroll-csv` — enrôlement en masse CSV
- `GET/PATCH /api/admin/users` — liste et changement de rôle (ADMIN uniquement)
- `GET /api/admin/users/search` — recherche utilisateur
- `GET /api/admin/recordings` — enregistrements (ADMIN uniquement)
- `GET /api/admin/stats` — statistiques globales

### Enregistrements
- `GET /api/recordings/me` — enregistrements selon le rôle

### LiveKit
- `POST /api/create_stream` — créer une salle LiveKit
- `POST /api/join_stream` — rejoindre une salle
- `POST /api/create_ingress` — ingress OBS/RTMP/WHIP
- `POST /api/start_recording` — démarrer l'enregistrement Egress
- `POST /api/stop_recording` — arrêter l'enregistrement
- `POST /api/start-streaming` — diffusion RTMP multi-destinations
- `POST /api/stop-streaming` — arrêter la diffusion
- `POST /api/invite_to_stage` — inviter un participant sur scène
- `POST /api/remove_from_stage` — retirer de la scène
- `POST /api/raise_hand` — lever la main
- `POST /api/webhook/livekit` — webhook Egress → sauvegarde en base
- `GET /api/download-recording` — streaming vidéo depuis MinIO S3

## Schéma Prisma
```prisma
User        — id, keycloakId, email, name, role, sessions, enrollments
Session     — id, roomName, title, creatorId, status, chatEnabled, participationEnabled, moodleCourseId
Recording   — id, sessionId, s3Key, s3Bucket, filename, duration, size, egressId
Enrollment  — id, userId, sessionId, createdBy
```

## Migrations

| Migration | Description |
|-----------|-------------|
| `20260317190825_init` | Schéma initial — User, Session, Recording |
| `20260318141200_add_enrollment` | Ajout de la table Enrollment |

## Variables d'environnement
```env
NEXT_PUBLIC_SITE_URL=
LIVEKIT_WS_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
S3_ACCESS_KEY=
S3_SECRET=
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
KEYCLOAK_CLIENT_ID=
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_ISSUER=
AUTH_SECRET=
AUTH_URL=
DATABASE_URL=
```

## Installation
```bash
pnpm install
pnpm prisma migrate deploy
pnpm build
service livestream restart
```

## Prochaine étape

Plugin Moodle communiquant via API avec cette plateforme (comme l'intégration Moodle/BigBlueButton).

## Conception

- **DITSI** — Université Numérique Cheikh Hamidou Kane (UN-CHK)
- © 2026 — Tous droits réservés
