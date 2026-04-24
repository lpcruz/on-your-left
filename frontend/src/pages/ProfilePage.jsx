import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/Header.jsx';

const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const justConnected = params.get('auth') === 'success';

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header showBack title="Your Profile" />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {justConnected && (
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
            Strava connected — you're all set!
          </div>
        )}

        {/* Athlete card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex items-center gap-4">
          {user.profile_photo ? (
            <img
              src={user.profile_photo}
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-orange-500"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-bold">
              {user.firstname?.[0] ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-gray-100 text-lg truncate">{user.name}</p>
            {(user.city || user.state) && (
              <p className="text-sm text-gray-500 truncate">
                {[user.city, user.state, user.country].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              <span className="text-xs text-orange-500 font-medium">Connected via Strava</span>
            </div>
          </div>
        </div>

        {/* Coming soon panel */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Coming soon</h2>
          <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
              <span>Automatic crowd reports — when you finish a run, we'll note what the route was like so others know.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
              <span>Your run history matched to routes you've explored.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
              <span>Opt-in: auto-add a crowd note to your Strava activity description.</span>
            </div>
          </div>
        </div>

        {/* Disconnect */}
        <button
          onClick={async () => { await logout(); navigate('/'); }}
          className="w-full text-center text-sm text-red-500 hover:text-red-600 py-2 transition-colors"
        >
          Disconnect Strava
        </button>

      </div>
    </div>
  );
}
