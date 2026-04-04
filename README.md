# Vereinsmanager Pro

Full-Stack WebApp für Fußballmanagement mit modernem, hellem UI (Tailwind CSS).

## Features

- Rollenmodell: **Admin, Trainer, Spieler, Kassenwart**
- Mitgliederverwaltung (CRUD)
- Authentifizierung mit E-Mail/Passwort
- Passwort-Reset-Flow ("Passwort vergessen" + Token-Link + Reset-Seite)
- Vereinslogo-Upload und Anzeige im Header
- Event- & Spieltagsmanagement
  - Kategorien: Meisterschaft, Pokal, Turnier, Training
  - Spielort mit Adresse + Untergrund (Rasen/Kunstrasen/Asche)
  - Google-Maps-Link pro Event
  - Monatskalender in FullCalendar-ähnlicher Darstellung
- Team-Funktionen
  - Nominierung mit Zusage/Absage
  - Mannschaftskasse als Ledger (Einnahmen/Ausgaben)
- Trainings-Modul
  - Übungsdatenbank mit Filtern (Altersklasse, Leistung, Übungsart, Fitness)
  - Visual Editor (Canvas) mit Drag-&-Drop-ähnlicher Icon-Platzierung
- Video-Features
  - Upload eigener Szenen
  - Social-Media-Link Parser (Instagram, TikTok, YouTube)
  - API-Endpoint zur Umwandlung von Beschreibungen in einfache Textanleitungen

## Start

```bash
npm install
npm run dev
```

Danach öffnen: [http://localhost:3000](http://localhost:3000)

## Demo-Login

- E-Mail: `admin@verein.local`
- Passwort: `admin123`

## Architektur

- **Backend**: Express, JWT, Multer, JSON-Datei als Datenpersistenz (`data/db.json`)
- **Frontend**: Vanilla JS + Tailwind CDN
- **Uploads**: `uploads/`

## Interaktive Single-File-Vorschau

Du kannst die neue Vorschau direkt ohne Backend öffnen:

- Datei: `public/preview.html`
- Öffnen im Browser per Doppelklick oder über einen lokalen Server

Diese Datei enthält eine komplette UI-Demo inkl. LocalStorage-Persistenz für Rollen, Mitglieder, Events, Nominierungen, Kasse, Trainingsboard und Video-Parser.

## Update: Jugendjahrgänge & Event-Workflow

- Altersklassen aktualisiert auf feste Jahrgangsblöcke: A- bis G-Junioren (2007 bis 2020+), darüber Senioren.
- Event-Erstellung erweitert um **Treffzeit**, **Anstoßzeit**, **Absagefrist** (manuell), und **Erinnerungsfenster** in Stunden.
- Zu-/Absage-Logik erweitert: bei **Absage ist ein Grund Pflicht**; Fristen werden bei Spieler-Rückmeldungen geprüft.
- Trainingsmodul um Materialkategorien ergänzt (u.a. Hütchen, Pylonen, Dummies, Koordination, Speed/Power etc.) inkl. Farbauswahl für Leibchen und Dummies.

