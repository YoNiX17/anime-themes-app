import { createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/Header';

export type SectionType = 'anime' | 'films' | 'series';

export interface RatingCategory {
  key: string;
  label: string;
  color: string;
}

export interface SectionConfig {
  type: SectionType;
  label: string;
  prefix: string;
  ratingKeys: RatingCategory[];
  firebaseRatingsNode: string;
  firebaseUserRatingsNode: string;
}

export const ANIME_CONFIG: SectionConfig = {
  type: 'anime',
  label: 'Anime',
  prefix: '/anime',
  ratingKeys: [
    { key: 'plot', label: 'Scénario', color: '#8b5cf6' },
    { key: 'characters', label: 'Personnages', color: '#06d6a0' },
    { key: 'animation', label: 'Animation', color: '#f72585' },
    { key: 'ost', label: 'OST', color: '#fbbf24' },
    { key: 'pacing', label: 'Rythme', color: '#06b6d4' },
  ],
  firebaseRatingsNode: 'ratings',
  firebaseUserRatingsNode: 'ratings',
};

export const FILMS_CONFIG: SectionConfig = {
  type: 'films',
  label: 'Films',
  prefix: '/films',
  ratingKeys: [
    { key: 'scenario', label: 'Scénario', color: '#e63946' },
    { key: 'acting', label: 'Acteurs', color: '#f4a261' },
    { key: 'directing', label: 'Réalisation', color: '#e76f51' },
    { key: 'music', label: 'Musique', color: '#2a9d8f' },
  ],
  firebaseRatingsNode: 'movieRatings',
  firebaseUserRatingsNode: 'movieRatings',
};

export const SERIES_CONFIG: SectionConfig = {
  type: 'series',
  label: 'Séries',
  prefix: '/series',
  ratingKeys: [
    { key: 'scenario', label: 'Scénario', color: '#3a86ff' },
    { key: 'acting', label: 'Acteurs', color: '#06b6d4' },
    { key: 'directing', label: 'Réalisation', color: '#8338ec' },
    { key: 'music', label: 'Musique', color: '#ff006e' },
    { key: 'pacing', label: 'Rythme', color: '#06d6a0' },
  ],
  firebaseRatingsNode: 'seriesRatings',
  firebaseUserRatingsNode: 'seriesRatings',
};

const SectionContext = createContext<SectionConfig>(ANIME_CONFIG);

export function useSection() {
  return useContext(SectionContext);
}

export function SectionLayout({ config }: { config: SectionConfig }) {
  return (
    <SectionContext.Provider value={config}>
      <div className={`section-${config.type}`}>
        <Header />
        <Outlet />
      </div>
    </SectionContext.Provider>
  );
}
