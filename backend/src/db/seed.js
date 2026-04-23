import 'dotenv/config';
import supabase from './client.js';

const ROUTES = [
  'hoboken-waterfront',
  'liberty-state-park',
  'saddle-river',
  'overpeck',
  'weehawken-track',
  'west-new-york-waterfront',
];

function statusForHour(routeId, day, hour) {
  const isWeekend = day === 0 || day === 6;
  const isSaturday = day === 6;
  const isSunday = day === 0;

  if (hour < 5 || hour >= 21) return 'empty';

  switch (routeId) {
    case 'hoboken-waterfront':
      if (isWeekend) {
        if (hour >= 8 && hour <= 11) return 'packed';
        if (hour >= 12 && hour <= 16) return 'moderate';
        if (hour >= 17 && hour <= 19) return 'packed';
        return 'moderate';
      }
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) return 'moderate';
      if (hour >= 12 && hour <= 13) return 'moderate';
      return 'empty';

    case 'liberty-state-park':
      if (isWeekend) {
        if (hour >= 9 && hour <= 16) return 'packed';
        if (hour >= 17 && hour <= 19) return 'moderate';
        return 'moderate';
      }
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 18)) return 'moderate';
      return 'empty';

    case 'saddle-river':
      if (isSaturday) {
        if (hour >= 7 && hour <= 10) return 'packed';
        if (hour >= 10 && hour <= 18) return 'moderate';
        return 'empty';
      }
      if (isSunday) {
        if (hour >= 8 && hour <= 11) return 'packed';
        if (hour >= 12 && hour <= 16) return 'moderate';
        return 'empty';
      }
      if ((hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 19)) return 'moderate';
      return 'empty';

    case 'overpeck':
      if (isSaturday) {
        if (hour >= 7 && hour <= 10) return 'packed';
        if (hour >= 10 && hour <= 14) return 'moderate';
        return 'empty';
      }
      if (isSunday) {
        if (hour >= 8 && hour <= 11) return 'packed';
        if (hour >= 12 && hour <= 15) return 'moderate';
        return 'empty';
      }
      if ((hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 19)) return 'moderate';
      return 'empty';

    case 'weehawken-track':
      // Municipal track — heavily used by local clubs and commuter runners
      if (isSaturday) {
        if (hour >= 7 && hour <= 10) return 'packed';
        if (hour >= 10 && hour <= 13) return 'moderate';
        return 'empty';
      }
      if (isSunday) {
        if (hour >= 8 && hour <= 11) return 'moderate';
        return 'empty';
      }
      // Weekday: early morning runners + post-work crowds
      if (hour >= 6 && hour <= 8) return 'moderate';
      if (hour >= 17 && hour <= 19) return 'packed';
      return 'empty';

    case 'west-new-york-waterfront':
      // Urban waterfront promenade — busy weekends, quieter than Hoboken
      if (isWeekend) {
        if (hour >= 9 && hour <= 12) return 'packed';
        if (hour >= 12 && hour <= 18) return 'moderate';
        if (hour >= 18 && hour <= 20) return 'moderate';
        return 'empty';
      }
      if ((hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 19)) return 'moderate';
      return 'empty';

    default:
      return 'empty';
  }
}

async function seed() {
  const rows = [];
  for (const routeId of ROUTES) {
    for (let day = 0; day <= 6; day++) {
      for (let hour = 0; hour <= 23; hour++) {
        rows.push({
          route_id: routeId,
          day_of_week: day,
          hour_of_day: hour,
          status: statusForHour(routeId, day, hour),
        });
      }
    }
  }

  // Upsert in chunks to stay within Supabase request limits
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from('typical_crowds')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'route_id,day_of_week,hour_of_day' });

    if (error) {
      console.error('❌ Seed failed:', error.message);
      process.exit(1);
    }
  }

  console.log(`✅ Seeded ${rows.length} typical crowd records`);
}

seed();
