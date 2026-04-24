import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '../App.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
        aria-label="User menu"
      >
        {user.profile_photo ? (
          <img
            src={user.profile_photo}
            alt={user.firstname}
            className="w-7 h-7 rounded-full object-cover ring-2 ring-orange-500"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
            {user.firstname?.[0] ?? '?'}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{user.name}</p>
            {user.city && (
              <p className="text-xs text-gray-500 truncate">{[user.city, user.state].filter(Boolean).join(', ')}</p>
            )}
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/profile'); }}
            className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Your profile
          </button>
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            Disconnect Strava
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header({ title, showBack = false }) {
  const navigate = useNavigate();
  const { isDark, toggle } = useThemeContext();
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 safe-top">
      <div className="flex items-center h-14 px-4 gap-3 max-w-lg mx-auto">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {!showBack && (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        )}

        <div className="flex-1">
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight truncate">
            {title || 'On Your Left'}
          </h1>
          {!title && (
            <p className="text-xs text-gray-500 leading-tight">Running routes near you</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
            aria-label="Toggle theme"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          {!loading && (
            user ? (
              <UserMenu user={user} logout={logout} />
            ) : (
              <a
                href={`${API}/auth/strava`}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors touch-manipulation whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Connect
              </a>
            )
          )}
        </div>
      </div>
    </header>
  );
}
