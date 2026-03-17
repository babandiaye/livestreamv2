# LiveStream — Plateforme de diffusion vidéo en direct

Plateforme de webinaires et de streaming en direct basée sur [LiveKit](https://livekit.io), développée avec Next.js 15, React 19 et TypeScript, aux couleurs de l'**Université Numérique Cheikh Hamidou Kane (UN-CHK)**.

## Fonctionnalités

- **Créer un stream** depuis le navigateur (caméra + micro)
- **Diffuser via OBS** en RTMP ou WHIP (latence ultra-faible)
- **Rejoindre en tant que spectateur** avec pseudo
- **Lever la main** pour demander à intervenir
- **Monter sur scène** — micro, caméra, partage d'écran
- **Chat en direct** entre tous les participants
- **Enregistrement** seul (S3/MinIO) ou simultané avec la diffusion
- **Diffuser et enregistrer** simultanément vers YouTube/SunuTube + S3
- **Layout intelligent** — partage d'écran en grand, caméras en PIP automatique
- **Page des enregistrements** avec lecture vidéo inline et téléchargement
- **Streaming multi-plateformes** — YouTube, SunuTube et tout serveur RTMP
- **Authentification SSO Keycloak** — login institutionnel UN-CHK, logout complet
- **Protection des routes et APIs** — création de salle réservée aux authentifiés
- **Identité visuelle UN-CHK** — logo, favicon, header/footer institutionnel

## Branches

| Branche | Description |
|---------|-------------|
| `main`  | Version stable courante (v6.3) |
| `v1`    | Version initiale — host/watch, lever la main, chat |
| `v2`    | Enregistrement + stockage MinIO |
| `v3`    | Diffusion RTMP vers YouTube |
| `v4`    | Ingress OBS RTMP/WHIP, streaming multi-plateformes |
| `v5`    | Identité visuelle UN-CHK, page enregistrements player inline |
| `v5.1`  | Fix token Bearer WHIP OBS 30+, benchmark 200 subscribers validé |
| `v6`    | Authentification SSO Keycloak (NextAuth v5), protection APIs |
| `v6.1`  | Protection APIs create_stream/ingress + boutons conditionnels auth |
| `v6.2`  | Bouton Diffuser et enregistrer simultané |
| `v6.3`  | Layout speaker-dark + PIP caméra/partage d'écran |
| `v6.6`  | UI spectateur/animateur redesignée + fix chat (messages conservés au changement d'onglet) |

## Prérequis

- Node.js 18+
- pnpm
- Serveur LiveKit + LiveKit Egress
- LiveKit Ingress (pour OBS RTMP/WHIP)
- MinIO ou compatible S3
- Keycloak (optionnel — activable via `.env.local`)

## Installation
```bash
git clone git@github.com:babandiaye/livestream.git
cd livestream
pnpm install
```

Créez un fichier `.env.local` à la racine :
```env
NEXT_PUBLIC_SITE_URL=https://votre-domaine.com
LIVEKIT_WS_URL=wss://votre-livekit.com
LIVEKIT_API_KEY=votre_api_key
LIVEKIT_API_SECRET=votre_api_secret

# MinIO / S3
S3_ACCESS_KEY=votre_access_key
S3_SECRET=votre_secret
S3_ENDPOINT=http://votre-minio:9000
S3_REGION=us-east-1
S3_BUCKET=livekit-recordings

# Keycloak SSO (optionnel)
KEYCLOAK_ENABLED=true              # true = auth activée, false = désactivée
KEYCLOAK_AUTO_REDIRECT=false       # true = redirection auto, false = page login avec bouton
WATCH_PUBLIC=true                  # true = /watch accessible sans auth
KEYCLOAK_CLIENT_ID=votre_client_id
KEYCLOAK_CLIENT_SECRET=votre_secret
KEYCLOAK_ISSUER=https://votre-keycloak/realms/votre-realm
AUTH_SECRET=votre_secret_32chars   # openssl rand -base64 32
AUTH_URL=https://votre-domaine.com
AUTH_TRUST_HOST=true
NEXT_PUBLIC_KEYCLOAK_ENABLED=true  # exposé au client pour affichage conditionnel
```

## Démarrage
```bash
# Développement
pnpm dev

# Production
pnpm build && pnpm start

# Production en arrière-plan avec tuning mémoire
nohup node --max-old-space-size=4096 node_modules/.bin/next start -p 4000 \
  > /var/log/visiomeet.log 2>&1 &
```

## Layout vidéo intelligent

Le layout s'adapte automatiquement selon les flux actifs :

| Situation | Affichage (React + Egress) |
|-----------|---------------------------|
| Partage d'écran actif | Screen en plein écran + caméras en PIP coin bas-droit |
| Partage d'écran arrêté | Caméra(s) en plein écran |
| Aucun flux | Message "En attente du stream..." |

Pour la diffusion RTMP/WHIP et l'enregistrement, l'egress utilise le layout `speaker-dark` (H264 1080p30) qui applique la même logique automatiquement.

## Enregistrement et diffusion

| Bouton | Action |
|--------|--------|
| ⏺ Enregistrer | Enregistrement S3 seul, sans diffusion externe |
| 📡 Diffuser et enregistrer | Streaming RTMP multi-plateformes + enregistrement S3 simultané |

## Authentification Keycloak

### Comportement selon `.env.local`

| Variable | Valeur | Effet |
|----------|--------|-------|
| `KEYCLOAK_ENABLED` | `false` | Auth désactivée, accès libre |
| `KEYCLOAK_ENABLED` | `true` | Auth activée |
| `KEYCLOAK_AUTO_REDIRECT` | `false` | Page `/login` avec bouton "Se connecter" |
| `KEYCLOAK_AUTO_REDIRECT` | `true` | Redirection directe vers Keycloak |
| `WATCH_PUBLIC` | `true` | `/watch/:roomName` accessible sans auth |
| `WATCH_PUBLIC` | `false` | `/watch/:roomName` protégé |

### Flux d'authentification
```
Utilisateur → preprod-rtc3.unchk.sn
  → Middleware vérifie session
  → Si non authentifié :
      AUTO_REDIRECT=false → Page /login → bouton → Keycloak
      AUTO_REDIRECT=true  → Keycloak directement
  → Keycloak authentifie
  → Callback /api/auth/callback/keycloak
  → Session NextAuth créée
  → Redirect vers page demandée
```

### Logout SSO
```
Clic Déconnexion → NextAuth signOut → POST Keycloak /logout (id_token_hint) → Session SSO terminée
```

### Protection des routes et APIs

- `/` — protégée (auth requise si `KEYCLOAK_ENABLED=true`)
- `/host` — protégée
- `/recordings` — protégée
- `/watch/:roomName` — configurable via `WATCH_PUBLIC`
- `/login` — publique
- `/api/auth/*` — publique
- `/api/create_stream` — 401 si non authentifié
- `/api/create_ingress` — 401 si non authentifié

### Configuration Nginx (obligatoire pour Keycloak)
```nginx
proxy_buffer_size       128k;
proxy_buffers           4 256k;
proxy_busy_buffers_size 256k;
```

## Tuning performance (2500+ utilisateurs)

### Nginx `/etc/nginx/nginx.conf`
```nginx
worker_connections 65535;
worker_rlimit_nofile 524288;
multi_accept on;
use epoll;
keepalive_timeout 3600s;
keepalive_requests 100000;
```

### Kernel `/etc/sysctl.d/99-livekit.conf`
```
fs.file-max = 2097152
fs.nr_open = 2097152
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.core.rmem_max = 268435456
net.core.wmem_max = 268435456
net.core.rmem_default = 67108864
net.core.wmem_default = 67108864
net.ipv4.tcp_rmem = 4096 87380 268435456
net.ipv4.tcp_wmem = 4096 65536 268435456
net.ipv4.tcp_mem = 786432 1048576 26777216
net.ipv4.udp_rmem_min = 65536
net.ipv4.udp_wmem_min = 65536
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_keepalive_time = 300
net.ipv4.ip_local_port_range = 1024 65535
net.netfilter.nf_conntrack_max = 524288
net.netfilter.nf_conntrack_tcp_timeout_established = 432000
net.netfilter.nf_conntrack_udp_timeout = 30
vm.swappiness = 5
vm.overcommit_memory = 1
```

### Node.js
```bash
node --max-old-space-size=4096 node_modules/.bin/next start -p 4000
```

### LiveKit `livekit-server.yaml`
```yaml
rtc:
  packet_buffer_size: 500
  pli_throttle:
    low_quality: 500ms
    mid_quality: 1s
    high_quality: 2s
  congestion_control:
    enabled: true
    allow_pause: true

room:
  max_participants: 4500

limit:
  num_tracks: 18000
  bytes_per_sec: 2_000_000_000
```

### LiveKit Egress `egress.yaml` (jobs simultanés)
```yaml
cpu_cost:
  room_composite_cpu_cost: 2.0
  track_composite_cpu_cost: 1.0
  track_cpu_cost: 0.5
```
Avec 8 vCPU → max_cost=4.0 → streaming + enregistrement simultanés possibles.

### Docker `compose.yaml`
```yaml
services:
  livekit:
    ulimits:
      nofile:
        soft: 524288
        hard: 524288
```

## Capacité testée

Tests réalisés depuis une **machine externe** avec `livekit-cli v2.13.2` (1 publisher vidéo + 2 audio, simulcast H264) sur serveur 32 GB RAM / 24 vCPU :

| Subscribers | Goroutines serveur | CPU    | RAM     | Résultat |
|-------------|-------------------|--------|---------|----------|
| 500         | ~25 000           | ~80%   | ~1.5 GiB | ✅ |
| 1 000       | ~50 000           | ~150%  | ~2.5 GiB | ✅ |
| 2 000       | ~100 000          | ~250%  | ~3.5 GiB | ✅ |
| 2 500+      | ~200 000          | ~300%  | ~5 GiB   | ✅ |

> **Important** : le load-test doit être lancé depuis une **machine externe** au serveur LiveKit. Le CLI co-localisé sur le même serveur sature la boucle réseau locale et bloque les connexions autour de 2 000 subscribers — ce n'est pas une limite du serveur.

Capacité estimée : **3 000 subscribers simultanés** dans une même room (limite architecturale mono-nœud LiveKit, validée par la [documentation officielle](https://docs.livekit.io/transport/self-hosting/benchmark/)).

## Diffusion OBS

### Via RTMP
- **URL** : `rtmps://formation-livekit3.unchk.sn:1936/live`
- **Clé de stream** : générée depuis l'interface "Diffuser via OBS"

### Via WHIP (latence ultra-faible < 1s)
- **URL** : `https://formation-livekit3.unchk.sn/whip`
- **Authentification** : token Bearer généré depuis l'interface "Diffuser via OBS"

## Structure du projet
```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # Route NextAuth (Keycloak OIDC)
│   │   ├── create_stream/        # Création room + token host (protégé)
│   │   ├── create_ingress/       # Flux RTMP/WHIP OBS (protégé)
│   │   ├── join_stream/          # Token spectateur
│   │   ├── invite_to_stage/      # Monter spectateur sur scène
│   │   ├── remove_from_stage/    # Retirer de la scène
│   │   ├── raise_hand/           # Lever / baisser la main
│   │   ├── stop_stream/          # Fermer la room
│   │   ├── start_recording/      # Enregistrement Egress → S3 (speaker-dark)
│   │   ├── stop_recording/       # Stopper l'enregistrement
│   │   ├── recordings/           # Lister les enregistrements MinIO
│   │   ├── download-recording/   # URL présignée de téléchargement
│   │   ├── start-streaming/      # Streaming RTMP multi-plateformes (speaker-dark)
│   │   └── stop-streaming/       # Stopper le streaming
│   ├── host/                     # Interface animateur + PIP layout
│   ├── watch/[roomName]/         # Interface spectateur + PIP layout
│   ├── recordings/               # Page enregistrements player inline
│   └── login/                    # Page connexion Keycloak
├── components/
│   ├── chat.tsx                  # Chat temps réel (état préservé via display:none)
│   ├── token-context.tsx         # Contexte token LiveKit
│   ├── create-stream-dialog.tsx  # Dialog création stream navigateur
│   ├── obs-dialog.tsx            # Dialog diffusion OBS RTMP/WHIP
│   ├── streaming-dialog.tsx      # Dialog streaming multi-plateformes
│   └── session-provider.tsx      # SessionProvider NextAuth (client)
├── auth.ts                       # Config NextAuth + Keycloak + logout SSO
├── middleware.ts                  # Protection routes (KEYCLOAK_ENABLED)
└── lib/
    └── controller.ts             # Logique métier LiveKit
```

## Stack technique

- **Frontend** : Next.js 15, React 19, TypeScript
- **Temps réel** : LiveKit SDK v2, WebRTC
- **Auth** : NextAuth v5 (beta), Keycloak OIDC
- **Enregistrement** : LiveKit Egress → MinIO S3
- **Ingress** : LiveKit Ingress — RTMP (port 1935) + WHIP
- **Styling** : CSS inline

## Infrastructure serveur

| Service         | Port(s)                | Description                        |
|-----------------|------------------------|------------------------------------|
| LiveKit         | 7880 / 7881 / 7882 UDP | Serveur WebRTC                     |
| LiveKit Egress  | interne                | Enregistrement + streaming composé |
| LiveKit Ingress | 1935 / 8085            | Réception flux OBS RTMP/WHIP       |
| MinIO           | 9000 / 9001            | Stockage enregistrements           |
| Redis           | 6379                   | Coordination LiveKit               |
| Keycloak        | 443                    | SSO institutionnel UN-CHK          |
| Next.js         | 4000                   | Application web                    |

## Notes de déploiement
```yaml
# egress.yaml — pointer LiveKit en interne
ws_url: ws://livekit:7880
insecure: true

# ingress.yaml — pointer LiveKit en externe
ws_url: wss://formation-livekit3.unchk.sn
```

---

*© DITSI — Université Numérique Cheikh Hamidou Kane (UN-CHK) — 2026*
