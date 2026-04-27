import { describe, it, expect } from 'vitest';
import {
  computePopularityScore,
  intensityToStatus,
  buildTypicalRows,
  parkRouteType,
  parkSegmentType,
} from '../strava/discover.js';

// ─── computePopularityScore ───────────────────────────────────────────────────

describe('computePopularityScore', () => {
  it('returns 0 for empty segment', () => {
    expect(computePopularityScore({})).toBe(0);
  });

  it('returns 0 for zero counts', () => {
    expect(computePopularityScore({ effort_count: 0, athlete_count: 0, star_count: 0 })).toBe(0);
  });

  it('rewards athlete count and diversity', () => {
    // 100 athletes, 200 efforts → diversity 0.5 → score = 100 * 1.5 = 150
    const score = computePopularityScore({ effort_count: 200, athlete_count: 100, star_count: 0 });
    expect(score).toBe(150);
  });

  it('highly diverse segment (1 effort per athlete) scores highest', () => {
    const diverse = computePopularityScore({ effort_count: 100, athlete_count: 100, star_count: 0 });
    const repeated = computePopularityScore({ effort_count: 1000, athlete_count: 100, star_count: 0 });
    expect(diverse).toBeGreaterThan(repeated);
  });

  it('star count adds significant weight', () => {
    const withStars = computePopularityScore({ effort_count: 100, athlete_count: 50, star_count: 10 });
    const noStars   = computePopularityScore({ effort_count: 100, athlete_count: 50, star_count: 0 });
    expect(withStars - noStars).toBe(200); // 10 stars × 20
  });

  it('uses 0.5 diversity fallback when effort_count is 0', () => {
    const score = computePopularityScore({ effort_count: 0, athlete_count: 50, star_count: 0 });
    expect(score).toBe(75); // 50 * (1 + 0.5)
  });
});

// ─── intensityToStatus ────────────────────────────────────────────────────────

describe('intensityToStatus', () => {
  it('returns empty for very low intensity', () => {
    expect(intensityToStatus(0.02, 500, 100)).toBe('empty');
    expect(intensityToStatus(0, 500, 100)).toBe('empty');
  });

  it('unknown park (score=0) returns moderate only above the scaled threshold', () => {
    // scaled = intensity * 0.25; returns moderate when scaled >= 0.10 (i.e. intensity >= 0.4)
    expect(intensityToStatus(1.0, 0, 0)).toBe('moderate');
    expect(intensityToStatus(0.4, 0, 0)).toBe('moderate');
    // Below the threshold → empty
    expect(intensityToStatus(0.3, 0, 0)).toBe('empty');
    expect(intensityToStatus(0.1, 0, 0)).toBe('empty');
  });

  it('unknown park (score=0) never returns packed', () => {
    for (const intensity of [0.1, 0.5, 0.9, 1.0]) {
      expect(intensityToStatus(intensity, 0, 0)).not.toBe('packed');
    }
  });

  it('known low-density park tips moderate before packed', () => {
    // density ~10 → low tier, higher thresholds
    const status = intensityToStatus(0.5, 200, 10);
    expect(['moderate', 'packed']).toContain(status);
  });

  it('known high-density location tips packed at lower intensity', () => {
    // density ~10000 (busy track) should tip packed sooner
    const highDensity = intensityToStatus(0.55, 5000, 10000);
    const lowDensity  = intensityToStatus(0.55, 200, 10);
    // high density should be packed or >= lowDensity status
    const rank = { empty: 0, moderate: 1, packed: 2 };
    expect(rank[highDensity]).toBeGreaterThanOrEqual(rank[lowDensity]);
  });

});

// ─── buildTypicalRows ─────────────────────────────────────────────────────────

describe('buildTypicalRows', () => {
  it('generates exactly 168 rows (7 days × 24 hours)', () => {
    const rows = buildTypicalRows('test-route', 500, 0.3, 'route');
    expect(rows).toHaveLength(168);
  });

  it('every row has required fields', () => {
    const rows = buildTypicalRows('test-route', 500, 0.3, 'route');
    for (const row of rows) {
      expect(row).toHaveProperty('route_id', 'test-route');
      expect(row.day_of_week).toBeGreaterThanOrEqual(0);
      expect(row.day_of_week).toBeLessThanOrEqual(6);
      expect(row.hour_of_day).toBeGreaterThanOrEqual(0);
      expect(row.hour_of_day).toBeLessThanOrEqual(23);
      expect(['empty', 'moderate', 'packed']).toContain(row.status);
    }
  });

  it('midnight (hour 0) is always empty', () => {
    const rows = buildTypicalRows('test-route', 1000, 0.3, 'route');
    const midnightRows = rows.filter(r => r.hour_of_day === 0);
    expect(midnightRows.every(r => r.status === 'empty')).toBe(true);
  });

  it('tracks (sprint) with no Strava data get floor score — not all empty', () => {
    const rows = buildTypicalRows('test-track', 0, 0.02, 'sprint');
    const nonEmpty = rows.filter(r => r.status !== 'empty');
    expect(nonEmpty.length).toBeGreaterThan(0);
  });

  it('non-track with no Strava data skews toward empty', () => {
    const rows = buildTypicalRows('test-park', 0, 0.3, 'route');
    const emptyCount = rows.filter(r => r.status === 'empty').length;
    // Unknown parks have intensity scaled to 25%, so majority of hours are empty
    expect(emptyCount).toBeGreaterThan(rows.length * 0.6); // >60% empty
  });

  it('popular park has some busy slots on Saturday morning', () => {
    const rows = buildTypicalRows('test-route', 2000, 0.3, 'route');
    // Saturday (day=6) 8am should be busy for a popular park
    const satMorning = rows.find(r => r.day_of_week === 6 && r.hour_of_day === 8);
    expect(['moderate', 'packed']).toContain(satMorning?.status);
  });
});

// ─── parkRouteType ────────────────────────────────────────────────────────────

describe('parkRouteType', () => {
  it('classifies tracks by name', () => {
    expect(parkRouteType({ name: 'Bergenfield High School Track', category: 'sports_facility' })).toBe('track');
    expect(parkRouteType({ name: 'Weehawken Track', category: 'sports_facility' })).toBe('track');
  });

  it('classifies stadiums as tracks', () => {
    expect(parkRouteType({ name: 'Giants Stadium', category: 'sports_facility' })).toBe('track');
  });

  it('does NOT classify generic sports facilities as tracks', () => {
    expect(parkRouteType({ name: 'The Football Factory', category: 'sports_facility' })).toBe('park');
  });

  it('classifies trails', () => {
    expect(parkRouteType({ name: 'Mill Creek Marsh Trail', category: 'park' })).toBe('trail');
    expect(parkRouteType({ name: 'Flat Rock Brook', category: 'nature_reserve' })).toBe('trail');
  });

  it('defaults to park', () => {
    expect(parkRouteType({ name: 'Overpeck County Park', category: 'park' })).toBe('park');
    expect(parkRouteType({ name: 'Central Park', category: 'recreation_area' })).toBe('park');
  });
});

// ─── parkSegmentType ──────────────────────────────────────────────────────────

describe('parkSegmentType', () => {
  it('returns sprint for track categories', () => {
    expect(parkSegmentType({ category: 'running_track' })).toBe('sprint');
  });

  it('returns hill for nature/trail categories', () => {
    expect(parkSegmentType({ category: 'nature_reserve' })).toBe('hill');
    expect(parkSegmentType({ category: 'trail' })).toBe('hill');
  });

  it('defaults to route', () => {
    expect(parkSegmentType({ category: 'park' })).toBe('route');
    expect(parkSegmentType({ category: 'recreation_area' })).toBe('route');
  });
});

// ─── haversineMiles (inline — same logic as webhook.js) ───────────────────────

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe('haversineMiles', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMiles(40.9, -74.0, 40.9, -74.0)).toBeCloseTo(0);
  });

  it('Bergenfield HS Track start point is within 0.5mi of center', () => {
    // Activity start from yesterday's run
    const dist = haversineMiles(40.925991, -74.008464, 40.9251775, -74.0110611);
    expect(dist).toBeLessThan(0.5);
    expect(dist).toBeCloseTo(0.147, 1);
  });

  it('Windsor Road start is outside 0.5mi of HS Track', () => {
    const dist = haversineMiles(40.913945, -74.002220, 40.9251775, -74.0110611);
    expect(dist).toBeGreaterThan(0.5);
  });

  it('roughly correct for known distance (1 degree lat ≈ 69mi)', () => {
    const dist = haversineMiles(40.0, -74.0, 41.0, -74.0);
    expect(dist).toBeCloseTo(69, 0);
  });
});
