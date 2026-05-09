# Notification System Design

## 1. Project Overview

This project is a full-stack notification management system built to fetch, display, filter, paginate, and prioritize notifications from an external evaluation service API. It consists of three independently structured modules:

- **logging_middleware** — a reusable Express middleware that logs every HTTP request to both the console and a local `logs.txt` file
- **notification_app_be** — a Node.js/Express backend that acts as a secure proxy between the frontend and the external API, handling auth, filtering, sorting, and pagination
- **notification_app_fe** — a React + Material UI frontend that renders notifications with tabs, priority ordering, read/unread state, dark mode, and localStorage persistence

---

## 2. Architecture Diagram Explanation

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                                                             │
│   React Frontend (Vite, port 5173)                          │
│   └── axios GET /notifications?type=&page=&limit=           │
│            │  (proxied via vite.config.js)                  │
└────────────┼────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│           Express Backend (port 5000)                       │
│                                                             │
│   logging_middleware/logger.js  ◄── logs every request      │
│            │                        to console + logs.txt   │
│            ▼                                                │
│   GET /notifications                                        │
│   └── axios GET external API                                │
│         + Authorization: Bearer <token>                     │
│         + filter by Type                                    │
│         + sort by Timestamp DESC                            │
│         + paginate with page/limit                          │
└────────────┼────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│   External Evaluation Service                               │
│   http://4.224.186.213/evaluation-service/notifications     │
│   http://4.224.186.213/evaluation-service/logs              │
│   http://4.224.186.213/evaluation-service/auth              │
└─────────────────────────────────────────────────────────────┘
```

The frontend never calls the external API directly. All requests go through the Express backend, which holds the Bearer token securely in `.env` and never exposes it to the browser.

---

## 3. Frontend Flow

```
App.jsx
├── manages: darkMode (useState)
├── manages: unreadCount (useState)  ← updated via onUnreadChange callback
├── renders: ThemeProvider (light/dark via createTheme)
├── renders: AppBar
│   ├── Badge (unreadCount) on NotificationsIcon
│   └── DarkMode/LightMode IconButton toggle
└── renders: NotificationList (passes onUnreadChange)

NotificationList.jsx
├── state: notifications, type, page, total, loading, error, readIds, tab
├── useEffect [type, page] → fetchNotifications() → setNotifications
├── useEffect [notifications, readIds] → onUnreadChange(unreadCount)
├── renders: Filter dropdown (type)
├── renders: Unread Chip + Mark all as read Button
├── renders: Tabs (All | Priority) with live Badge counts
├── renders: CircularProgress (loading state)
├── renders: Alert (error state)
└── renders: CardGrid → NotificationCard[]
    └── Pagination (Previous / Page X of Y / Next)

NotificationCard.jsx
├── props: notification, isRead, onMarkRead
├── renders: Type Chip (colored by type)
├── renders: AccessTimeIcon + Timestamp
├── renders: Message (bold if unread)
├── renders: PRIORITY badge (absolute positioned, Placement only)
└── renders: Mark as Read Button OR ✓ Read indicator
```

**Data flow for a user interaction:**

1. Page loads → `useEffect` fires → `fetchNotifications("All", 1, 6)` → backend returns `{ total, page, limit, notifications[] }`
2. User changes filter → `setType("Event")`, `setPage(1)` → `useEffect` re-fires with new params
3. User clicks "Mark as Read" → `markRead(id)` → adds ID to `readIds` Set → saves to `localStorage` → card moves out of Priority tab instantly
4. User toggles dark mode → `ThemeProvider` re-renders entire tree with new palette

---

## 4. Backend Flow

```
Request arrives at Express (port 5000)
        │
        ▼
logging_middleware/logger.js
  → logs [ISO timestamp] METHOD /url to console + logs.txt
  → calls next()
        │
        ▼
GET /notifications handler
  1. Read query params: type, page (default 1), limit (default 10)
  2. axios.get(external API, { Authorization: Bearer TOKEN })
  3. Safely unwrap response:
       Array.isArray(raw) ? raw : raw.notifications ?? []
  4. Filter by Type if query param present
  5. Sort by Timestamp descending
  6. Slice for pagination: [start, end)
  7. Return JSON: { total, page, limit, notifications[] }
        │
        ▼ (on error)
  console.log(error.response?.data || error.message)
  res.status(500).json({ message: "Error fetching notifications" })
```

---

## 5. Logging Middleware Purpose

The `logging_middleware/logger.js` module serves two purposes:

**Request tracing** — every inbound HTTP request to the Express server is logged with its method, URL, and an ISO 8601 timestamp before any route handler runs.

**Dual output** — logs are written simultaneously to:
- `stdout` via `console.log` for live terminal monitoring
- `logging_middleware/logs.txt` via `fs.appendFile` for persistent audit trail

```
[2026-05-09T10:23:45.123Z] GET /notifications?type=Event&page=1&limit=6
```

The middleware calls `next()` unconditionally so it never blocks the request pipeline. File write errors are caught and logged separately without affecting the response.

The backend also has a separate `logger.js` (`notification_app_be/logger.js`) that POSTs structured log entries to the external evaluation service's `/logs` endpoint using the same Bearer token, with fields: `stack`, `level`, `package`, and `message`.

---

## 6. API Integration

**External API base:** `http://4.224.186.213/evaluation-service`

| Endpoint | Method | Purpose |
|---|---|---|
| `/auth` | POST | Obtain a JWT Bearer token using clientID + clientSecret |
| `/notifications` | GET | Fetch all notifications (requires Authorization header) |
| `/logs` | POST | Submit structured log entries (requires Authorization header) |

**Authentication flow:**

The token is obtained by POSTing credentials to `/auth`:
```json
{
  "email": "<email>",
  "name": "<name>",
  "rollNo": "<rollNo>",
  "accessCode": "<accessCode>",
  "clientID": "<clientID>",
  "clientSecret": "<clientSecret>"
}
```

The returned `access_token` is stored in `.env` as `ACCESS_TOKEN` and loaded via `dotenv`. Every outbound axios request from the backend attaches it as:
```
Authorization: Bearer <token>
```

The token has a short TTL (~15 minutes). When it expires, the `/auth` endpoint must be called again to regenerate it and update `.env`.

**Response shape from external API:**
```json
{
  "notifications": [
    { "ID": "uuid", "Type": "Event|Result|Placement", "Message": "...", "Timestamp": "YYYY-MM-DD HH:mm:ss" }
  ]
}
```

The backend safely handles both a plain array response and a wrapped object using:
```js
Array.isArray(raw) ? raw : raw.notifications ?? []
```

---

## 7. Filtering Logic

**Backend (server.js):**

The `type` query parameter is passed from the frontend. If present, the full notification list is filtered before pagination:

```js
if (type) {
  notifications = notifications.filter((n) => n.Type === type);
}
```

Filtering happens after fetching all data from the external API and before sorting and slicing, so `total` in the response always reflects the filtered count.

**Frontend (notifications.js + NotificationList.jsx):**

The API helper omits the `type` param entirely when the dropdown is set to "All":
```js
const params = { page, limit };
if (type !== "All") params.type = type;
```

When the user changes the dropdown, `page` is reset to `1` to prevent empty results on a page that no longer exists after filtering.

---

## 8. Pagination Logic

**Backend (server.js):**

Pagination is computed after filtering and sorting using array slicing:

```js
const start = (page - 1) * limit;
const end   = start + Number(limit);
const paginatedNotifications = notifications.slice(start, end);
```

The response always includes `total` (filtered count), `page`, and `limit` so the frontend can compute total pages without a separate request.

**Frontend (NotificationList.jsx):**

```js
const totalPages = Math.ceil(total / LIMIT);  // LIMIT = 6
```

- Previous button is disabled when `page === 1`
- Next button is disabled when `page >= totalPages`
- Page counter displays `Page X of Y`
- Changing the type filter resets `page` to `1`

---

## 9. Priority Notification Logic

Priority is computed entirely on the frontend from the current page's data. It does not require a separate API call.

**Priority rank:**
```js
const PRIORITY_ORDER = { Placement: 0, Result: 1, Event: 2 };
```

**Priority list derivation:**
```js
const priorityList = notifications
  .filter((n) => !readIds.has(n.ID))       // only unread
  .sort((a, b) =>
    (PRIORITY_ORDER[a.Type] ?? 3) - (PRIORITY_ORDER[b.Type] ?? 3)
  );                                        // Placement → Result → Event
```

The Priority tab in the UI shows only this list. The count badge on the Priority tab reflects `priorityList.length` in real time. When a notification is marked as read, it is immediately removed from the priority list without any re-fetch.

Cards in the Priority tab that are of type `Placement` display an absolute-positioned `⭐ PRIORITY` badge in the top-right corner.

---

## 10. Read/Unread Notification Handling

**State management:**

Read notification IDs are stored in a `Set<string>` in React state, initialized from `localStorage` on mount:

```js
const getReadIds = () => {
  try { return new Set(JSON.parse(localStorage.getItem("readNotificationIds")) || []); }
  catch { return new Set(); }
};
const [readIds, setReadIds] = useState(getReadIds);
```

**Marking as read:**

```js
const markRead = useCallback((id) => {
  setReadIds((prev) => {
    const next = new Set(prev);
    next.add(id);
    localStorage.setItem("readNotificationIds", JSON.stringify([...next]));
    return next;
  });
}, []);
```

"Mark all as read" iterates the current page's notifications and adds all IDs at once.

**Visual distinction:**

| State | Opacity | Border | Elevation | Font weight | Action |
|---|---|---|---|---|---|
| Unread | 100% | 2px colored | 4 | 600 (bold) | "Mark as Read" button |
| Read | 60% | 1px divider | 1 | 400 (normal) | "✓ Read" label |

Hover effect applies to both states: `translateY(-4px)` with increased `boxShadow`.

**Persistence:** Read state survives page refresh via `localStorage`. The unread count in the AppBar `Badge` is kept in sync via a `useEffect` that fires whenever `notifications` or `readIds` changes, calling the `onUnreadChange` callback up to `App.jsx`.

---

## 11. Future Scalability Improvements

**Backend**

- **Token auto-refresh** — implement a token refresh interceptor in axios that detects `401` responses, calls `/auth` automatically, updates the token in memory, and retries the original request
- **Response caching** — add an in-memory or Redis cache with a short TTL (e.g. 30s) on the `/notifications` route to reduce load on the external API under high traffic
- **Rate limiting** — add `express-rate-limit` to protect the backend from abuse
- **Environment-based config** — separate `.env.development` and `.env.production` files for different API base URLs and token strategies
- **Structured logging** — replace `console.log` with a proper logger like `winston` or `pino` that supports log levels, JSON output, and log rotation

**Frontend**

- **Real-time updates** — replace polling with WebSocket or Server-Sent Events so new notifications appear without a page refresh
- **Optimistic UI** — mark a notification as read instantly in the UI before the state update completes, then revert on failure
- **Infinite scroll** — replace Previous/Next pagination with infinite scroll using `IntersectionObserver` for a smoother mobile experience
- **Notification sound/toast** — show a `Snackbar` toast when new unread notifications arrive
- **Search** — add a text search input that filters notifications by `Message` content client-side
- **Backend-persisted read state** — move read/unread state from `localStorage` to a backend database so it syncs across devices and browsers

**Infrastructure**

- **Containerization** — Dockerize both the frontend and backend with a `docker-compose.yml` for consistent local and production environments
- **Reverse proxy** — put Nginx in front of both services in production to handle SSL termination and route `/api/*` to the backend
- **CI/CD** — add a GitHub Actions pipeline to lint, build, and deploy on push to `main`

---

## 12. Technology Stack

### Backend — `notification_app_be`

| Technology | Version | Purpose |
|---|---|---|
| Node.js | Runtime | JavaScript server runtime |
| Express | ^5.2.1 | HTTP server and routing |
| axios | ^1.16.0 | HTTP client for external API calls |
| cors | ^2.8.6 | Cross-Origin Resource Sharing headers |
| dotenv | ^16.x | Load `ACCESS_TOKEN` from `.env` |

### Frontend — `notification_app_fe`

| Technology | Version | Purpose |
|---|---|---|
| React | ^19.2.5 | UI component framework |
| Vite | ^8.0.10 | Dev server and build tool |
| Material UI (`@mui/material`) | ^9.0.1 | Component library and theming |
| `@mui/icons-material` | ^9.x | Icon set (Star, Inbox, AccessTime, etc.) |
| `@emotion/react` + `@emotion/styled` | ^11.x | CSS-in-JS engine for MUI |
| axios | ^1.16.0 | HTTP client for backend API calls |

### Logging Middleware — `logging_middleware`

| Technology | Purpose |
|---|---|
| Node.js `fs` module | Append log entries to `logs.txt` |
| Node.js `path` module | Resolve absolute path to log file |
| Express middleware pattern | Intercept every request via `app.use(logger)` |

### External Service

| Endpoint | Purpose |
|---|---|
| `http://4.224.186.213/evaluation-service/auth` | JWT token generation |
| `http://4.224.186.213/evaluation-service/notifications` | Source of notification data |
| `http://4.224.186.213/evaluation-service/logs` | Remote structured log ingestion |
