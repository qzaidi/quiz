# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development
```bash
npm install          # Install dependencies
npm start            # Start the server (port 3000)
npm run dev          # Start with file watching using --watch flag
npm run build        # Build minified, content-hashed assets into dist/ (see BUILD.md)
```

### Docker Testing
```bash
docker compose build
docker compose run --service-ports app
```

### Debug Mode
Set `DEBUG=true` environment variable to enable verbose SQL query logging from better-sqlite3.

## Architecture Overview

This is a real-time trivia quiz platform built with vanilla JavaScript (no frontend framework). The architecture follows a traditional REST API + WebSocket pattern.

### Tech Stack
- **Backend**: Node.js + Express (ES modules)
- **Database**: SQLite (better-sqlite3) with synchronous queries
- **Real-time**: WebSocket (ws library) for live participant counts
- **Frontend**: Vanilla JavaScript, no bundler. `npm run build` (scripts/build.js) minifies own JS/CSS into `dist/` with content-hashed filenames for cache-busting; the server serves `dist/` only in production when it exists, falling back to `public/`. See BUILD.md.

### Key Architecture Patterns

**Admin Authentication**: Simple header-based auth using `X-Admin-Password`. The password is either set via `ADMIN_PASSWORD` environment variable or randomly generated on startup and logged to console. See `src/middleware/auth.js`.

**Database Access**: All queries use `better-sqlite3` synchronous API. The database is initialized in `src/database.js` with inline schema migrations. All SQL is inline prepared statements - no ORM.

**Quiz Visibility**: Quizzes have an `is_visible` flag. The `/api/quizzes` endpoint filters to only visible quizzes unless the admin password is provided via `X-Admin-Password` header. This allows admins to preview quizzes before making them public.

**Time-based Access Control**: Quizzes have `start_time` and optional `end_time`. The server uses wall-clock time comparisons (converting to local ISO format) to determine if a quiz can be joined or if questions can be fetched. After `end_time`, the quiz becomes "archived" and correct answers are included in API responses.

**UI Themes**: Visual themes are pure CSS token blocks in `public/themes.css`, keyed off `data-theme` on `<html>` (`minimal` default, `classic` = original look). `style.css` is theme-agnostic and consumes the tokens (`--bg-color`, `--accent`, `--radius`, etc.) — new styles should use tokens, not hardcoded colors. The user picks a theme via the header picker; it's persisted in `localStorage('ui-theme')` and applied pre-paint by an inline `<head>` script in each HTML file. This is separate from per-quiz color themes (the `theme` JSON column), which override `--theme-primary`/`--theme-bg` on top of any UI theme.

**Multi-language Translations**:
- Quizzes have a `languages` JSON array (e.g., `["en", "es"]`)
- Questions have a `translations` JSON column: `{ "es": { "text": "...", "hint": "...", "options": [...] } }`
- When adding questions with translations, the quiz's `languages` array is automatically updated to include new language codes
- The frontend `app.js` handles language switching and displaying translated content

**WebSocket Participant Tracking**: Live participant counts per quiz. Clients connect with `?quizId=N` parameter. The server maintains a Map of `quizId -> Set<WebSocket>` and broadcasts count updates on connection/disconnect.

**API Structure**:
- `/api/*` - Public routes (join, questions, submit, leaderboard)
- `/api/admin/*` - Admin routes (protected by `adminAuth` middleware)
- Admin routes include bulk import endpoints for questions

### Important File Locations
- `src/app.js` - Entry point, initializes DB and HTTP server
- `src/database.js` - Schema and migrations
- `src/websocket.js` - Real-time participant counting
- `src/routes/public.js` - Game-play endpoints
- `src/routes/admin.js` - CRUD for quizzes/questions/sessions
- `src/middleware/auth.js` - Admin password validation
- `public/app.js` - Main game logic (quiz taking, WebSocket, language switching)
- `public/admin.js` - Admin dashboard (DataTables for questions/sessions)
