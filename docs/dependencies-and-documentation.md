# Dependencies and Documentation

## How to Run

The entire system starts with one command from the project root:

```bash
docker compose up --build
```

Docker Compose will build each service image, start the database and Redis, wait for them to be healthy, then bring up the application services in the correct dependency order. Once everything is up, the frontend is available at `http://localhost:3000`.

To stop everything:

```bash
docker compose down
```

To wipe the database volume as well (full reset):

```bash
docker compose down -v
```

### Default Accounts

These accounts are seeded automatically when the database initialises:

| Student ID | Password | Role |
|---|---|---|
| 240042141 | password | student |
| 240042120 | password | student |
| 240042102 | password | student |
| 240042109 | password | student |
| 240042118 | password | student |
| admin | admin123 | admin |

---

## Service Ports

| Service | Port |
|---|---|
| Frontend | 3000 |
| Order Gateway | 3001 |
| Stock Service | 3002 |
| Kitchen Queue | 3003 |
| Notification Hub | 3004 |
| Identity Provider | 3005 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Running Tests

Tests live in the Gateway and Stock Service. Run them independently:

```bash
# From services/gateway
npm test

# From services/stock
npm test
```

Tests use Jest with `--experimental-vm-modules` because all services use ES modules.

---

## API Reference

### Identity Provider (port 3005)

#### POST /auth/login

Logs a student in and returns a JWT.

Request body:
```json
{
  "student_id": "240042141",
  "password": "password"
}
```

Success response (200):
```json
{
  "token": "<jwt>",
  "student": {
    "student_id": "240042141",
    "full_name": "Lamisa Ibnat Zaman",
    "department": "SWE",
    "batch": "24",
    "avatar_seed": "lamisa2024",
    "role": "student"
  }
}
```

Rate limited to 3 attempts per minute per Student ID. Exceeding the limit returns 429.

#### POST /auth/register

Registers a new student account.

Request body:
```json
{
  "student_id": "240042199",
  "password": "mypassword",
  "full_name": "John Doe",
  "department": "SWE",
  "batch": "24"
}
```

Success response (201): returns the created student object (no password).

Returns 409 if the Student ID is already taken.

#### GET /auth/me

Returns the currently authenticated student's profile.

Headers: `Authorization: Bearer <token>`

#### POST /auth/change-password

Changes the authenticated student's password.

Headers: `Authorization: Bearer <token>`

Request body:
```json
{
  "current_password": "password",
  "new_password": "newpassword"
}
```

#### GET /health

Returns service health. Also checks PostgreSQL and Redis connectivity.

#### GET /metrics

Returns:
```json
{
  "service": "identity-provider",
  "logins_total": 42,
  "login_failures": 3,
  "registrations_total": 5,
  "total_requests": 100,
  "latency_avg_ms": 12
}
```

---

### Order Gateway (port 3001)

This is the main entry point for the frontend. All order and menu operations go through here.

#### GET /menu

Returns the full menu from the Stock Service. No auth required.

Success response (200):
```json
{
  "items": [
    {
      "id": 1,
      "name": "Chicken Biryani",
      "description": "Fragrant basmati rice with tender chicken",
      "emoji": "🍛",
      "price": "85.00",
      "qty": 50,
      "category": "main"
    }
  ]
}
```

#### POST /order

Places an order for a menu item. Requires authentication.

Headers: `Authorization: Bearer <token>`

Request body:
```json
{
  "item_id": 1,
  "idempotency_key": "a-unique-uuid-per-order-attempt"
}
```

Success response (200):
```json
{
  "order_id": "<uuid>",
  "status": "Pending",
  "item_name": "Chicken Biryani",
  "item_emoji": "🍛",
  "item_price": "85.00",
  "student_name": "Lamisa Ibnat Zaman",
  "created_at": "2026-03-02T17:30:00.000Z"
}
```

Returns 401 if the token is missing or invalid.
Returns 409 if the item is sold out.
Returns 400 if `item_id` or `idempotency_key` is missing.

If the same `idempotency_key` is sent again, the existing order is returned instead of creating a duplicate.

#### GET /order/:orderId

Fetches the current state of an order. Only the student who placed the order can access it.

Headers: `Authorization: Bearer <token>`

#### GET /orders/history

Returns all past orders for the authenticated student, most recent first.

Headers: `Authorization: Bearer <token>`

Response:
```json
{
  "orders": [...]
}
```

#### POST /auth/change-password

Proxied to the Identity Provider. Same interface as described above.

#### GET /health

Aggregates health from all downstream services:
```json
{
  "status": "ok",
  "service": "order-gateway",
  "redis": "ok",
  "downstream": [
    { "service": "identity-provider", "status": "ok" },
    { "service": "stock-service", "status": "ok" },
    { "service": "kitchen-queue", "status": "ok" },
    { "service": "notification-hub", "status": "ok" }
  ]
}
```

Returns 503 if any downstream service or Redis is down.

#### GET /metrics

Aggregates metrics from all downstream services:
```json
{
  "gateway": {
    "service": "order-gateway",
    "orders_processed": 100,
    "cache_hits": 30,
    "failures": 2,
    "total_requests": 200,
    "latency_avg_ms": 45
  },
  "downstream": [...]
}
```

#### POST /stock/seed (admin only)

Resets all menu item quantities to their default values.

Headers: `Authorization: Bearer <admin-token>`

#### GET /chaos/kill/:service (admin only)

Sends a kill signal to the target service to test fault tolerance.

Headers: `Authorization: Bearer <admin-token>`

Valid values for `:service`: `stock`, `kitchen`, `notification`, `identity`

---

### Stock Service (port 3002)

These endpoints are called internally by the Gateway. They are exposed for direct access during development.

#### GET /stock

Returns all menu items and refreshes the Redis cache.

#### GET /stock/:itemId

Returns a single menu item by ID.

#### POST /stock/decrement

Decrements the quantity of a menu item by 1 using optimistic locking.

Request body:
```json
{
  "item_id": 1,
  "idempotency_key": "optional-key"
}
```

Returns 409 if the item is out of stock or if a concurrent update was detected.

#### POST /stock/seed

Resets all stock quantities to defaults.

#### GET /health

Checks PostgreSQL and Redis.

#### GET /metrics

```json
{
  "service": "stock-service",
  "decrements_total": 87,
  "conflicts": 4,
  "total_requests": 150,
  "latency_avg_ms": 8
}
```

---

### Kitchen Queue (port 3003)

#### POST /kitchen/enqueue

Called by the Gateway after an order is saved. Adds a job to the BullMQ queue and returns immediately.

Request body:
```json
{
  "order_id": "<uuid>",
  "item_id": 1,
  "item_name": "Chicken Biryani",
  "item_emoji": "🍛",
  "student_name": "Lamisa Ibnat Zaman"
}
```

The worker picks up the job, sets the order status to "In Kitchen", waits a random 3 to 7 seconds, then sets it to "Ready". Both transitions trigger a notification through the Notification Hub.

#### GET /kitchen/status/:orderId

Returns the current status of an order from the database.

#### GET /health

Checks Redis connectivity and returns the current queue depth (waiting + active jobs).

#### GET /metrics

```json
{
  "service": "kitchen-queue",
  "queued": 10,
  "processing": 2,
  "completed": 85,
  "failed": 1,
  "total_requests": 120,
  "latency_avg_ms": 5
}
```

---

### Notification Hub (port 3004)

#### GET /events/:orderId

Opens a Server-Sent Events stream for a specific order. The browser connects here and listens for status updates.

The connection sends a `connected` event immediately, then a `status` event every time the order status changes. A `: heartbeat` comment is sent every 25 seconds to keep the connection alive through proxies.

Events look like:

```
event: status
data: {"order_id":"...","status":"In Kitchen","item_name":"Chicken Biryani","item_emoji":"🍛","student_name":"Lamisa Ibnat Zaman","timestamp":"2026-03-02T17:31:05.000Z"}
```

#### POST /notify

Called internally by the Kitchen Queue worker when order status changes.

Request body:
```json
{
  "order_id": "<uuid>",
  "status": "In Kitchen",
  "item_name": "Chicken Biryani",
  "item_emoji": "🍛",
  "student_name": "Lamisa Ibnat Zaman"
}
```

Response:
```json
{
  "delivered": 1
}
```

`delivered` is the number of active SSE connections that received the event.

#### GET /health

Returns the number of currently active SSE connections.

#### GET /metrics

```json
{
  "service": "notification-hub",
  "active_connections": 3,
  "notifications_sent": 170,
  "connections_total": 200,
  "total_requests": 220,
  "latency_avg_ms": 2
}
```

---

## Dependencies

### Identity Provider

| Package | Version | Purpose |
|---|---|---|
| express | ^4.18.2 | HTTP server and routing |
| cors | ^2.8.5 | Cross-origin request headers |
| bcryptjs | ^2.4.3 | Password hashing |
| jsonwebtoken | ^9.0.2 | JWT signing and verification |
| pg | ^8.11.3 | PostgreSQL client |
| redis | ^4.6.12 | Redis client for caching |
| express-rate-limit | ^7.1.5 | Login rate limiting |

### Order Gateway

| Package | Version | Purpose |
|---|---|---|
| express | ^4.18.2 | HTTP server and routing |
| cors | ^2.8.5 | Cross-origin request headers |
| jsonwebtoken | ^9.0.2 | Token verification |
| pg | ^8.11.3 | PostgreSQL client (orders table) |
| redis | ^4.6.12 | Redis client for stock cache |
| uuid | ^9.0.0 | Generating order UUIDs |
| jest | ^29.7.0 | Unit testing (dev) |

### Stock Service

| Package | Version | Purpose |
|---|---|---|
| express | ^4.18.2 | HTTP server and routing |
| cors | ^2.8.5 | Cross-origin request headers |
| pg | ^8.11.3 | PostgreSQL client |
| redis | ^4.6.12 | Redis client for stock cache |
| jest | ^29.7.0 | Unit testing (dev) |

### Kitchen Queue

| Package | Version | Purpose |
|---|---|---|
| express | ^4.18.2 | HTTP server and routing |
| cors | ^2.8.5 | Cross-origin request headers |
| bullmq | ^5.1.6 | Redis-backed job queue |
| ioredis | ^5.3.2 | Redis client (required by BullMQ) |
| pg | ^8.11.3 | PostgreSQL client (order status updates) |

### Notification Hub

| Package | Version | Purpose |
|---|---|---|
| express | ^4.18.2 | HTTP server and routing |
| cors | ^2.8.5 | Cross-origin request headers |

### Frontend

| Package | Version | Purpose |
|---|---|---|
| @sveltejs/kit | ^2.50.2 | Full-stack Svelte framework |
| svelte | ^5.51.0 | UI component framework |
| vite | ^7.3.1 | Build tool and dev server |
| tailwindcss | ^4.1.18 | Utility-first CSS framework |
| typescript | ^5.9.3 | Type checking |
| uuid | ^13.0.0 | Generating idempotency keys on the client |
| @lucide/svelte | ^0.576.0 | Icon components |
| svelte-5-french-toast | ^2.0.6 | Toast notifications |
| @tailwindcss/forms | ^0.5.11 | Tailwind form style resets |
| eslint | ^9.39.2 | Linting |
| prettier | ^3.8.1 | Code formatting |

---

## Environment Variables

### Identity Provider

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| REDIS_URL | Redis connection string |
| JWT_SECRET | Secret key for signing JWTs |
| PORT | Port to listen on (default 3005) |

### Order Gateway

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| REDIS_URL | Redis connection string |
| JWT_SECRET | Same secret used to verify tokens issued by Identity Provider |
| STOCK_SERVICE_URL | Internal URL for Stock Service |
| KITCHEN_SERVICE_URL | Internal URL for Kitchen Queue |
| NOTIFICATION_SERVICE_URL | Internal URL for Notification Hub |
| IDENTITY_SERVICE_URL | Internal URL for Identity Provider |
| PORT | Port to listen on (default 3001) |

### Stock Service

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| REDIS_URL | Redis connection string |
| PORT | Port to listen on (default 3002) |

### Kitchen Queue

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string (for status updates) |
| REDIS_URL | Redis connection string (for BullMQ) |
| NOTIFICATION_SERVICE_URL | Internal URL for Notification Hub |
| PORT | Port to listen on (default 3003) |

### Notification Hub

| Variable | Description |
|---|---|
| PORT | Port to listen on (default 3004) |

### Frontend

| Variable | Description |
|---|---|
| PUBLIC_GATEWAY_URL | Public URL for the Order Gateway (used in browser) |
| PUBLIC_IDENTITY_URL | Public URL for the Identity Provider (used in browser) |
| PUBLIC_NOTIFICATION_URL | Public URL for the Notification Hub (used in browser) |
| ORIGIN | The frontend's own origin (required by SvelteKit adapter) |

---

## Database Schema

Three schemas in one PostgreSQL instance:

### identity.students

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | Primary key |
| student_id | VARCHAR(20) | Unique, used for login |
| password_hash | TEXT | bcrypt hash |
| full_name | VARCHAR(100) | Display name |
| avatar_seed | VARCHAR(50) | Seed string for avatar generation |
| department | VARCHAR(60) | e.g. SWE, CSE |
| batch | VARCHAR(10) | e.g. 24 |
| role | VARCHAR(10) | student or admin |
| created_at | TIMESTAMP | Auto-set on insert |

### stock.menu_items

| Column | Type | Notes |
|---|---|---|
| id | SERIAL | Primary key |
| name | VARCHAR(100) | Item name |
| description | TEXT | Short description |
| emoji | VARCHAR(10) | Display emoji |
| price | NUMERIC(6,2) | Price in BDT |
| qty | INTEGER | Current stock, default 100 |
| version | INTEGER | Optimistic lock counter, default 0 |
| category | VARCHAR(40) | main, drink, or snack |
| image_url | TEXT | Optional image URL |

### orders.orders

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key, generated on insert |
| student_id | VARCHAR(20) | References the student |
| student_name | VARCHAR(100) | Denormalized for easy display |
| item_id | INTEGER | References the menu item |
| item_name | VARCHAR(100) | Denormalized |
| item_emoji | VARCHAR(10) | Denormalized |
| item_price | NUMERIC(6,2) | Denormalized |
| status | VARCHAR(30) | Pending, In Kitchen, or Ready |
| idempotency_key | VARCHAR(100) | Unique, prevents duplicate orders |
| created_at | TIMESTAMP | Auto-set on insert |
| updated_at | TIMESTAMP | Updated when status changes |
