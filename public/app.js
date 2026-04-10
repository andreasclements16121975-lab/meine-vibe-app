let token = localStorage.getItem('token') || '';
let editingMemberId = null;
let currentUser = null;
let calendarViewDate = new Date();
let calendarEvents = [];
let selectedCalendarEventId = '';


const api = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
};

const el = (id) => document.getElementById(id);

function setAuthInfo(text) {
  el('authInfo').textContent = text;
}

async function login() {
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: el('loginEmail').value, password: el('loginPassword').value })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    setAuthInfo(`Eingeloggt als ${data.user.name} (${data.user.role})`);
    await bootstrapData();
    el('authMessage').textContent = 'Login erfolgreich';
  } catch (e) {
    el('authMessage').textContent = e.message;
  }
}

async function forgotPassword() {
  const data = await api('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: el('loginEmail').value })
  });
  el('authMessage').innerHTML = `${data.message} <a class="text-blue-700 underline" href="${data.resetUrl || '#'}">Reset öffnen</a>`;
}

async function loadMembers() {
  const members = await api('/api/members');
  el('nomPlayerId').innerHTML = members
    .filter((m) => m.role === 'Spieler')
    .map((m) => `<option value="${m.id}">${m.name} (${m.team || '-'})</option>`)
    .join('');

  el('membersList').innerHTML = members
    .map(
      (m) => `<div class="border rounded p-2 flex justify-between items-center gap-2">
      <span>${m.name} • ${m.role} • ${m.team || '-'} • ${m.email}</span>
      <div class="flex gap-1">
        <button class="px-2 py-1 text-xs bg-amber-400 rounded" onclick="editMember('${m.id}')">Bearbeiten</button>
        <button class="px-2 py-1 text-xs bg-rose-500 text-white rounded" onclick="deleteMember('${m.id}')">Löschen</button>
      </div>
      </div>`
    )
    .join('');
}

window.editMember = async (id) => {
  const members = await api('/api/members');
  const m = members.find((x) => x.id === id);
  if (!m) return;
  editingMemberId = id;
  el('memberName').value = m.name;
  el('memberEmail').value = m.email;
  el('memberRole').value = m.role;
  el('memberTeam').value = m.team || '';
};
window.deleteMember = async (id) => {
  await api(`/api/members/${id}`, { method: 'DELETE' });
  await loadMembers();
};

async function saveMember() {
  const payload = {
    name: el('memberName').value,
    email: el('memberEmail').value,
    role: el('memberRole').value,
    team: el('memberTeam').value
  };
  if (editingMemberId) {
    await api(`/api/members/${editingMemberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    editingMemberId = null;
  } else {
    await api('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  await loadMembers();
}

async function uploadLogo() {
  const file = el('logoInput').files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('logo', file);
  await api('/api/branding/logo', { method: 'POST', body: fd });
  await loadBranding();
}

async function loadBranding() {
  const b = await api('/api/branding');
  if (b.logoPath) {
    el('clubLogo').src = b.logoPath;
    el('clubLogo').classList.remove('hidden');
  }
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyDTGv_RgaBypgLobEsebD182Iqt2SCh4d0';

function formatPlaceAddress(place) {
  const comps = place?.address_components || [];
  const pick = (...types) => comps.find((c) => types.every((t) => c.types.includes(t)))?.long_name || '';
  const street = pick('route');
  const number = pick('street_number');
  const zip = pick('postal_code');
  const city = pick('locality') || pick('postal_town') || pick('administrative_area_level_3');
  const line1 = [street, number].filter(Boolean).join(' ').trim();
  const line2 = [zip, city].filter(Boolean).join(' ').trim();
  const full = [line1, line2].filter(Boolean).join(', ').trim();
  return full || place?.formatted_address || '';
}

function loadGoogleMapsOnce() {
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__gmapsPromise) return window.__gmapsPromise;

  window.__gmapsPromise = new Promise((resolve, reject) => {
    window.__initGooglePlaces = () => resolve();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=__initGooglePlaces`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Google Maps konnte nicht geladen werden'));
    document.head.appendChild(script);
  });

  return window.__gmapsPromise;
}

async function initGooglePlacesForEventFields() {
  try {
    await loadGoogleMapsOnce();
    const geocoder = new google.maps.Geocoder();

    const opponentInput = el('eventOpponent');
    const addressInput = el('eventAddress');

    const resolveAddressGeo = async (address) =>
      new Promise((resolve) => {
        if (!address) return resolve(null);
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng() });
          } else {
            resolve(null);
          }
        });
      });

    const opponentAutocomplete = new google.maps.places.Autocomplete(opponentInput, {
      types: ['establishment'],
      fields: ['name', 'formatted_address', 'address_components']
    });

    const addressAutocomplete = new google.maps.places.Autocomplete(addressInput, {
      types: ['address'],
      fields: ['formatted_address', 'address_components', 'name']
    });

    let opponentSessionToken = new google.maps.places.AutocompleteSessionToken();
    let addressSessionToken = new google.maps.places.AutocompleteSessionToken();

    const refreshOpponentToken = () => {
      opponentSessionToken = new google.maps.places.AutocompleteSessionToken();
      opponentAutocomplete.setOptions({ sessionToken: opponentSessionToken });
    };

    const refreshAddressToken = () => {
      addressSessionToken = new google.maps.places.AutocompleteSessionToken();
      addressAutocomplete.setOptions({ sessionToken: addressSessionToken });
    };

    refreshOpponentToken();
    refreshAddressToken();

    opponentInput.addEventListener('focus', refreshOpponentToken);
    addressInput.addEventListener('focus', refreshAddressToken);

    opponentAutocomplete.addListener('place_changed', () => {
      const place = opponentAutocomplete.getPlace();
      const address = formatPlaceAddress(place);
      if (address) {
        addressInput.value = address;
      } else {
        addressInput.value = place?.name || '';
      }
      resolveAddressGeo(addressInput.value).then((geo) => {
        addressInput.dataset.lat = geo?.lat ?? '';
        addressInput.dataset.lng = geo?.lng ?? '';
      });
      refreshOpponentToken();
    });

    addressAutocomplete.addListener('place_changed', () => {
      const place = addressAutocomplete.getPlace();
      const address = formatPlaceAddress(place);
      addressInput.value = address || place?.name || '';
      resolveAddressGeo(addressInput.value).then((geo) => {
        addressInput.dataset.lat = geo?.lat ?? '';
        addressInput.dataset.lng = geo?.lng ?? '';
      });
      refreshAddressToken();
    });

    addressInput.addEventListener('blur', async () => {
      const geo = await resolveAddressGeo(addressInput.value);
      addressInput.dataset.lat = geo?.lat ?? '';
      addressInput.dataset.lng = geo?.lng ?? '';
    });
  } catch (err) {
    console.warn(err.message);
  }
}
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getHolidayMap(year) {
  const easterSunday = getEasterSunday(year);

  const addDays = (baseDate, days) => {
    const copy = new Date(baseDate);
    copy.setDate(copy.getDate() + days);
    return copy;
  };

  const holidays = [
    { date: new Date(year, 0, 1), name: 'Neujahr' },
    { date: addDays(easterSunday, -2), name: 'Karfreitag' },
    { date: addDays(easterSunday, 1), name: 'Ostermontag' },
    { date: new Date(year, 4, 1), name: 'Tag der Arbeit' },
    { date: addDays(easterSunday, 39), name: 'Christi Himmelfahrt' },
    { date: addDays(easterSunday, 50), name: 'Pfingstmontag' },
    { date: new Date(year, 9, 3), name: 'Tag der Deutschen Einheit' },
    { date: new Date(year, 11, 24), name: 'Heiligabend' },
    { date: new Date(year, 11, 25), name: '1. Weihnachtstag' },
    { date: new Date(year, 11, 26), name: '2. Weihnachtstag' },
    { date: new Date(year, 11, 31), name: 'Silvester' }
  ];

  return Object.fromEntries(holidays.map((holiday) => [formatDateKey(holiday.date), holiday.name]));
}
function renderCalendar(events) {
  calendarEvents = events;
  const now = new Date();
  const y = calendarViewDate.getFullYear();
  const m = calendarViewDate.getMonth();
  const holidayMap = getHolidayMap(y);
  const days = new Date(y, m + 1, 0).getDate();
  const startDay = (new Date(y, m, 1).getDay() + 6) % 7;
  const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const cells = labels.map((d) => `<div class="font-semibold p-1 text-center">${d}</div>`);
  for (let i = 0; i < startDay; i++) cells.push('<div class="p-2 border rounded bg-slate-50"></div>');

  for (let day = 1; day <= days; day++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = events.filter((e) => e.date === iso);
    const isToday = now.getFullYear() === y && now.getMonth() === m && now.getDate() === day;
   const holidayName = holidayMap[iso] || '';

cells.push(`
  <div class="p-2 border rounded min-h-20">
    <div class="font-medium inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-blue-100 text-blue-700' : ''}">
      ${day}
    </div>
    ${holidayName ? `<div class="text-[11px] rounded px-1 py-0.5 my-1 bg-rose-100 text-rose-700 leading-tight">${holidayName}</div>` : ''}
    ${dayEvents
      .map((e) => {
        const eventLabel = e.title || 'Termin';
        const detailLabel = e.opponent || '';
        const addressLabel = e.address || '-';

        const eventTypeClass =
          e.title === 'Training'
            ? 'bg-blue-100'
            : e.title === 'Event'
              ? 'bg-orange-100'
              : 'bg-emerald-100';

        return `
          <div class="text-xs rounded px-1 py-1 my-1 ${eventTypeClass} leading-tight cursor-pointer overflow-hidden" data-event-id="${e.id}" title="${eventLabel}${detailLabel ? ` - ${detailLabel}` : ''} | ${addressLabel}">
            <div class="font-medium truncate">${eventLabel}</div>
            <div class="truncate">${detailLabel || '-'}</div>
            <div class="truncate">${addressLabel}</div>
            <a class="text-blue-700 underline block truncate" href="${e.mapLink || '#'}" target="_blank" rel="noreferrer">Google Maps</a>
          </div>
        `;
      })
      .join('')}
  </div>
`);
  }
  el('calendarGrid').innerHTML = cells.join('');
  el('currentYearLabel').textContent = String(y);
  el('monthSelect').value = String(m);
}

function initCalendarControls() {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  el('monthSelect').innerHTML = months.map((name, idx) => `<option value="${idx}">${name}</option>`).join('');
  el('monthSelect').value = String(calendarViewDate.getMonth());
  el('currentYearLabel').textContent = String(calendarViewDate.getFullYear());

  el('prevMonthBtn').addEventListener('click', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    renderCalendar(calendarEvents);
  });
  el('nextMonthBtn').addEventListener('click', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    renderCalendar(calendarEvents);
  });
  el('monthSelect').addEventListener('change', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), Number(el('monthSelect').value), 1);
    renderCalendar(calendarEvents);
  });

  el('calendarGrid').addEventListener('click', (ev) => {
    const entry = ev.target.closest('[data-event-id]');
    if (!entry) return;
    openCalendarModal(entry.dataset.eventId);
  });
}

function openCalendarModal(eventId) {
  const eventItem = calendarEvents.find((e) => e.id === eventId);
  if (!eventItem) return;
  selectedCalendarEventId = eventId;
  el('calendarModalContent').innerHTML = `
    <div><b>Titel:</b> ${eventItem.title}${eventItem.opponent ? ` ${eventItem.opponent}` : ''}</div>
    <div><b>Datum:</b> ${eventItem.date}</div>
    <div><b>Ort:</b> ${eventItem.address || '-'}</div>
    <div><b>Untergrund:</b> ${eventItem.surface || '-'}</div>
    <div><b>Treffzeit:</b> ${eventItem.meetingTime || '-'}</div>
    <div><b>Anstoßzeit:</b> ${eventItem.kickoffTime || '-'}</div>
    <div><b>Zu-/Absage bis:</b> ${eventItem.responseDeadline ? new Date(eventItem.responseDeadline).toLocaleString('de-DE') : '-'}</div>
    <div><a class="text-blue-700 underline" href="${eventItem.mapLink || '#'}" target="_blank" rel="noreferrer">Google Maps öffnen</a></div>
  `;
  el('calendarModal').classList.remove('hidden');
  el('calendarModal').classList.add('flex');
}

function closeCalendarModal() {
  el('calendarModal').classList.add('hidden');
  el('calendarModal').classList.remove('flex');
}
function openDeleteEventsModal() {
  renderDeleteEventsList();
  el('deleteEventsModal').classList.remove('hidden');
  el('deleteEventsModal').classList.add('flex');
}

function closeDeleteEventsModal() {
  el('deleteEventsModal').classList.add('hidden');
  el('deleteEventsModal').classList.remove('flex');
}

function renderDeleteEventsList() {
  const events = JSON.parse(localStorage.getItem('localEvents') || '[]');

  if (!events.length) {
    el('deleteEventsList').innerHTML = '<div class="text-sm text-slate-500">Keine Termine vorhanden.</div>';
    return;
  }

  el('deleteEventsList').innerHTML = events
    .map((event) => {
      const label = [
        event.date || '-',
        event.title || 'Termin',
        event.opponent || '',
        event.address || ''
      ]
        .filter(Boolean)
        .join(' – ');

      return `
        <label class="flex items-start gap-3 border rounded p-2">
          <input type="checkbox" class="delete-event-checkbox mt-1" value="${event.id}" />
          <span class="text-sm">${label}</span>
        </label>
      `;
    })
    .join('');
}

async function deleteSelectedEvents() {
  const selectedIds = Array.from(document.querySelectorAll('.delete-event-checkbox:checked')).map((input) => input.value);

  if (!selectedIds.length) {
    alert('Bitte mindestens einen Termin auswählen.');
    return;
  }

  const events = JSON.parse(localStorage.getItem('localEvents') || '[]');
  const filteredEvents = events.filter((event) => !selectedIds.includes(event.id));

  localStorage.setItem('localEvents', JSON.stringify(filteredEvents));

  if (selectedCalendarEventId && selectedIds.includes(selectedCalendarEventId)) {
    selectedCalendarEventId = '';
    closeCalendarModal();
  }

  closeDeleteEventsModal();
  await loadEvents();
}
function updateTrainingSeriesVisibility() {
  const isTraining = el('eventTitle').value === 'Training';
  el('trainingSeriesBox').classList.toggle('hidden', !isTraining);
}

function getSeriesDates() {
  const start = el('seriesStartDate').value;
  const end = el('seriesEndDate').value;
  const weeks = Number(el('seriesWeeks').value || 0);
  const weekdays = Array.from(document.querySelectorAll('.seriesWeekday:checked')).map((x) => Number(x.value));

  if (!start || weekdays.length === 0 || (!end && !weeks)) return null;
  const startDate = new Date(start);
  const maxDate = end
    ? new Date(end)
    : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + weeks * 7 - 1);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(maxDate.getTime()) || maxDate < startDate) return null;

  const dates = [];
  const cursor = new Date(startDate);
  while (cursor <= maxDate) {
    if (weekdays.includes(cursor.getDay())) {
      dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function clearEventFieldHighlights() {
  ['eventTitle', 'eventDate', 'eventAddress', 'eventMeetingTime', 'eventKickoffTime', 'eventDeadlineDate', 'eventDeadlineTime'].forEach((id) => {
    el(id).classList.remove('border-rose-500', 'ring-1', 'ring-rose-300');
  });
}

function highlightEventFields(ids) {
  ids.forEach((id) => el(id).classList.add('border-rose-500', 'ring-1', 'ring-rose-300'));
}

function saveEventLocally(eventData) {
  const events = JSON.parse(localStorage.getItem('localEvents') || '[]');

  const normalizedTitle = (eventData.title || '').trim();
  const normalizedOpponent = (eventData.opponent || '').trim();
  const normalizedAddress = (eventData.address || '').trim();
  const normalizedDate = (eventData.date || '').trim();

  const existingIndex = events.findIndex((event) => {
    return (
      (event.title || '').trim() === normalizedTitle &&
      (event.opponent || '').trim() === normalizedOpponent &&
      (event.address || '').trim() === normalizedAddress &&
      (event.date || '').trim() === normalizedDate
    );
  });

  const newEvent = {
    id:
      existingIndex >= 0
        ? events[existingIndex].id
        : crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),
    ...eventData,
    mapLink: eventData.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.address)}`
      : '#'
  };

  if (existingIndex >= 0) {
    events[existingIndex] = newEvent;
  } else {
    events.push(newEvent);
  }

  localStorage.setItem('localEvents', JSON.stringify(events));
}

async function createEvent() {
  try {
    if (!token) {
      console.warn('Kein Login vorhanden – Termin wird im Testmodus gespeichert.');
    }

    clearEventFieldHighlights();
    const required = ['eventTitle', 'eventDate', 'eventAddress', 'eventMeetingTime', 'eventKickoffTime', 'eventDeadlineDate', 'eventDeadlineTime'];
    const missing = required.filter((id) => !el(id).value);
    if (missing.length) {
      highlightEventFields(missing);
      alert('Bitte Pflichtfelder ausfüllen');
      return;
    }

    const meetingTime = el('eventMeetingTime').value;
    const kickoffTime = el('eventKickoffTime').value;
    if (meetingTime >= kickoffTime) {
      highlightEventFields(['eventMeetingTime', 'eventKickoffTime']);
      alert('Die Treffzeit muss vor der Anstoßzeit liegen');
      return;   
    }
const eventDate = el('eventDate').value;
const deadlineDate = el('eventDeadlineDate').value;
const deadlineTime = el('eventDeadlineTime').value;
const deadlineValue = deadlineDate && deadlineTime ? `${deadlineDate}T${deadlineTime}` : '';

if (deadlineDate && eventDate && deadlineDate > eventDate) {
  highlightEventFields(['eventDate', 'eventDeadlineDate', 'eventDeadlineTime']);
  alert('Das Absagedatum darf nicht nach dem Spieltermin liegen!');
  return;
}
    const basePayload = {
      title: el('eventTitle').value,
      opponent: el('eventOpponent').value,
      homeAway: el('eventHomeAway').value,
      category: el('eventTitle').value,
      address: el('eventAddress').value,
      surface: el('eventSurface').value,
      meetingTime,
      kickoffTime,
      geo:
        el('eventAddress').dataset.lat && el('eventAddress').dataset.lng
          ? { lat: Number(el('eventAddress').dataset.lat), lng: Number(el('eventAddress').dataset.lng) }
          : undefined,
      responseDeadline: deadlineValue,
      notifyPlayers: el('eventNotify').checked,
      reminderHoursBefore: Number(el('eventReminderHours').value || 24)
    };

    if (basePayload.title === 'Training') {
      const seriesDates = getSeriesDates();
      const seriesMeetingTime = el('seriesMeetingTime').value || meetingTime;
      const seriesKickoffTime = el('seriesKickoffTime').value || kickoffTime;
      const seriesEndTime = el('seriesEndTime').value || seriesKickoffTime;
      const seriesDeadline = el('seriesDeadline').value || basePayload.responseDeadline;

      if (seriesMeetingTime >= seriesKickoffTime || seriesKickoffTime >= seriesEndTime) {
        alert('Die Treffzeit muss vor der Anstoßzeit liegen');
        return;
      }
      if (seriesDeadline && seriesDeadline.slice(14, 16) !== '00') {
        alert('Zu-/Absage bis darf nur volle Stunden enthalten.');
        return;
      }
     if (seriesDates && seriesDates.length) {
  for (const date of seriesDates) {
    const seriesDeadlineDate = seriesDeadline ? seriesDeadline.slice(0, 10) : '';

    if (seriesDeadlineDate && seriesDeadlineDate > date) {
      alert('Das Absagedatum darf nicht nach dem Spieltermin liegen!');
      return;
    }

    saveEventLocally({
      ...basePayload,
      date,
      meetingTime: seriesMeetingTime,
      kickoffTime: seriesKickoffTime,
      endTime: seriesEndTime,
      responseDeadline: seriesDeadline || basePayload.responseDeadline
    });
  }
} else {
  saveEventLocally({
    ...basePayload,
    date: el('eventDate').value
  });
}
} else {
  saveEventLocally({
    ...basePayload,
    date: el('eventDate').value
  });
}
    await loadEvents();
  } catch (e) {
    alert(`Speichern fehlgeschlagen: ${e.message}`);
  }
}

async function deleteEvent() {
  try {
    const id = selectedCalendarEventId || prompt('Bitte Event-ID für das Löschen eingeben:');
    if (!id) return;
    if (!currentUser) {
  console.warn('Kein Login vorhanden – Löschen im Testmodus erlaubt.');
}
    const events = JSON.parse(localStorage.getItem('localEvents') || '[]');
const filteredEvents = events.filter((event) => event.id !== id);
localStorage.setItem('localEvents', JSON.stringify(filteredEvents));
if (selectedCalendarEventId === id) selectedCalendarEventId = '';
await loadEvents();
  } catch (e) {
    alert(`Löschen fehlgeschlagen: ${e.message}`);
  }
}

async function loadEvents() {
  const isGitHubPages = window.location.hostname.includes('github.io');

  if (isGitHubPages) {
    const events = JSON.parse(localStorage.getItem('localEvents') || '[]');
    renderCalendar(events);
    el('opponentSuggestions').innerHTML = [...new Set(events.map((e) => e.opponent).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
    el('addressSuggestions').innerHTML = [...new Set(events.map((e) => e.address).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
    return;
  }

  try {
    const events = await api('/api/events');
    renderCalendar(events);
    el('opponentSuggestions').innerHTML = [...new Set(events.map((e) => e.opponent).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
    el('addressSuggestions').innerHTML = [...new Set(events.map((e) => e.address).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
  } catch (e) {
    const events = JSON.parse(localStorage.getItem('localEvents') || '[]');
    renderCalendar(events);
    el('opponentSuggestions').innerHTML = [...new Set(events.map((e) => e.opponent).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
    el('addressSuggestions').innerHTML = [...new Set(events.map((e) => e.address).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
  }
}

async function loadReminders() {
  const items = await api('/api/events/reminders');
  el('remindersList').innerHTML = items.length
    ? items.map((x) => `<div class="border rounded p-2 bg-violet-50 text-sm">${x.message} (Frist: ${new Date(x.responseDeadline).toLocaleString('de-DE')})</div>`).join('')
    : '<div class="text-sm text-slate-500">Aktuell keine fälligen Erinnerungen.</div>';
}

async function createNomination() {
  const select = el('nomPlayerId');
  const playerId = select.value;
  const playerName = select.options[select.selectedIndex]?.textContent || '';
  await api('/api/nominations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: el('nomEventId').value, playerId, playerName })
  });
  await loadNominations(el('nomEventId').value);
}

async function answerNomination() {
  await api(`/api/nominations/${el('answerNomId').value}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: el('answerStatus').value, reason: el('answerReason').value })
  });
  if (el('nomEventId').value) await loadNominations(el('nomEventId').value);
}

async function loadNominations(eventId) {
  if (!eventId) return;
  const list = await api(`/api/nominations/${eventId}`);
  el('nomList').innerHTML = list
    .map((n) => `<div class="p-2 border rounded text-sm">ID ${n.id}: ${n.playerName || n.playerId} → <b>${n.status || 'Offen'}</b> ${n.reason ? `(${n.reason})` : ''}</div>`)
    .join('');
}

async function addLedger() {
  await api('/api/ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player: el('ledgerPlayer').value, amount: Number(el('ledgerAmount').value), type: el('ledgerType').value, reason: el('ledgerReason').value })
  });
  await loadLedger();
}

async function loadLedger() {
  const rows = await api('/api/ledger');
  const total = rows.reduce((acc, x) => acc + (x.type === 'Einnahme' ? x.amount : -x.amount), 0);
  el('ledgerList').innerHTML = `<div class="font-semibold">Saldo: ${total.toFixed(2)} €</div>${rows
    .map((r) => `<div class="p-2 border rounded text-sm">${r.player}: ${r.type} ${r.amount} € (${r.reason})</div>`)
    .join('')}`;
}

async function loadAgeGroups() {
  const ages = await api('/api/meta/age-groups');
  el('fAge').innerHTML = `<option value="">Altersklasse</option>${ages.map((a) => `<option value="${a}">${a}</option>`).join('')}`;
}

async function loadMaterials() {
  const mats = await api('/api/materials');
  el('materialSelect').innerHTML = mats.map((m) => `<option>${m}</option>`).join('');
  updateMaterialInfo();
}

function updateMaterialInfo() {
  el('materialInfo').textContent = `Ausgewähltes Material: ${el('materialSelect').value || '-'} | ${el('bibColor').value}es Leibchen | ${el('dummyColor').value}er Dummy`;
}

async function loadExercises() {
  const params = new URLSearchParams({ ageGroup: el('fAge').value, performance: el('fPerf').value, type: el('fType').value, fitness: el('fFit').value });
  const items = await api(`/api/exercises?${params.toString()}`);
  el('exerciseList').innerHTML = items
    .map((x) => `<article class="p-3 border rounded bg-slate-50"><h3 class="font-medium">${x.title}</h3><p class="text-xs">${x.ageGroup} · ${x.performance} · ${x.type} · ${x.fitness}</p><p class="text-sm mt-1">Material: ${(x.material || []).join(', ')}</p><p class="text-sm mt-1">${x.description}</p></article>`)
    .join('');
}

function setupCanvas() {
  const canvas = el('tacticsCanvas');
  const wrap = el('tacticsCanvasWrap') || canvas?.parentElement;
  if (!canvas || !wrap) return;

  const ctx = canvas.getContext('2d');
  const placed = [];
  let selected = '⚽';

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  const getPitchGreen = () => {
    const candidates = ['#createEventBtn', '#saveMemberBtn', '#saveEventBtn'];
    for (const selector of candidates) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const color = getComputedStyle(node).backgroundColor;
      if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
    }
    return '#16a34a';
  };

  const getPitchConfig = () => {
    const type = el('pitchType')?.value || 'half';
    const orientation = el('pitchOrientation')?.value || 'landscape';

    return {
      type,
      orientation,
      length: type === 'full' ? 105 : 52.5,
      width: 68
    };
  };

  const resizeCanvas = () => {
    const { length, width, orientation } = getPitchConfig();
    const landscapeRatio = length / width;
    const ratio = orientation === 'portrait' ? 1 / landscapeRatio : landscapeRatio;

    const maxWidth = Math.min((wrap.clientWidth || 960) - 8, 960);
    const maxHeight = Math.min(Math.max(260, window.innerHeight - wrap.getBoundingClientRect().top - 24), 520);

    let drawWidth = maxWidth;
    let drawHeight = drawWidth / ratio;

    if (drawHeight > maxHeight) {
      drawHeight = maxHeight;
      drawWidth = drawHeight * ratio;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${Math.round(drawWidth)}px`;
    canvas.style.height = `${Math.round(drawHeight)}px`;
    canvas.width = Math.round(drawWidth * dpr);
    canvas.height = Math.round(drawHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { drawWidth, drawHeight };
  };

  const toPxX = (meters, fieldX, fieldWidth, totalLength) => fieldX + (meters / totalLength) * fieldWidth;
  const toPxY = (meters, fieldY, fieldHeight, totalWidth) => fieldY + (meters / totalWidth) * fieldHeight;

  const drawPenaltyBox = (side, fieldX, fieldY, fieldWidth, fieldHeight, pitchLength, pitchWidth) => {
    const boxDepth = 16.5;
    const boxWidth = 40.32;
    const goalAreaDepth = 5.5;
    const goalAreaWidth = 18.32;
    const penaltySpotDistance = 11;

    const penaltyTop = toPxY((pitchWidth - boxWidth) / 2, fieldY, fieldHeight, pitchWidth);
    const penaltyHeight = (boxWidth / pitchWidth) * fieldHeight;
    const penaltyDepthPx = (boxDepth / pitchLength) * fieldWidth;

    const goalAreaTop = toPxY((pitchWidth - goalAreaWidth) / 2, fieldY, fieldHeight, pitchWidth);
    const goalAreaHeight = (goalAreaWidth / pitchWidth) * fieldHeight;
    const goalAreaDepthPx = (goalAreaDepth / pitchLength) * fieldWidth;

    if (side === 'left') {
      ctx.strokeRect(fieldX, penaltyTop, penaltyDepthPx, penaltyHeight);
      ctx.strokeRect(fieldX, goalAreaTop, goalAreaDepthPx, goalAreaHeight);

      const spotX = toPxX(penaltySpotDistance, fieldX, fieldWidth, pitchLength);
      const spotY = fieldY + fieldHeight / 2;
      ctx.beginPath();
      ctx.arc(spotX, spotY, 3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const penaltyX = fieldX + fieldWidth - penaltyDepthPx;
    const goalAreaX = fieldX + fieldWidth - goalAreaDepthPx;
    const spotX = toPxX(pitchLength - penaltySpotDistance, fieldX, fieldWidth, pitchLength);
    const spotY = fieldY + fieldHeight / 2;

    ctx.strokeRect(penaltyX, penaltyTop, penaltyDepthPx, penaltyHeight);
    ctx.strokeRect(goalAreaX, goalAreaTop, goalAreaDepthPx, goalAreaHeight);

    ctx.beginPath();
    ctx.arc(spotX, spotY, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawPitch = (drawWidth, drawHeight) => {
    const { type } = getPitchConfig();
    const padding = 18;
    const pitchGreen = getPitchGreen();

    ctx.clearRect(0, 0, drawWidth, drawHeight);
    ctx.fillStyle = pitchGreen;
    ctx.fillRect(0, 0, drawWidth, drawHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const fieldX = padding;
    const fieldY = padding;
    const fieldWidth = drawWidth - padding * 2;
    const fieldHeight = drawHeight - padding * 2;

    if (type === 'full') {
      const pitchLength = 105;
      const pitchWidth = 68;
      const centerX = fieldX + fieldWidth / 2;
      const centerY = fieldY + fieldHeight / 2;

      ctx.strokeRect(fieldX, fieldY, fieldWidth, fieldHeight);

      ctx.beginPath();
      ctx.moveTo(centerX, fieldY);
      ctx.lineTo(centerX, fieldY + fieldHeight);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fill();

      drawPenaltyBox('left', fieldX, fieldY, fieldWidth, fieldHeight, pitchLength, pitchWidth);
      drawPenaltyBox('right', fieldX, fieldY, fieldWidth, fieldHeight, pitchLength, pitchWidth);
      return;
    }

    ctx.strokeRect(fieldX, fieldY, fieldWidth, fieldHeight);
    drawPenaltyBox('left', fieldX, fieldY, fieldWidth, fieldHeight, 52.5, 68);
  };

  const screenToFieldRatio = (clientX, clientY, rect, orientation) => {
    const screenX = clamp((clientX - rect.left) / rect.width);
    const screenY = clamp((clientY - rect.top) / rect.height);

    if (orientation === 'portrait') {
      return { xRatio: screenY, yRatio: 1 - screenX };
    }

    return { xRatio: screenX, yRatio: screenY };
  };

  const fieldRatioToScreen = (item, width, height, orientation) => {
    if (orientation === 'portrait') {
      return {
        x: width - item.yRatio * width,
        y: item.xRatio * height
      };
    }

    return {
      x: item.xRatio * width,
      y: item.yRatio * height
    };
  };

  const drawPlacedItems = (drawWidth, drawHeight) => {
    const { orientation } = getPitchConfig();
    const fontSize = Math.max(18, Math.min(28, Math.round(Math.min(drawWidth, drawHeight) / 14)));

    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    placed.forEach((item) => {
      const point = fieldRatioToScreen(item, drawWidth, drawHeight, orientation);
      ctx.fillText(item.icon, point.x, point.y);
    });

    ctx.restore();
  };

  const draw = () => {
    const { drawWidth, drawHeight } = resizeCanvas();
    const { orientation } = getPitchConfig();

    ctx.clearRect(0, 0, drawWidth, drawHeight);

    if (orientation === 'portrait') {
      ctx.save();
      ctx.translate(drawWidth, 0);
      ctx.rotate(Math.PI / 2);
      drawPitch(drawHeight, drawWidth);
      ctx.restore();
    } else {
      drawPitch(drawWidth, drawHeight);
    }

    drawPlacedItems(drawWidth, drawHeight);
  };

  document.querySelectorAll('.draggable').forEach((btn) => {
    btn.addEventListener('click', () => {
      selected = btn.dataset.icon;
      document.querySelectorAll('.draggable').forEach((b) => b.classList.remove('ring-2', 'ring-emerald-500'));
      btn.classList.add('ring-2', 'ring-emerald-500');
    });
  });

  canvas.addEventListener('click', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const { orientation } = getPitchConfig();
    const point = screenToFieldRatio(ev.clientX, ev.clientY, rect, orientation);

    placed.push({
      icon: selected,
      xRatio: point.xRatio,
      yRatio: point.yRatio
    });

    draw();
  });

  el('pitchType')?.addEventListener('change', draw);
  el('pitchOrientation')?.addEventListener('change', draw);
  window.addEventListener('resize', draw);

  if (window.ResizeObserver) {
    new ResizeObserver(draw).observe(wrap);
  }

  draw();
}

async function uploadVideo() {
  const fd = new FormData();
  fd.append('video', el('videoFile').files[0]);
  fd.append('description', el('videoDesc').value);
  await api('/api/videos/upload', { method: 'POST', body: fd });
  await loadVideos();
}
async function addSocial() {
  await api('/api/videos/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: el('socialUrl').value }) });
  await loadVideos();
}
async function extractInstructions() {
  const data = await api('/api/videos/extract-instructions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: el('videoDesc').value }) });
  el('instructionsOutput').textContent = data.instructions;
}
async function loadVideos() {
  const videos = await api('/api/videos');
  el('videoList').innerHTML = videos.map((v) => (v.kind === 'social' ? `<div class="border rounded p-2 text-sm">${v.provider}: <a class="text-blue-700 underline" href="${v.url}" target="_blank">${v.url}</a></div>` : `<div class="border rounded p-2 text-sm">Upload: <a class="text-blue-700 underline" href="${v.filePath}" target="_blank">${v.filePath}</a><br/>${v.description || ''}</div>`)).join('');
}

function loadTimeOptions() {
  const slots = [];
  for (let h = 8; h <= 18; h++) {
    for (let m = 0; m < 60; m += 15) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(`<option value="${val}">${val}</option>`);
    }
  }
  const html = `<option value="">Zeit wählen</option>${slots.join('')}`;
  el('eventMeetingTime').innerHTML = html;
  el('eventKickoffTime').innerHTML = html;
  el('seriesMeetingTime').innerHTML = html;
  el('seriesKickoffTime').innerHTML = html;
  el('seriesEndTime').innerHTML = html;
  el('eventDeadlineTime').innerHTML = html;
}

async function bootstrapData() {
  await Promise.all([loadMembers(), loadBranding(), loadEvents(), loadLedger(), loadAgeGroups(), loadMaterials(), loadExercises(), loadVideos()]);
}

el('loginBtn').addEventListener('click', login);
el('forgotBtn').addEventListener('click', forgotPassword);
el('saveMemberBtn').addEventListener('click', saveMember);
el('uploadLogoBtn').addEventListener('click', uploadLogo);
el('createEventBtn').addEventListener('click', createEvent);
el('deleteEventBtn').addEventListener('click', openDeleteEventsModal);
el('createNomBtn').addEventListener('click', createNomination);
el('answerNomBtn').addEventListener('click', answerNomination);
el('addLedgerBtn').addEventListener('click', addLedger);
el('filterExercisesBtn').addEventListener('click', loadExercises);
el('materialSelect').addEventListener('change', updateMaterialInfo);
el('bibColor').addEventListener('change', updateMaterialInfo);
el('dummyColor').addEventListener('change', updateMaterialInfo);
el('uploadVideoBtn').addEventListener('click', uploadVideo);
el('addSocialBtn').addEventListener('click', addSocial);
el('extractBtn').addEventListener('click', extractInstructions);
el('nomEventId').addEventListener('change', () => loadNominations(el('nomEventId').value));
el('eventEmailNotifyBtn').addEventListener('click', () => alert('E-Mail-Benachrichtigung wurde vorbereitet.'));
el('eventTitle').addEventListener('change', updateTrainingSeriesVisibility);
el('closeCalendarModalBtn').addEventListener('click', closeCalendarModal);
el('modalDeleteEventBtn').addEventListener('click', deleteEvent);
el('closeDeleteEventsModalBtn').addEventListener('click', closeDeleteEventsModal);
el('confirmDeleteSelectedBtn').addEventListener('click', deleteSelectedEvents);
el('calendarModal').addEventListener('click', (ev) => {
  if (ev.target.id === 'calendarModal') closeCalendarModal();
});

loadTimeOptions();
initCalendarControls();
renderCalendar([]);
updateTrainingSeriesVisibility();
initGooglePlacesForEventFields();
setupCanvas();
if (token) setAuthInfo('Session gefunden – bitte einloggen zum Aktualisieren.');
