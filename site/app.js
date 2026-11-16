// Creator calendar: shows Michelle's week from calendar.json, in general terms only.
// calendar.json is made by scripts/build-calendar.mjs from her private workspace calendar.
(function () {
  const TYPES = {
    task: { label: 'Admin & planning', color: '#9aa0a6' },
    meeting: { label: 'Call / meeting', color: '#5b8cc9' },
    'creator-outreach': { label: 'Creator outreach', color: '#3f8f6b' },
    'brand-pitch': { label: 'Brand pitches', color: '#8a6fc0' },
    'follow-up': { label: 'Follow-ups', color: '#d0904a' },
    'brand-outreach': { label: 'Brand outreach', color: '#ff3b30' },
  };
  const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const $ = (id) => document.getElementById(id);

  let data = { items: [], focus: {}, timezone: 'America/Argentina/Buenos_Aires', offset: '-03:00', zoneName: 'Buenos Aires' };
  let weekStart = mondayOf(todayInZone());

  function pad(n) {
    return String(n).padStart(2, '0');
  }
  function iso(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parse(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function mondayOf(d) {
    const day = d.getDay();
    return addDays(d, day === 0 ? -6 : 1 - day);
  }
  // "Today" as it is in Michelle's time zone, so the highlight matches her calendar.
  function todayInZone() {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: data.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      return parse(parts);
    } catch {
      return new Date();
    }
  }
  function text(tag, cls, value) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value != null) el.textContent = value;
    return el;
  }
  function clock(date, minutesFromStart) {
    const at = new Date(`${date}T00:00:00${data.offset}`);
    return new Date(at.getTime() + minutesFromStart * 60000);
  }
  function timeLabel(item) {
    if (!item.time) return 'All day';
    const [h, m] = item.time.split(':').map(Number);
    const start = clock(item.date, h * 60 + m);
    const end = clock(item.date, h * 60 + m + (Number(item.duration) || 30));
    const fmt = (d, tz) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz });
    const theirs = `${fmt(start, data.timezone)} – ${fmt(end, data.timezone)}`;
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!localZone || fmt(start, localZone) === fmt(start, data.timezone)) return theirs;
    return `${theirs} (${fmt(start, localZone)} your time)`;
  }

  function render() {
    const today = iso(todayInZone());
    // Monday to Friday, plus the weekend when something is on it.
    const weekend = [5, 6].map((n) => iso(addDays(weekStart, n)));
    const showWeekend = data.items.some((i) => weekend.includes(i.date));
    const days = [0, 1, 2, 3, 4, ...(showWeekend ? [5, 6] : [])].map((n) => addDays(weekStart, n));

    const first = days[0];
    const last = days[days.length - 1];
    const sameMonth = first.getMonth() === last.getMonth();
    $('range').textContent = `${first.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString([], {
      month: sameMonth ? undefined : 'short',
      day: 'numeric',
    })}, ${last.getFullYear()}`;

    const week = $('week');
    week.replaceChildren();
    week.style.setProperty('--days', days.length);
    days.forEach((d, i) => {
      const date = iso(d);
      const day = text('div', `day${date === today ? ' today' : ''}`);
      day.style.setProperty('--i', i);
      const head = text('div', 'dayhead');
      head.append(text('small', null, DAY_NAMES[d.getDay()]), text('b', null, String(d.getDate())));
      const focus = data.focus?.[String(d.getDay())];
      if (focus?.label) head.append(text('span', `focus${focus.noCalls ? ' nocalls' : ''}`, focus.label));
      day.append(head);

      const items = data.items.filter((it) => it.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      if (!items.length) {
        day.append(text('div', 'empty', 'Nothing scheduled'));
      } else {
        const list = text('div', 'items');
        items.forEach((it) => {
          const type = TYPES[it.type] || TYPES.task;
          const el = text('div', 'item');
          el.style.setProperty('--type', type.color);
          // The event's own title when it's public, otherwise just the kind of work.
          const title = typeof it.title === 'string' && it.title.trim() ? it.title.trim() : type.label;
          el.append(text('b', null, title), text('small', null, timeLabel(it)));
          el.title = `${title} · ${type.label}`;
          list.append(el);
        });
        day.append(list);
      }
      week.append(day);
    });
  }

  function renderLegend() {
    const legend = $('legend');
    legend.replaceChildren();
    Object.values(TYPES).forEach((t) => {
      const span = text('span');
      const dot = text('i');
      dot.style.setProperty('--type', t.color);
      span.append(dot, document.createTextNode(t.label));
      legend.append(span);
    });
  }

  function renderFoot() {
    const parts = [`Times in ${data.zoneName || 'Buenos Aires'} time.`];
    if (data.updatedAt) {
      parts.push(`Last updated ${new Date(data.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`);
    }
    $('foot').textContent = parts.join(' ');
  }

  $('prev').addEventListener('click', () => {
    weekStart = addDays(weekStart, -7);
    render();
  });
  $('next').addEventListener('click', () => {
    weekStart = addDays(weekStart, 7);
    render();
  });
  $('today').addEventListener('click', () => {
    weekStart = mondayOf(todayInZone());
    render();
  });

  // ---- My time vs your time ----
  function offsetMinutes(tz, at) {
    // Minutes ahead of UTC for a time zone at a given moment.
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        .formatToParts(at)
        .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
    return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
  }
  function placeName(tz) {
    const city = (tz || '').split('/').pop().replace(/_/g, ' ');
    return city ? city.toUpperCase() : 'YOUR TIME';
  }
  function tickClocks() {
    const now = new Date();
    const mine = data.timezone || 'America/Argentina/Buenos_Aires';
    const yours = Intl.DateTimeFormat().resolvedOptions().timeZone || mine;
    const time = (tz) => now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz });
    const day = (tz) => now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short', timeZone: tz });
    $('clock-mine').textContent = time(mine);
    $('date-mine').textContent = day(mine);
    $('clock-yours').textContent = time(yours);
    $('date-yours').textContent = day(yours);
    $('label-yours').textContent = `YOUR TIME · ${placeName(yours)}`;
    const diff = offsetMinutes(yours, now) - offsetMinutes(mine, now);
    if (diff === 0) {
      $('clock-diff').textContent = "You're in the same time zone as me.";
    } else {
      const h = Math.floor(Math.abs(diff) / 60);
      const m = Math.abs(diff) % 60;
      const amount = `${h ? `${h} hour${h === 1 ? '' : 's'}` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''}`;
      $('clock-diff').textContent = `You're ${amount} ${diff > 0 ? 'ahead of' : 'behind'} me. Times on the calendar are mine, with yours in brackets.`;
    }
  }

  renderLegend();
  render();
  tickClocks();
  setInterval(tickClocks, 15000);
  fetch(`calendar.json?v=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((json) => {
      data = { ...data, ...json, items: Array.isArray(json.items) ? json.items : [] };
      weekStart = mondayOf(todayInZone());
      render();
      renderFoot();
    })
    .catch(() => {
      $('foot').textContent = 'The calendar couldn’t load right now. Please refresh in a moment.';
    });
})();
