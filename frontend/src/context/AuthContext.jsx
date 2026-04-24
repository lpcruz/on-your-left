import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then(({ user }) => setUser(user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
