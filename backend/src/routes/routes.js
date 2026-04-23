/**
 * Route metadata — single source of truth for the four MVP routes.
 * Coordinates are center points used for map display.
 */
export const ROUTES = [
  {
    id: 'hoboken-waterfront',
    name: 'Hoboken / Weehawken Waterfront',
    shortName: 'Hoboken Waterfront',
    description: '~3 miles along the Hudson River piers',
    location: 'Hoboken & Weehawken, NJ',
    center: [-74.0324, 40.744],
    zoom: 14,
    color: '#6366f1',
  },
  {
    id: 'liberty-state-park',
    name: 'Liberty State Park Promenade',
    shortName: 'Liberty State Park',
    description: '~5 mile loop with NYC skyline views',
    location: 'Jersey City, NJ',
    center: [-74.0613, 40.7003],
    zoom: 14,
    color: '#0ea5e9',
  },
  {
    id: 'saddle-river',
    name: 'Saddle River County Park',
    shortName: 'Saddle River',
    description: 'Duck Pond loop, ~6 miles of paved path',
    location: 'Ridgewood / Saddle Brook, NJ',
    center: [-74.1088, 40.9951],
    zoom: 13,
    color: '#10b981',
  },
  {
    id: 'overpeck',
    name: 'Overpeck County Park',
    shortName: 'Leonia',
    description: 'Flat 5K + 10K loops through 811-acre county park',
    location: 'Leonia, NJ',
    center: [-74.0000, 40.8650],
    zoom: 14,
    color: '#f59e0b',
  },
  {
    id: 'weehawken-track',
    name: 'Weehawken Waterfront Park & Track',
    shortName: 'Weehawken Track',
    description: '19-acre waterfront park with 400m track & Hudson River Walk',
    location: 'Weehawken, NJ · 1 Port Imperial Blvd',
    center: [-74.01915, 40.76443],
    zoom: 15,
    color: '#ec4899',
  },
  {
    id: 'west-new-york-waterfront',
    name: 'West New York Waterfront',
    shortName: 'WNY Waterfront',
    description: 'Riverwalk path starting at Son Cubano with Manhattan skyline views',
    location: 'West New York, NJ · 40 Riverwalk Pl',
    center: [-74.0054, 40.7816],
    zoom: 15,
    color: '#8b5cf6',
  },
];

export const ROUTE_IDS = new Set(ROUTES.map((r) => r.id));
