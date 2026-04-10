import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Loader } from './components/Loader';
import { SectionLayout, ANIME_CONFIG, FILMS_CONFIG, SERIES_CONFIG } from './contexts/SectionContext';
import './App.css';

const Hub = lazy(() => import('./pages/Hub').then(m => ({ default: m.Hub })));
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const SearchResults = lazy(() => import('./pages/SearchResults').then(m => ({ default: m.SearchResults })));
const PartyRoom = lazy(() => import('./pages/PartyRoom').then(m => ({ default: m.PartyRoom })));
const Leaderboard = lazy(() => import('./pages/Leaderboard').then(m => ({ default: m.Leaderboard })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const AnimeDetail = lazy(() => import('./pages/AnimeDetail').then(m => ({ default: m.AnimeDetail })));
const MediaHome = lazy(() => import('./pages/MediaHome').then(m => ({ default: m.MediaHome })));
const MediaSearch = lazy(() => import('./pages/MediaSearch').then(m => ({ default: m.MediaSearch })));
const MediaDetail = lazy(() => import('./pages/MediaDetail').then(m => ({ default: m.MediaDetail })));
const Playlist = lazy(() => import('./pages/Playlist').then(m => ({ default: m.Playlist })));
const MediaLeaderboard = lazy(() => import('./pages/MediaLeaderboard').then(m => ({ default: m.MediaLeaderboard })));
const MediaProfile = lazy(() => import('./pages/MediaProfile').then(m => ({ default: m.MediaProfile })));

function App() {
  return (
    <div className="app-container">
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<Hub />} />

          {/* Anime section */}
          <Route element={<SectionLayout config={ANIME_CONFIG} />}>
            <Route path="/anime" element={<Home />} />
            <Route path="/anime/search" element={<SearchResults />} />
            <Route path="/anime/:name" element={<AnimeDetail />} />
            <Route path="/anime/party/:id" element={<PartyRoom />} />
            <Route path="/anime/playlist" element={<Playlist />} />
            <Route path="/anime/leaderboard" element={<Leaderboard />} />
            <Route path="/anime/profile" element={<Profile />} />
          </Route>

          {/* Films section */}
          <Route element={<SectionLayout config={FILMS_CONFIG} />}>
            <Route path="/films" element={<MediaHome />} />
            <Route path="/films/search" element={<MediaSearch />} />
            <Route path="/films/:id" element={<MediaDetail />} />
            <Route path="/films/leaderboard" element={<MediaLeaderboard />} />
            <Route path="/films/profile" element={<MediaProfile />} />
          </Route>

          {/* Séries section */}
          <Route element={<SectionLayout config={SERIES_CONFIG} />}>
            <Route path="/series" element={<MediaHome />} />
            <Route path="/series/search" element={<MediaSearch />} />
            <Route path="/series/:id" element={<MediaDetail />} />
            <Route path="/series/leaderboard" element={<MediaLeaderboard />} />
            <Route path="/series/profile" element={<MediaProfile />} />
          </Route>
        </Routes>
      </Suspense>
      <Footer />
    </div>
  );
}

export default App;
