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

Use the user selector in the header. The browser sends the selected user's ID in the `x-user-id` header. This is intentionally simple for the assessment; every authorization decision is still enforced by the API. Three demo accounts are created on first run:

- Alice Admin (`admin`)
- Oscar Owner (`owner`)
- Uma User (`user`)

## Time and overlap rules

- The browser accepts and displays the user's local time.
- The API accepts ISO 8601 date-times and normalizes them to UTC (`...Z`) for storage and comparison.
- A range is treated as a half-open interval: `[startTime, endTime)`.
- Two ranges overlap when `newStart < existingEnd && newEnd > existingStart`.
- Therefore identical, partial, contained, and containing ranges are rejected. Back-to-back bookings are allowed (one can start exactly when another ends).

## User deletion behavior

Deleting a user also deletes every booking created by that user. The JSON data store writes changes through an atomic temporary-file rename. The currently selected admin cannot delete themself, which prevents accidentally losing the active administration session.

## API

All protected routes require `x-user-id: <id>`.

| Method | Route | Access |
|---|---|---|
| GET | `/api/health` | Public |
| GET | `/api/session/users` | Public, for demo login |
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

## Project structure

```text
server/        Express API, authorization, validation, data store
src/           React frontend and responsive styles
test/          Node API integration tests
render.yaml    Render deployment blueprint
```
# meeting-room
