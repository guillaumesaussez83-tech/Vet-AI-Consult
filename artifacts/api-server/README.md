# @workspace/api-server

API Express VétoAI.

## Variables d'environnement

Voir `.env.example` pour la liste complète.

### Sentry (monitoring)

Définir `SENTRY_DSN` dans les variables d'environnement Railway (onglet Variables du service) pour activer le reporting d'erreurs serveur. Si la variable est vide ou absente, Sentry est désactivé silencieusement (no-op) — l'API tourne normalement.

Côté frontend, la variable correspondante est `VITE_SENTRY_DSN` (à définir dans le service vetcare ou au build).

Configuration : `tracesSampleRate=0.1`, `environment=$NODE_ENV`.
