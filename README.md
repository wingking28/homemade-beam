# Beam — Split Bills, Keep Friendships

A cross-platform mobile app (iOS & Android) for splitting expenses with friends and groups.

---

## Project Architecture

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Mobile | React Native + Expo (SDK 53) | Cross-platform, TypeScript-native, huge ecosystem, OTA updates |
| Navigation | Expo Router (file-based) | Typed routes, deep linking, no manual stack configuration |
| State | Zustand | Minimal boilerplate, simple async auth state |
| Backend | Node.js + Express + TypeScript | Familiar, fast iteration, type-safe with Zod validation |
| Database | **PostgreSQL** via Prisma ORM | See rationale below |
| Auth | JWT (30-day expiry) + bcrypt | Stateless, works well for mobile |
| UI Design | Google Stitch MCP | AI-generated screens for rapid prototyping |

### Why PostgreSQL over MongoDB

This app's data is fundamentally **relational**:
- Users ↔ Friends (many-to-many via FriendRequest)
- Users ↔ Groups ↔ Expenses ↔ ExpenseShares (multi-level foreign keys)
- Financial data needs **ACID transactions** — when creating an expense and its shares, both must succeed or fail together
- Complex aggregate queries ("who owes whom across all groups") are natural SQL, not natural document queries
- Prisma's type-safe client + PostgreSQL's `DECIMAL(12,2)` type prevents floating-point rounding errors in money

### Folder Structure

```
homemade-beam/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   └── src/
│       ├── index.ts               # Express server entry point
│       ├── middleware/
│       │   └── auth.ts            # JWT authentication middleware
│       ├── routes/                # Route definitions (auth, users, friends, groups, expenses, paymentRequests)
│       ├── controllers/           # Business logic handlers
│       └── utils/
│           └── prisma.ts          # Shared Prisma client singleton
│
├── mobile/
│   ├── app/                       # Expo Router file-based routing
│   │   ├── _layout.tsx            # Root layout (loads auth from storage)
│   │   ├── index.tsx              # Redirect to auth or tabs
│   │   ├── (auth)/
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── (tabs)/
│   │   │   ├── index.tsx          # Home dashboard
│   │   │   ├── friends.tsx        # Friends list + requests + search
│   │   │   ├── groups.tsx         # Groups list + create modal
│   │   │   ├── activity.tsx       # Payment requests (sent/received)
│   │   │   └── profile.tsx        # User profile + sign out
│   │   └── group/
│   │       └── [id].tsx           # Group detail (expenses, balances, members)
│   └── src/
│       ├── components/            # Avatar, Card, BalanceBadge
│       ├── constants/theme.ts     # Colors, Spacing, Radius, FontSize
│       ├── services/api.ts        # Typed API client + all types
│       └── store/authStore.ts     # Zustand auth store (persisted via AsyncStorage)
│
└── README.md
```

### Key Architectural Decisions

1. **File-based routing (Expo Router)**: Route groups `(auth)` and `(tabs)` cleanly separate unauthenticated and authenticated flows without manual navigation logic.

2. **Expense splitting**: Equal splits are computed server-side when creating an expense. A remainder of cents is assigned to the first share to avoid floating-point drift (e.g. $10 ÷ 3 = $3.33, $3.33, $3.34).

3. **Balance calculation**: Net balances per group are computed on-the-fly from `Expense` + `ExpenseShare` records rather than stored, avoiding inconsistency.

4. **JWT in AsyncStorage**: Acceptable for MVP; production would use `expo-secure-store` for OS-level encryption.

5. **Stitch MCP for UI**: Used Google Stitch to generate reference designs for Home dashboard, Login/Register, and Groups screens, which informed the component design.

---

## Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally (or via Docker)
- Expo Go app on your phone (or iOS/Android simulator)

### 1. Set up the database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE homemade_beam;"
```

Or with Docker:
```bash
docker run --name beam-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=homemade_beam -p 5432:5432 -d postgres:16
```

### 2. Start the backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and a strong JWT_SECRET

# Generate Prisma client & run migrations
npm run db:generate
npm run db:migrate

# Start development server
npm run dev
# → Server running on http://localhost:3000
```

### 3. Start the mobile app

```bash
cd mobile

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# If testing on a physical device, change localhost to your machine's IP:
# EXPO_PUBLIC_API_URL=http://192.168.1.x:3000/api

# Start Expo
npm start
# → Scan QR code with Expo Go, or press 'i' for iOS simulator / 'a' for Android
```

---

## API Reference

All endpoints (except auth) require `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register with name, email, password |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/users/search?q=` | Search users by name/email |
| POST | `/api/friends/request` | Send friend request |
| GET | `/api/friends/requests` | Get pending incoming requests |
| PUT | `/api/friends/requests/:id` | Accept or decline request |
| GET | `/api/friends` | Get all friends |
| DELETE | `/api/friends/:friendId` | Remove friend |
| POST | `/api/groups` | Create group |
| GET | `/api/groups` | List user's groups |
| GET | `/api/groups/:id` | Get group detail with expenses |
| POST | `/api/groups/:id/members` | Add member (admin only) |
| DELETE | `/api/groups/:id/members/:userId` | Remove member |
| GET | `/api/groups/:id/balances` | Get per-member balances |
| POST | `/api/expenses/groups/:groupId` | Add expense (equal split by default) |
| GET | `/api/expenses/groups/:groupId` | List group expenses |
| DELETE | `/api/expenses/:id` | Delete expense (payer or admin) |
| POST | `/api/payment-requests` | Send payment request to a friend |
| GET | `/api/payment-requests` | List all requests (`?type=sent\|received\|all`) |
| PUT | `/api/payment-requests/:id` | Mark as PAID or CANCELLED |

---

## UI Screens

Designed using the **Beam Design System** (generated via Google Stitch MCP):
- Primary color: `#6C47FF` (deep violet)
- Success: `#00C896` (mint green — you are owed)
- Danger: `#FF4757` (red — you owe)
- Fonts: Plus Jakarta Sans (headlines) + Inter (body)

| Screen | Description |
|--------|-------------|
| Login / Register | Email + password auth forms |
| Home Dashboard | Balance overview, groups summary, pending requests |
| Friends | Search users, send/accept/decline friend requests |
| Groups | List groups, create group modal with friend picker |
| Group Detail | Expenses list, per-member balances, members, add expense modal |
| Activity | Payment requests (sent/received tabs), mark as paid |
| Profile | User info, sign out |
