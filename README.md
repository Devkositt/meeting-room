# Meeting Room Booking System

A full-stack coding-test solution for booking one shared meeting room. It includes a Node.js API, React interface, role-based authorization, overlap protection, user administration, usage summaries, tests, and a one-service deployment configuration.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies API calls to port 3000.

For a production-style local run:

```bash
npm run build
npm start
```

Open `http://localhost:3000`.

## Demo authentication

The app opens on a login screen. Passwords are hashed with Node's `scrypt`, and a successful login returns a random Bearer session token. Two accounts are created on first run:

- KoKo — username `koko`, password `admin123`, role `admin`
- MgMg — username `mgmg`, password `owner123`, role `owner`

KoKo can create additional accounts from **Users**. Usernames must be unique and passwords must contain at least six characters. Sessions are intentionally in memory for this assessment, so users sign in again after a server restart.

## Time and overlap rules

- The browser accepts and displays the user's local time.
- The API accepts ISO 8601 date-times and normalizes them to UTC (`...Z`) for storage and comparison.
- A range is treated as a half-open interval: `[startTime, endTime)`.
- Two ranges overlap when `newStart < existingEnd && newEnd > existingStart`.
- Therefore identical, partial, contained, and containing ranges are rejected. Back-to-back bookings are allowed (one can start exactly when another ends).

## User deletion behavior

Deleting a user also deletes every booking created by that user. The JSON data store writes changes through an atomic temporary-file rename. The currently selected admin cannot delete themself, which prevents accidentally losing the active administration session.

## API

All protected routes require `Authorization: Bearer <session-token>`.

| Method | Route | Access |
|---|---|---|
| GET | `/api/health` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Signed-in user |
| POST | `/api/auth/logout` | Signed-in user |
| GET | `/api/bookings` | All roles |
| POST | `/api/bookings` | User/owner |
| DELETE | `/api/bookings/:id` | Own booking for user; any for owner/admin |
| GET | `/api/summary` | Owner/admin |
| GET | `/api/users` | Admin |
| POST | `/api/users` | Admin |
| PATCH | `/api/users/:id/role` | Admin |
| DELETE | `/api/users/:id` | Admin |

Errors use a consistent shape: `{ "error": { "code": "...", "message": "..." } }`.

## Tests

```bash
npm test
```

Tests cover invalid ranges, identical/partial/contained/containing overlaps, back-to-back ranges, deletion permissions, admin-only user management, cascade deletion, and summary permissions.

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and connect the repository.
3. Render reads `render.yaml`, installs dependencies, builds React, starts Express, and checks `/api/health`.

The free Render filesystem is ephemeral, so demo data may reset when an instance is replaced or redeployed. For a production system, replace the small file store with PostgreSQL and real session/JWT authentication. This limitation does not affect local persistence or assessment of the requested behavior.

## Deploy to Railway

1. Push this repository to GitHub and connect it as a Railway service.
2. Leave the install command on automatic. Railpack runs `npm ci` during its install phase.
3. `railway.json` sets the build command to `npm run build` and the start command to `npm start`.
4. Generate a public domain under **Settings > Networking**.

Do not set the Railway Build Command to `npm ci && npm run build`: that repeats the automatic install and can cause a locked `node_modules/.vite` directory. If a dashboard override already contains that command, remove the override or change it to `npm run build`. Repository configuration takes precedence once the updated commit is deployed.

## Project structure

```text
server/        Express API, authorization, validation, data store
src/           React frontend and responsive styles
test/          Node API integration tests
render.yaml    Render deployment blueprint
```
# meeting-room
