import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';
const POLL_INTERVAL = 60_000; // refresh every 60 seconds

export function useRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/routes`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRoutes(data.routes);
      setLastUpdated(new Date(data.generatedAt));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
    const interval = setInterval(fetchRoutes, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRoutes]);

  return { routes, loading, error, lastUpdated, refetch: fetchRoutes };
}

export function useRoute(routeId) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoute = useCallback(async () => {
    if (!routeId) return;
    try {
      const res = await fetch(`${API_BASE}/routes/${routeId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRoute(data.route);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    fetchRoute();
    const interval = setInterval(fetchRoute, 30_000);
    return () => clearInterval(interval);
  }, [fetchRoute]);

  return { route, loading, error, refetch: fetchRoute };
}

export async function submitReport(routeId, status) {
  const res = await fetch(`${API_BASE}/routes/${routeId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
