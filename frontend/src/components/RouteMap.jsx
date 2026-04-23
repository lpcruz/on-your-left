import { useEffect, useRef } from 'react';
import { useThemeContext } from '../App.jsx';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function RouteMap({ route }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const { isDark } = useThemeContext();

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return;

    async function initMap() {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      if (mapRef.current) {
        mapRef.current.setStyle(isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11');
        return;
      }

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
        center: route.center,
        zoom: route.zoom,
        interactive: false,
        attributionControl: false,
      });

      map.on('load', () => {
        new mapboxgl.Marker({ color: route.color })
          .setLngLat(route.center)
          .addTo(map);
      });

      mapRef.current = map;
    }

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [route, isDark]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-40 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 dark:text-gray-600 text-xs">Map preview</p>
          <p className="text-gray-300 dark:text-gray-700 text-xs mt-0.5">Add VITE_MAPBOX_TOKEN to enable</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-40 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800"
    />
  );
}
