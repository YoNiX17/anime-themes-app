import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Loader } from './components/Loader';
import './App.css';

const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const PartyRoom = lazy(() => import('./pages/PartyRoom').then(m => ({ default: m.PartyRoom })));
const Leaderboard = lazy(() => import('./pages/Leaderboard').then(m => ({ default: m.Leaderboard })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const AnimeDetail = lazy(() => import('./pages/AnimeDetail').then(m => ({ default: m.AnimeDetail })));

function App() {
  return (
    <div className="app-container">
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/anime/:name" element={<AnimeDetail />} />
          <Route path="/party/:id" element={<PartyRoom />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Suspense>
      <Footer />
    </div>
  );
}

export default App;
