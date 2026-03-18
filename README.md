# LiveStreamV2

Plateforme de webinaires et de visioconférences pour l'Université Numérique Cheikh Hamidou Kane (UN-CHK), construite avec Next.js, LiveKit et Keycloak.

---

## Stack technique

- **Next.js 15** (App Router)
- **LiveKit** — serveur de visioconférence temps réel
- **NextAuth v5** — authentification SSO via Keycloak
- **Prisma 7** + **PostgreSQL** — base de données
- **MinIO / S3** — stockage des enregistrements

---

## Prérequis

- Node.js 20+ et pnpm 9+
- PostgreSQL 14+
- Un serveur LiveKit opérationnel
- Un bucket S3 compatible (MinIO recommandé)
- Un realm Keycloak avec un client OIDC configuré

---

## Installation

```bash
# 1. Cloner le dépôt
git clone git@github.com:babandiaye/livestreamv2.git
cd livestreamv2

# 2. Installer les dépendances
pnpm install

# 3. Configurer les variables d'environnement
cp env.example .env
nano .env

# 4. Appliquer les migrations
npx prisma migrate deploy

# 5. Builder
pnpm build

# 6. Démarrer (port 4000)
pnpm start
```

---

## Variables d'environnement

```env
# Application
NEXT_PUBLIC_SITE_URL=https://votre-domaine.sn
AUTH_URL=https://votre-domaine.sn
AUTH_SECRET=                        # openssl rand -base64 32
AUTH_TRUST_HOST=true

# LiveKit
LIVEKIT_WS_URL=wss://rtc.votre-domaine.sn
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# Stockage S3 / MinIO
S3_ENDPOINT=http://10.0.0.1:9000
S3_ACCESS_KEY=
S3_SECRET=
S3_BUCKET=webinairerecordings
S3_REGION=us-east-1

# Keycloak
KEYCLOAK_ENABLED=true
KEYCLOAK_AUTO_REDIRECT=true
KEYCLOAK_CLIENT_ID=
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_ISSUER=https://auth.votre-domaine.sn/realms/VOTRE_REALM
WATCH_PUBLIC=true

# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/livestreamv2
```

---

## Configuration Keycloak

Dans votre realm, créer un client OIDC puis créer ces deux rôles dans l'onglet **Roles** du client :

| Rôle Keycloak | Rôle dans l'app | Permissions |
|---|---|---|
| `livestream-admin` | ADMIN | Accès total |
| `livestream-moderator` | MODERATOR | Gestion de ses salles |
| *(aucun)* | VIEWER | Lecture seule — défaut |

---

## Premier compte admin

**Méthode 1 — Via Keycloak (recommandé)**

1. Dans Keycloak, ouvrir l'utilisateur cible
2. Aller dans **Role Mappings > Client roles > votre-client**
3. Assigner le rôle `livestream-admin`
4. L'utilisateur se déconnecte et se reconnecte

**Méthode 2 — Directement en base (urgence)**

Après une première connexion SSO de l'utilisateur :

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'votre@email.sn';
```

---

## Rôles et permissions

| Action | Admin | Modérateur | Spectateur |
|---|:---:|:---:|:---:|
| Gérer les salles | Toutes | Ses salles | — |
| Gérer les utilisateurs | ✓ | ✓ | — |
| Attribuer des rôles | ✓ | — | — |
| Enrôler des utilisateurs | ✓ | Ses salles | — |
| Import CSV | ✓ | Ses salles | — |
| Démarrer une session | ✓ | Ses salles | — |
| Supprimer enregistrements | ✓ | — | — |
| Voir enregistrements | Toutes salles | Ses salles | Salles assignées |
| Rejoindre une session | ✓ | ✓ | Salles assignées |

---

## Service systemd (production)

Créer `/etc/systemd/system/livestream.service` :

```ini
[Unit]
Description=LiveStreamV2
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/html/livestream_v2
ExecStart=/usr/bin/node node_modules/.bin/next start -p 4000
Restart=always
EnvironmentFile=/var/www/html/livestream_v2/.env

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable livestream
systemctl start livestream

# Logs en temps réel
journalctl -u livestream -f
```

---

## Commandes utiles

```bash
# Développement
pnpm dev

# Migrations
npx prisma migrate dev --name nom_du_changement
npx prisma migrate deploy        # production
npx prisma generate              # régénérer le client

# Interface Prisma
npx prisma studio

# Service
systemctl restart livestream
journalctl -u livestream -f
```

---

## Structure du projet

```
src/
├── app/
│   ├── api/          # Routes API REST
│   ├── admin/        # Interface d'administration
│   ├── watch/        # Page de visionnage LiveKit
│   ├── recordings/   # Liste des enregistrements
│   └── dashboard.client.tsx
├── auth.ts           # NextAuth + sync Keycloak → Prisma
├── components/       # Composants réutilisables
└── lib/
    ├── prisma.ts     # Singleton Prisma
    └── controller.ts
prisma/
└── schema.prisma     # Schéma base de données
```

---

## Licence

Projet interne — DITSI / Université Numérique Cheikh Hamidou Kane (UN-CHK) — 2026
