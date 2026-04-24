import { createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTheme } from './hooks/useTheme.js';
import { AuthProvider } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import RoutePage from './pages/RoutePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

export const ThemeContext = createContext({ theme: 'dark', toggle: () => {}, isDark: true });
export const useThemeContext = () => useContext(ThemeContext);

export default function App() {
  const themeValue = useTheme();

  return (
    <ThemeContext.Provider value={themeValue}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/route/:routeId" element={<RoutePage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
