import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home, Sparkles, Video, Film, Settings } from 'lucide-react';
import HomePage from './pages/Home';
import CreateVideoPage from './pages/CreateVideo';
import ViralStudioPage from './pages/ViralStudio';
import MyVideosPage from './pages/MyVideos';

function Navbar() {
  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <NavLink to="/" className="navbar-brand">
          <div className="navbar-logo">🎬</div>
          <div>
            <div className="navbar-title">SujathaVlogs Studio</div>
            <div className="navbar-subtitle">AI Video Creator</div>
          </div>
        </NavLink>
      </div>
    </nav>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-content">
        <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
          <Home size={22} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/create" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Video size={22} />
          <span>Create</span>
        </NavLink>
        <NavLink to="/viral" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Sparkles size={22} />
          <span>Viral AI</span>
        </NavLink>
        <NavLink to="/videos" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Film size={22} />
          <span>My Videos</span>
        </NavLink>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="container" style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateVideoPage />} />
          <Route path="/viral" element={<ViralStudioPage />} />
          <Route path="/videos" element={<MyVideosPage />} />
        </Routes>
      </main>
      <BottomNav />
    </BrowserRouter>
  );
}

export default App;
