# NoteHub — anime-themes-app

Plateforme web collaborative de notation multi-médias : **anime** (avec openings/endings), **films** et **séries TV**. Les utilisateurs notent chaque œuvre sur plusieurs critères, rejoignent des *party rooms* temps réel, construisent des tier lists et consultent des leaderboards communautaires.

## Stack

- **React 19** + **TypeScript strict** + **Vite 8**
- **React Router 7** (lazy loading des pages)
- **Firebase** : Authentication (Google OAuth) + Realtime Database
- **Vitest** pour les tests
- Déploiement **Vercel**

## Sources de données

| API | Usage |
|---|---|
| [AnimeThemes](https://animethemes.moe) | Openings / endings anime (vidéos + métadonnées) |
| [Jikan](https://jikan.moe) (MyAnimeList) | Détails anime, staff, épisodes, recommandations |
| [AniList](https://anilist.co) (GraphQL) | Personnages |
| [TMDB](https://themoviedb.org) | Films + séries TV |
| [MyMemory](https://mymemory.translated.net) | Traduction FR des synopsis |

## Variables d'environnement

Créer un fichier `.env.local` à la racine :

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_TMDB_API_KEY=...
```

## Scripts

```bash
npm install          # installe les dépendances
npm run dev          # serveur de développement (Vite)
npm run build        # build production (tsc + vite)
npm run preview      # preview du build
npm test             # exécute la suite Vitest
npm run test:watch   # Vitest en mode watch
npm run lint         # ESLint
```

## Architecture

```
src/
  components/   UI réutilisable (RatingControl, cards, modals, Toast…)
  contexts/     AuthContext (Firebase), SectionContext (anime/films/séries)
  hooks/        useSiteScore (note agrégée d'un item)
  pages/        Pages lazy-loadées (Home, AnimeDetail, MediaDetail, PartyRoom…)
  services/     api (AnimeThemes/Jikan/AniList/MyMemory), tmdb, firebase,
                malImport, party, anilist, cache (mémoïsation TTL)
  utils/        animeGrouping, ratingMeta, playlistParser
```

### Points d'architecture

- **`SectionContext`** : Films et Séries partagent les mêmes composants (`MediaHome`, `MediaDetail`, `MediaSearch`, `MediaLeaderboard`) grâce à un contexte qui fournit le préfixe d'URL, les catégories de notation et le nœud Firebase cible.
- **`services/cache.ts`** : cache TTL en mémoire avec déduplication des requêtes concurrentes. Utilisé par Jikan, TMDB, traduction — évite les refetch à chaque navigation.
- **`hooks/useSiteScore.ts`** : lit le nœud `meta/` d'un item (moyennes précalculées) avec fallback sur `users/`. Partagé entre `AnimeDetail` et `MediaDetail`.
- **Jikan rate limiter** : 350 ms minimum entre requêtes (limite 3 req/s de Jikan).

## Firebase Realtime Database

Arborescence :

```
ratings/{animeId}            ← notes anime (plot, characters, animation, ost, pacing)
themeRatings/{themeId}       ← notes openings/endings (music, animation)
movieRatings/{movieId}       ← notes films (scenario, acting, directing, music)
seriesRatings/{seriesId}     ← notes séries (+ pacing)
parties/{roomId}             ← party rooms temps réel
users/{uid}/profile          ← profil public
users/{uid}/ratings, …       ← historique des notes de l'utilisateur (lisible publiquement
                               pour le profil public)
```

Chaque nœud de notation porte :
- `meta/` : `avgOverall`, `count`, `averages` par catégorie (agrégation recalculée via `utils/ratingMeta.ts`)
- `users/{uid}/` : notes détaillées

Les règles de sécurité se trouvent dans [`database.rules.json`](./database.rules.json).

## Tests

Suite Vitest minimale pour l'instant (`npm test`) :

- `utils/animeGrouping.test.ts` — normalisation de franchises
- `services/cache.test.ts` — TTL, déduplication, propagation d'erreur

## Déploiement

Vercel : `vercel.json` définit les rewrites SPA et quelques en-têtes de sécurité. Les règles Firebase sont déployées séparément via la Firebase CLI.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
