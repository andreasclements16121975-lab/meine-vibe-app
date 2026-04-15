const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const AGE_GROUPS = [
  'Bambini',
  '2007-2008 (A-Junioren)',
  '2009-2010 (B-Junioren)',
  '2011-2012 (C-Junioren)',
  '2013-2014 (D-Junioren)',
  '2015-2016 (E-Junioren)',
  '2017-2018 (F-Junioren)',
  '2019-2020+ (G-Junioren)',
  'Senioren'
];

const defaultDb = {
  users: [
    {
      id: 'admin-seed',
      name: 'Vereinsadmin',
      email: 'admin@verein.local',
      role: 'Admin',
      team: '1. Mannschaft',
      passwordHash: bcrypt.hashSync('admin123', 10)
    }
  ],
  passwordResets: [],
  branding: { logoPath: '' },
  events: [],
  nominations: [],
  ledger: [],
  materials: [
    'Hütchen / Markierungsteller',
    'Pylonen (verschiedene Größen)',
    'Leibchen',
    'Eckfahnen',
    'Tore & Rebounder',
    'Minitore (verschiedene Ausführungen)',
    'Rebounder (Prallwände)',
    'Dummies / Freistoßmauer',
    'Koordinationsleitern',
    'Hürden (Minihürden & Koordinationshürden)',
    'Slalomstangen',
    'Springseile',
    'Sprintschlitten',
    'Power-Bungee-Gurte',
    'Trainings-Gurte / Trainingsbänder',
    'Medizinbälle'
  ],
  exercises: [
    {
      id: nanoid(),
      title: 'Passdreieck mit Positionswechsel',
      ageGroup: '2009-2010 (B-Junioren)',
      performance: 'Fortgeschritten',
      type: 'Technik & Spezialtraining',
      fitness: 'Mittel',
      material: ['Hütchen / Markierungsteller', 'Leibchen'],
      description: 'Schnelles Direktspiel im Dreieck mit permanentem Nachrücken.'
    },
    {
      id: nanoid(),
      title: 'Koordinationsparcours mit Minihürden',
      ageGroup: 'Bambini',
      performance: 'Einsteiger',
      type: 'Schnelligkeit & Kraft (Speed & Power)',
      fitness: 'Niedrig',
      material: ['Koordinationsleitern', 'Hürden (Minihürden & Koordinationshürden)'],
      description: 'Saubere Lauftechnik über Leiter und Hürden mit Ballmitnahme.'
    }
  ],
  videos: []
};

function ensureDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`)
});
const upload = multer({ storage });

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
}

function simplifyDescription(text) {
  return String(text || '')
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n') || '1. Szene ansehen\n2. Aktion extrahieren\n3. Übungsablauf erstellen';
}

function canManageMembers(role) {
  return role === 'Admin' || role === 'Trainer';
}

app.get('/api/meta/age-groups', auth, (req, res) => {
  res.json(AGE_GROUPS);
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Ungültige Zugangsdaten' });
  }
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, JWT_SECRET, {
    expiresIn: '12h'
  });
  return res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email, team: user.team } });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.json({ message: 'Falls vorhanden, wurde ein Reset-Link gesendet.' });
  const token = nanoid(24);
  db.passwordResets.push({ id: nanoid(), userId: user.id, token, expiresAt: Date.now() + 1000 * 60 * 30 });
  writeDb(db);
  return res.json({ message: 'Reset-Link erstellt (Demo).', resetUrl: `/reset.html?token=${token}` });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const db = readDb();
  const reset = db.passwordResets.find((r) => r.token === token && r.expiresAt > Date.now());
  if (!reset) return res.status(400).json({ error: 'Token ungültig oder abgelaufen' });
  const user = db.users.find((u) => u.id === reset.userId);
  if (!user) return res.status(404).json({ error: 'User nicht gefunden' });
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  db.passwordResets = db.passwordResets.filter((r) => r.token !== token);
  writeDb(db);
  return res.json({ message: 'Passwort wurde aktualisiert' });
});

app.get('/api/members', auth, (req, res) => {
  const db = readDb();
  res.json(db.users.map(({ passwordHash, ...u }) => u));
});

app.post('/api/members', auth, (req, res) => {
  if (!canManageMembers(req.user.role)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const { name, email, role, team } = req.body;
  const db = readDb();
  const user = { id: nanoid(), name, email, role, team, passwordHash: bcrypt.hashSync('willkommen123', 10) };
  db.users.push(user);
  writeDb(db);
  const { passwordHash, ...payload } = user;
  res.status(201).json(payload);
});

app.put('/api/members/:id', auth, (req, res) => {
  if (!canManageMembers(req.user.role)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Nicht gefunden' });
  Object.assign(user, { name: req.body.name, email: req.body.email, role: req.body.role, team: req.body.team });
  writeDb(db);
  const { passwordHash, ...payload } = user;
  res.json(payload);
});

app.delete('/api/members/:id', auth, (req, res) => {
  if (!canManageMembers(req.user.role)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const db = readDb();
  db.users = db.users.filter((u) => u.id !== req.params.id);
  writeDb(db);
  res.json({ message: 'Gelöscht' });
});

app.post('/api/branding/logo', auth, upload.single('logo'), (req, res) => {
  const db = readDb();
  db.branding.logoPath = req.file ? `/uploads/${req.file.filename}` : '';
  writeDb(db);
  res.json(db.branding);
});
app.get('/api/branding', auth, (req, res) => {
  const db = readDb();
  res.json(db.branding);
});

app.get('/api/events', auth, (req, res) => {
  const db = readDb();
  res.json(
    db.events.map((e) => ({
      ...e,
      mapLink: `https://www.google.com/maps/search/${encodeURIComponent(e.address || '')}`
    }))
  );
});

app.post('/api/events', auth, (req, res) => {
  const { title, opponent = '', homeAway = 'Heimspiel', category, date, address, surface, meetingTime, kickoffTime, responseDeadline, notifyPlayers = false, reminderHoursBefore = 24 } = req.body;
  if (!title || !date || !address || !kickoffTime || !meetingTime || !responseDeadline) {
    return res.status(400).json({ error: 'Terminart/Datum/Adresse/Treffzeit/Anstoßzeit/Zu-/Absage bis sind Pflicht' });
  }
  const db = readDb();
  const event = {
    id: nanoid(),
    title,
    category: category || title,
    opponent,
    homeAway,
    date,
    address,
    surface,
    meetingTime,
    kickoffTime,
    responseDeadline,
    notifyPlayers,
    reminderHoursBefore
  };
  db.events.push(event);
  writeDb(db);
  res.status(201).json(event);
});

app.delete('/api/events/:id', auth, (req, res) => {
  if (!['Admin', 'Trainer'].includes(req.user.role)) return res.status(403).json({ error: 'Nur Trainer/Admin dürfen löschen' });
  const db = readDb();
  db.events = db.events.filter((e) => e.id !== req.params.id);
  db.nominations = db.nominations.filter((n) => n.eventId !== req.params.id);
  writeDb(db);
  res.json({ message: 'Termin gelöscht/abgesagt' });
});

app.get('/api/events/reminders', auth, (req, res) => {
  const db = readDb();
  const now = Date.now();
  const reminders = db.events
    .map((event) => {
      const deadlineTs = new Date(event.responseDeadline).getTime();
      const reminderTs = deadlineTs - Number(event.reminderHoursBefore || 24) * 3600 * 1000;
      const pendingCount = db.nominations.filter((n) => n.eventId === event.id && (!n.status || n.status === 'Offen')).length;
      return { event, reminderTs, pendingCount, deadlineTs };
    })
    .filter((item) => now >= item.reminderTs && now <= item.deadlineTs && item.pendingCount > 0)
    .map((item) => ({
      eventId: item.event.id,
      title: item.event.title,
      responseDeadline: item.event.responseDeadline,
      pendingCount: item.pendingCount,
      message: `Erinnerung: Für ${item.event.title} fehlen noch ${item.pendingCount} Rückmeldungen.`
    }));
  res.json(reminders);
});

app.get('/api/nominations/:eventId', auth, (req, res) => {
  const db = readDb();
  res.json(db.nominations.filter((n) => n.eventId === req.params.eventId));
});

app.post('/api/nominations', auth, (req, res) => {
  if (!['Trainer', 'Admin'].includes(req.user.role)) return res.status(403).json({ error: 'Nur Trainer/Admin' });
  const { eventId, playerId, playerName } = req.body;
  const db = readDb();
  const nomination = { id: nanoid(), eventId, playerId, playerName, status: 'Offen', reason: '' };
  db.nominations.push(nomination);
  writeDb(db);
  res.status(201).json(nomination);
});

app.put('/api/nominations/:id', auth, (req, res) => {
  const { status, reason = '' } = req.body;
  const db = readDb();
  const nomination = db.nominations.find((n) => n.id === req.params.id);
  if (!nomination) return res.status(404).json({ error: 'Nicht gefunden' });

  const event = db.events.find((e) => e.id === nomination.eventId);
  const isOwner = nomination.playerId === req.user.id;
  const canEdit = ['Admin', 'Trainer'].includes(req.user.role) || isOwner;
  if (!canEdit) return res.status(403).json({ error: 'Keine Berechtigung' });

  if (isOwner && event?.responseDeadline && Date.now() > new Date(event.responseDeadline).getTime()) {
    return res.status(400).json({ error: 'Frist für Zu-/Absage ist abgelaufen' });
  }
  if (status === 'Absage' && !String(reason).trim()) {
    return res.status(400).json({ error: 'Bei Absage ist ein Grund verpflichtend' });
  }

  nomination.status = status;
  nomination.reason = status === 'Absage' ? reason : '';
  writeDb(db);
  res.json(nomination);
});

app.get('/api/ledger', auth, (req, res) => {
  const db = readDb();
  res.json(db.ledger);
});
app.post('/api/ledger', auth, (req, res) => {
  const db = readDb();
  const entry = { id: nanoid(), createdAt: new Date().toISOString(), ...req.body };
  db.ledger.push(entry);
  writeDb(db);
  res.status(201).json(entry);
});

app.get('/api/materials', auth, (req, res) => {
  const db = readDb();
  res.json(db.materials);
});

app.get('/api/exercises', auth, (req, res) => {
  const db = readDb();
  const { ageGroup, performance, type, fitness } = req.query;
  let items = [...db.exercises];
  if (ageGroup) items = items.filter((x) => x.ageGroup === ageGroup);
  if (performance) items = items.filter((x) => x.performance === performance);
  if (type) items = items.filter((x) => x.type === type);
  if (fitness) items = items.filter((x) => x.fitness === fitness);
  res.json(items);
});

app.post('/api/exercises', auth, (req, res) => {
  const db = readDb();
  const item = { id: nanoid(), ...req.body };
  db.exercises.push(item);
  writeDb(db);
  res.status(201).json(item);
});

app.post('/api/videos/upload', auth, upload.single('video'), (req, res) => {
  const db = readDb();
  const video = { id: nanoid(), kind: 'upload', filePath: req.file ? `/uploads/${req.file.filename}` : '', description: req.body.description || '' };
  db.videos.push(video);
  writeDb(db);
  res.status(201).json(video);
});
app.post('/api/videos/link', auth, (req, res) => {
  const { url } = req.body;
  const provider = /youtube|youtu\.be/.test(url) ? 'YouTube' : /tiktok/.test(url) ? 'TikTok' : /instagram/.test(url) ? 'Instagram' : 'Unbekannt';
  const db = readDb();
  const video = { id: nanoid(), kind: 'social', url, provider };
  db.videos.push(video);
  writeDb(db);
  res.status(201).json(video);
});
app.post('/api/videos/extract-instructions', auth, (req, res) => {
  res.json({ instructions: simplifyDescription(req.body.description) });
});
app.get('/api/videos', auth, (req, res) => {
  const db = readDb();
  res.json(db.videos);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
