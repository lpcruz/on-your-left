import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '../App.jsx';

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

export default function Header({ title, showBack = false }) {
  const navigate = useNavigate();
  const { isDark, toggle } = useThemeContext();

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

        <button
          onClick={toggle}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
          aria-label="Toggle theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}
