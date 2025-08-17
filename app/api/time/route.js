export async function GET() {
  const tz = 'Atlantic/Bermuda';
  const now = new Date();

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true
  }).format(now);

  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', month: 'short', day: 'numeric'
  }).format(now);

  // offset in minutes, positive east of UTC
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
  const parts = fmt.formatToParts(now);
  const off = (parts.find(p => p.type === 'timeZoneName')?.value || 'UTC+0').replace('UTC', '');
  
  // Basic parse like +1:00 -> 60
  let offsetMinutes = 0;
  try {
    const m = off.match(/([+-])(\d+)(?::(\d+))?/);
    if (m) {
      offsetMinutes = (m[1] === '-' ? -1 : 1) * (parseInt(m[2],10)*60 + (parseInt(m[3]||'0',10)));
    }
  } catch {}

  return Response.json({
    timeZone: tz,
    iso: new Date(now.getTime() + offsetMinutes*60000 - (new Date().getTimezoneOffset()*60000)).toISOString(),
    time, 
    date, 
    offsetMinutes
  });
}