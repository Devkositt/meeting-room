# Meeting Room Booking System

A full-stack application for managing reservations for one shared meeting room. The project was built as a Full Stack Developer coding assessment and includes a Node.js HTTP API, React frontend, login flow, server-side role authorization, booking conflict prevention, user administration, usage summaries, automated tests, and deployment configuration.

- **Live application:** [meeting-room-booking-production-e5bd.up.railway.app](https://meeting-room-booking-production-e5bd.up.railway.app/)
- **Repository:** [github.com/Devkositt/meeting-room](https://github.com/Devkositt/meeting-room)

---

# English Documentation

## 1. Main features

- Login with username and password
- Three roles: Admin, Owner, and User
- Server-side authentication and authorization
- Create and view meeting-room bookings
- Prevent identical, partial, contained, and containing time overlaps
- Allow back-to-back bookings
- Role-aware booking deletion
- Admin user creation, deletion, and role management
- Owner/Admin usage summary grouped by user
- Responsive dashboard for desktop, tablet, and mobile
- Clear validation, authentication, permission, and conflict errors
- Automated API integration tests
- Railway and Render deployment configuration

## 2. Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19 | Component-based user interface |
| Build tool | Vite 7 | Development server and optimized frontend build |
| Backend | Node.js 22+ | JavaScript server runtime |
| API framework | Express 5 | HTTP routes, middleware, and error handling |
| Authentication | Bearer session token | Identifies the signed-in user |
| Password security | Node.js `crypto.scrypt` | Password hashing with a unique salt |
| Data storage | JSON file | Lightweight persistent assessment storage |
| Tests | Node.js test runner | API integration and permission tests |
| Deployment | Railway Railpack / Render | Build, start, and health-check configuration |

## 3. How the application works

1. The browser opens the React login page.
2. The user submits a username and password to `POST /api/auth/login`.
3. The server finds the account and verifies the password against its `scrypt` hash.
4. A successful login creates a cryptographically random session token.
5. The frontend stores the token in browser local storage and sends it as `Authorization: Bearer <token>`.
6. Authentication middleware resolves the token to a current user before protected API routes run.
7. Role middleware and route-specific checks enforce permissions on the server. Hiding a button in React is only a UI convenience; it is not the security boundary.
8. Booking changes and user changes are saved to the configured JSON data file.
9. In production, Express serves both the API and the compiled React files from `dist/` through one service.

Sessions are stored in server memory for this assessment. A server restart invalidates existing sessions and users must sign in again.

## 4. Default accounts

The following accounts are created when the data store is initialized:

| Name | Username | Password | Role |
|---|---|---|---|
| KoKo | `koko` | `admin123` | Admin |
| MgMg | `mgmg` | `owner123` | Owner |

Use KoKo's Admin account to create additional Owner, User, or Admin accounts. Usernames must be unique, use 3–24 lowercase letters, numbers, `.`, `_`, or `-`, and passwords must contain at least six characters.

> The demo passwords are intentionally simple for assessment access. Change them and use secure environment-based bootstrap credentials in a production system.

## 5. Role and permission matrix

All permissions are enforced by the backend API.

| Action | User | Owner | Admin |
|---|:---:|:---:|:---:|
| Sign in and sign out | ✅ | ✅ | ✅ |
| View all bookings | ✅ | ✅ | ✅ |
| Create a booking | ✅ | ✅ | ❌ |
| Delete own booking | ✅ | ✅ | ✅ |
| Delete another user's booking | ❌ | ✅ | ✅ |
| View bookings grouped by user | ❌ | ✅ | ✅ |
| View usage summary | ❌ | ✅ | ✅ |
| View all users | ❌ | ❌ | ✅ |
| Create users | ❌ | ❌ | ✅ |
| Delete users | ❌ | ❌ | ✅ |
| Change user roles | ❌ | ❌ | ✅ |

### User

A User can create bookings, view the complete room schedule, and delete only bookings they created. Direct API attempts to delete another user's booking or manage users return `403 Forbidden`.

### Owner

An Owner can create bookings, view the schedule, delete any booking, and view usage grouped by user. An Owner cannot create, delete, list, or change users.

### Admin

An Admin manages accounts and roles, views all bookings and summaries, and can delete any booking. Under the assessment's explicit permission list, booking creation is limited to User and Owner. An Admin cannot delete the account currently used for their own session.

## 6. User deletion behavior

When an Admin deletes a user:

- The user is removed.
- Every booking created by that user is also removed.
- The JSON store is updated through a temporary file and atomic rename.
- The current Admin cannot delete themself.

This behavior prevents bookings from referring to a user who no longer exists.

## 7. Booking and time rules

- `startTime` must be earlier than `endTime`.
- The API requires ISO 8601 date-times with `Z` or an explicit UTC offset.
- The frontend accepts local date/time input and converts it to an ISO date-time.
- The API normalizes accepted times to UTC before storage.
- The UI converts UTC values back to the viewer's local timezone.
- A booking range is treated as the half-open interval `[startTime, endTime)`.

Two ranges overlap when:

```text
newStart < existingEnd && newEnd > existingStart
```

| Scenario | Result |
|---|---|
| Identical range | Rejected |
| New start inside an existing booking | Rejected |
| New end inside an existing booking | Rejected |
| New range fully inside an existing booking | Rejected |
| New range fully contains an existing booking | Rejected |
| Booking starts exactly when another ends | Allowed |
| Booking ends exactly when another starts | Allowed |

Example: `10:00–11:00` and `11:00–12:00` are valid back-to-back bookings.

## 8. API reference

Except for health and login, routes require:

```http
Authorization: Bearer <session-token>
Content-Type: application/json
```

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Deployment health check |
| `POST` | `/api/auth/login` | Public | Verify credentials and create session |
| `GET` | `/api/auth/me` | Signed in | Return current user |
| `POST` | `/api/auth/logout` | Signed in | Invalidate current session |
| `GET` | `/api/bookings` | All roles | List all bookings |
| `POST` | `/api/bookings` | User, Owner | Create a booking |
| `DELETE` | `/api/bookings/:id` | Role-dependent | Delete an allowed booking |
| `GET` | `/api/summary` | Owner, Admin | Bookings and totals grouped by user |
| `GET` | `/api/users` | Admin | List users without password hashes |
| `POST` | `/api/users` | Admin | Create a user |
| `PATCH` | `/api/users/:id/role` | Admin | Change a user's role |
| `DELETE` | `/api/users/:id` | Admin | Delete a user and their bookings |

### Example login body

```json
{
  "username": "koko",
  "password": "admin123"
}
```

### Example create-user body

```json
{
  "name": "Su Su",
  "username": "susu",
  "password": "user123",
  "role": "user"
}
```

### Example create-booking body

```json
{
  "startTime": "2030-01-01T10:00:00+06:30",
  "endTime": "2030-01-01T11:00:00+06:30"
}
```

### Error response format

```json
{
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "The room is already booked during part of this time."
  }
}
```

Common responses include `400` validation errors, `401` authentication errors, `403` permission errors, `404` missing resources, and `409` booking or username conflicts.

## 9. Project structure

```text
meeting-room/
├── server/
│   ├── app.js          # API routes, sessions, validation, permissions
│   ├── index.js        # Server startup and production frontend hosting
│   └── store.js        # Users, password hashing, bookings, persistence
├── src/
│   ├── main.jsx        # Login and role-aware React dashboard
│   └── styles.css      # Responsive application styling
├── test/
│   └── api.test.js     # Authentication, permission, overlap tests
├── index.html          # Vite HTML entry
├── package.json        # Dependencies and npm scripts
├── vite.config.js      # Vite development proxy and React plugin
├── railway.json        # Railway build/deploy configuration
├── render.yaml         # Render Blueprint configuration
└── .env.example        # Optional local environment variables
```

## 10. Local development

### Requirements

- Node.js 22 or newer
- npm 10 or newer

### Install and run

```bash
git clone https://github.com/Devkositt/meeting-room.git
cd meeting-room
npm install
npm run dev
```

Open `http://localhost:5173`. During development:

- Vite runs the frontend on port `5173`.
- Express runs the API on port `3000`.
- Vite proxies `/api` requests to Express.
- Changes to backend files restart the Node server automatically.

### Optional environment variables

Copy `.env.example` values into your shell or deployment environment:

```text
PORT=3000
DATABASE_PATH=./data/meeting-room.json
```

`PORT` controls the Express port. `DATABASE_PATH` controls the JSON storage location.

## 11. Tests

Run all integration tests:

```bash
npm test
```

The tests start an isolated in-memory server and verify:

- Login succeeds and invalid credentials fail
- Default KoKo and MgMg accounts
- Protected routes require authentication
- Logout invalidates the token
- Admin, Owner, and User permission boundaries
- Admin-created accounts can log in
- Password hashes are never returned by the API
- Duplicate usernames are rejected
- Identical, partial, contained, and containing overlap cases
- Back-to-back bookings are accepted
- Booking deletion rules and summary access

## 12. Production build and start

Create a clean, reproducible installation and optimized frontend build:

```bash
npm ci
npm run build
npm start
```

Build flow:

1. `npm ci` installs the exact versions recorded in `package-lock.json`.
2. `npm run build` runs Vite and generates optimized static files under `dist/`.
3. `npm start` runs `server/index.js`.
4. Express serves `/api/*` from the backend and all other requests from `dist/`.
5. Open `http://localhost:3000` unless `PORT` is set to another value.

Do not commit `dist/`, `node_modules/`, `.env`, or runtime data files.

## ၁။ Project အကြောင်း

ဒီ project က meeting room တစ်ခန်းတည်းအတွက် booking အချိန်တွေ စီမံနိုင်တဲ့ Full Stack Web Application ဖြစ်ပါတယ်။ Login စနစ်၊ Admin/Owner/User role permissions၊ booking overlap စစ်ဆေးခြင်း၊ user management၊ usage summary၊ responsive UI၊ API tests နဲ့ deployment configuration တွေ ပါဝင်ပါတယ်။

Frontend ကို React နဲ့ရေးထားပြီး Backend API ကို Node.js + Express နဲ့ရေးထားပါတယ်။ Production မှာ Express server တစ်ခုတည်းက API နဲ့ build လုပ်ပြီးသား React frontend နှစ်ခုလုံးကို serve လုပ်ပါတယ်။

## ၂။ အသုံးပြုထားတဲ့ နည်းပညာများ

| အပိုင်း | နည်းပညာ | အသုံးပြုပုံ |
|---|---|---|
| Frontend | React 19 | Login နဲ့ role အလိုက် dashboard UI |
| Build tool | Vite 7 | Development server နဲ့ production build |
| Backend | Node.js 22+ | Server runtime |
| API | Express 5 | Routes, middleware, validation, errors |
| Authentication | Bearer session token | Login ဝင်ထားတဲ့ user ကိုခွဲခြားရန် |
| Password | `crypto.scrypt` | Salt ပါတဲ့ password hash သိမ်းရန် |
| Storage | JSON file | Coding test အတွက် data persistence |
| Testing | Node.js test runner | API integration tests |
| Deployment | Railway / Render | Build နဲ့ hosting |

## ၃။ Project အလုပ်လုပ်ပုံ

1. Website ဝင်လိုက်ရင် React login page ကိုအရင်မြင်ရပါတယ်။
2. Username နဲ့ password ကို `/api/auth/login` ဆီပို့ပါတယ်။
3. Backend က username ရှာပြီး သိမ်းထားတဲ့ `scrypt` password hash နဲ့စစ်ပါတယ်။
4. Login မှန်ရင် random session token တစ်ခုထုတ်ပေးပါတယ်။
5. Frontend က token ကို browser local storage မှာသိမ်းပြီး API request တိုင်း `Authorization: Bearer <token>` နဲ့ပို့ပါတယ်။
6. Backend authentication middleware က token နဲ့ user ကိုရှာပါတယ်။
7. Backend က လက်ရှိ user role ကိုစစ်ပြီး ခွင့်ပြုထားတဲ့လုပ်ဆောင်ချက်ကိုပဲ ဆက်လုပ်ခွင့်ပေးပါတယ်။
8. User ပြောင်းလဲမှုနဲ့ booking ပြောင်းလဲမှုတွေကို JSON data file ထဲသိမ်းပါတယ်။
9. Logout လုပ်တဲ့အခါ session token ကို invalid လုပ်ပါတယ်။

Frontend မှာ button ဖျောက်ထားတာတစ်ခုတည်းကို permission အဖြစ် မယူပါဘူး။ API ကိုတိုက်ရိုက်ခေါ်ရင်တောင် Backend က permission ကို ထပ်စစ်ထားပါတယ်။ Server restart ဖြစ်ရင် memory ထဲက sessions တွေပျောက်တဲ့အတွက် ပြန် login ဝင်ရပါမယ်။

## ၄။ Default Login Accounts

| Name | Username | Password | Role |
|---|---|---|---|
| KoKo | `koko` | `admin123` | Admin |
| MgMg | `mgmg` | `owner123` | Owner |

KoKo Admin account နဲ့ login ဝင်ပြီး **Users** menu ကနေ User/Owner/Admin account အသစ်တွေ ဖန်တီးနိုင်ပါတယ်။ Username မတူရပါဘူး။ Password က အနည်းဆုံး ၆ လုံးရှိရပါမယ်။

## ၅။ Role နဲ့ Permission များ

| လုပ်ဆောင်ချက် | User | Owner | Admin |
|---|:---:|:---:|:---:|
| Login/Logout | ✅ | ✅ | ✅ |
| Booking အားလုံးကြည့်ရန် | ✅ | ✅ | ✅ |
| Booking အသစ်ဖန်တီးရန် | ✅ | ✅ | ❌ |
| ကိုယ်ပိုင် booking ဖျက်ရန် | ✅ | ✅ | ✅ |
| တခြား user booking ဖျက်ရန် | ❌ | ✅ | ✅ |
| User အလိုက် grouped bookings ကြည့်ရန် | ❌ | ✅ | ✅ |
| Usage summary ကြည့်ရန် | ❌ | ✅ | ✅ |
| User အားလုံးကြည့်ရန် | ❌ | ❌ | ✅ |
| User အသစ်ဖန်တီးရန် | ❌ | ❌ | ✅ |
| User ဖျက်ရန် | ❌ | ❌ | ✅ |
| Role ပြောင်းရန် | ❌ | ❌ | ✅ |

### User Role

User က booking အသစ်လုပ်နိုင်တယ်၊ booking အားလုံးကြည့်နိုင်တယ်၊ ကိုယ်ဖန်တီးထားတဲ့ booking ကိုပဲဖျက်နိုင်တယ်။ တခြားသူ booking ဖျက်တာနဲ့ user management လုပ်တာကို Backend က `403 Forbidden` ပြန်ပေးပါတယ်။

### Owner Role

Owner က booking လုပ်နိုင်တယ်၊ booking အားလုံးကြည့်နိုင်တယ်၊ ဘယ်သူ့ booking မဆိုဖျက်နိုင်တယ်၊ user အလိုက် booking count နဲ့ summary ကြည့်နိုင်တယ်။ Original assignment requirement အရ Owner က user create/delete နဲ့ role change မလုပ်နိုင်ပါဘူး။

### Admin Role

Admin က user အသစ်ဖန်တီးခြင်း၊ user ဖျက်ခြင်း၊ role ပြောင်းခြင်း၊ booking/summary အားလုံးကြည့်ခြင်းနဲ့ ဘယ် booking မဆိုဖျက်ခြင်း လုပ်နိုင်ပါတယ်။ Assignment permission list အတိုင်း booking create ကို User နဲ့ Owner အတွက်ပဲပေးထားပါတယ်။ လက်ရှိ login ဝင်ထားတဲ့ Admin က ကိုယ့် account ကိုယ်ဖျက်လို့မရပါဘူး။

## ၆။ User ဖျက်ရင် ဘာဖြစ်မလဲ

Admin က user တစ်ယောက်ကို ဖျက်လိုက်ရင်—

- User account ပျက်မယ်။
- အဲဒီ user ဖန်တီးထားတဲ့ bookings အားလုံးပါ ပျက်မယ်။
- Data file ကို temporary file နဲ့အရင်ရေးပြီး atomic rename လုပ်မယ်။
- Login ဝင်ထားတဲ့ Admin က ကိုယ်တိုင်ကို delete မလုပ်နိုင်ဘူး။

ဒီလိုလုပ်ထားတာကြောင့် ဖျက်ပြီးသား user ကိုညွှန်းနေတဲ့ booking အလွတ်တွေ မကျန်တော့ပါဘူး။

## ၇။ Booking Time နဲ့ Overlap Rules

- `startTime` က `endTime` ထက် အရင်ဖြစ်ရမယ်။
- API ကိုပို့တဲ့အချိန် ISO 8601 format နဲ့ timezone `Z` သို့မဟုတ် UTC offset ပါရမယ်။
- Frontend မှာ ကိုယ့် local time နဲ့ထည့်နိုင်တယ်။
- Backend မှာ UTC ပြောင်းပြီး သိမ်းတယ်။
- UI ပြန်ပြတဲ့အခါ ကြည့်နေသူရဲ့ local timezone နဲ့ပြတယ်။
- Time range ကို `[startTime, endTime)` ပုံစံအဖြစ် သတ်မှတ်ထားတယ်။

Overlap စစ်တဲ့ logic က—

```text
newStart < existingEnd && newEnd > existingStart
```

| အခြေအနေ | ရလဒ် |
|---|---|
| အချိန်အတိအကျတူခြင်း | လက်မခံပါ |
| တစ်စိတ်တစ်ပိုင်းထပ်ခြင်း | လက်မခံပါ |
| Booking အသစ်က ရှိပြီးသားအတွင်းဝင်နေခြင်း | လက်မခံပါ |
| Booking အသစ်က ရှိပြီးသားကို အပြည့်ဖုံးနေခြင်း | လက်မခံပါ |
| Booking တစ်ခုပြီးချိန်မှာ နောက်တစ်ခုစခြင်း | လက်ခံပါ |

ဥပမာ `10:00–11:00` ရှိပြီးသားဆိုရင် `11:00–12:00` ကို back-to-back booking အဖြစ် လက်ခံပါတယ်။

## ၈။ Local မှာ Run နည်း

လိုအပ်တာတွေ—

- Node.js 22 သို့မဟုတ် အထက်
- npm 10 သို့မဟုတ် အထက်

```bash
git clone https://github.com/Devkositt/meeting-room.git
cd meeting-room
npm install
npm run dev
```

Browser မှာ `http://localhost:5173` ကိုဖွင့်ပါ။ Development အချိန်မှာ React/Vite က port `5173` မှာ run ပြီး Express API က port `3000` မှာ run ပါတယ်။ `/api` request တွေကို Vite က Backend ဆီ proxy လုပ်ပေးပါတယ်။

## ၉။ Test Run နည်း

```bash
npm test
```

Tests တွေက login မှန်/မမှန်၊ protected routes၊ logout၊ role permissions၊ admin-created user login၊ password hash မပေါက်ကြားခြင်း၊ duplicate username၊ booking overlap အမျိုးအစားအားလုံး၊ back-to-back booking နဲ့ delete permissions တွေကို စစ်ပါတယ်။

## ၁၀။ Production Build လုပ်နည်း

```bash
npm ci
npm run build
npm start
```

Build အဆင့်ဆင့်က—

1. `npm ci` က `package-lock.json` ထဲက version အတိအကျအတိုင်း dependencies install လုပ်ပါတယ်။
2. `npm run build` က Vite production build လုပ်ပြီး `dist/` folder ထုတ်ပါတယ်။
3. `npm start` က Node/Express server ကိုစပါတယ်။
4. Express က `/api/*` ကို Backend API အဖြစ် serve လုပ်ပြီး ကျန်တဲ့ routes တွေကို `dist/` ထဲက React frontend အဖြစ် serve လုပ်ပါတယ်။
5. `PORT` မသတ်မှတ်ထားရင် `http://localhost:3000` မှာ အသုံးပြုနိုင်ပါတယ်။
