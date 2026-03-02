# Ohi's Canteen: DevSprint 2026

A distributed microservice-based canteen ordering system built for the **DevSprint 2026** hackathon organized by **IUTCS**. The app simulates the IUT cafeteria rush: students can register, log in, browse the menu, place orders, and track them in real time.

**Live at:** [https://devsprint26.duckdns.org](https://devsprint26.duckdns.org)

**Author:** Mumtahina Marium (240042110)

---

## Quick Start

```bash
docker compose up --build
```

Everything runs on Docker. Open [http://localhost:3000](http://localhost:3000) once it's up.

### Demo Accounts

| Role    | Student ID   | Name                   | Password   |
|---------|--------------|------------------------|------------|
| Student | `240042141`  | Lamisa Ibnat Zaman     | `password` |
| Student | `240042120`  | Mubtasim Fuad          | `password` |
| Student | `240042102`  | Musaddik Solimullah    | `password` |
| Student | `240042109`  | Mahdia Hossain         | `password` |
| Student | `240042118`  | Areeba Zahra Kabir     | `password` |
| Admin   | `admin`      | Admin                  | `admin123` |

---

## Architecture

Five microservices, each in its own container, talking over HTTP and Redis:

| Service             | Port | What it does                                                                 |
|---------------------|------|------------------------------------------------------------------------------|
| **Frontend**        | 3000 | SvelteKit SPA: the UI students and admins use                                |
| **Order Gateway**   | 3001 | API gateway: validates tokens, checks cache, routes requests                 |
| **Stock Service**   | 3002 | Manages inventory with optimistic locking to prevent overselling             |
| **Kitchen Queue**   | 3003 | Accepts orders instantly, processes them async (3-7s cook time) via BullMQ   |
| **Notification Hub**| 3004 | Pushes real-time status updates to the browser using SSE                     |
| **Identity Provider**| 3005 | Handles registration, login, JWT tokens, and password changes               |
| **PostgreSQL**      | 5432 | Single database with schemas for identity, stock, and orders                 |
| **Redis**           | 6379 | Caching layer + BullMQ job queue backend                                     |

---

## Features

### Student Flow

- **Register**: Create an account with student ID, name, department, and batch.
- **Login**: Authenticate and get a JWT token. Quick-fill buttons on the login page for demo accounts.
- **Menu**: Browse available food items filtered by category (Mains, Drinks, Snacks). Each item shows price, stock level, and a color-coded availability badge (green / amber / red).
- **Place Order**: One-click ordering with idempotency keys to prevent duplicates. Redirects to the order tracker immediately.
- **Order Tracker**: Real-time 3-step progress bar (Pending → In Kitchen → Ready) powered by Server-Sent Events. Get a toast notification when your order is ready for pickup.
- **Order History**: See all your past orders with dates, statuses, and prices. Click any to revisit the tracker.
- **Profile**: View your info, change your password, or sign out.

### Admin Dashboard

Accessible only to users with the admin role.

- **Service Health Grid**: Live green/red status indicators for every microservice. Auto-refreshes every 5 seconds.
- **Gateway Metrics**: Orders processed, cache hits, failures, and average latency. Latency alerts when it exceeds 1 second.
- **Downstream Metrics**: Detailed stats from each healthy service.
- **Chaos Engineering**: Kill individual services (Stock, Kitchen, Notification, Identity) to observe how the system handles partial failures. Services auto-restart via Docker Compose.
- **Reset Stock**: Restore the default menu inventory with one click.

---

## Requirement Checklist

| Requirement                          | Status |
|--------------------------------------|--------|
| 5 containerized microservices        | ✅      |
| Single `docker compose up` startup   | ✅      |
| JWT authentication & protected routes| ✅      |
| Idempotent order placement           | ✅      |
| Async kitchen processing (BullMQ)    | ✅      |
| Redis caching in front of stock DB   | ✅      |
| Optimistic locking for stock         | ✅      |
| Health endpoints on every service    | ✅      |
| Metrics endpoints on every service   | ✅      |
| Student journey UI                   | ✅      |
| Admin monitoring dashboard           | ✅      |
| Real-time order tracking (SSE)       | ✅      |
| Chaos toggle for fault injection     | ✅      |
| Unit tests (Gateway + Stock)         | ✅      |
| CI/CD pipeline (GitHub Actions)      | ✅      |
| Cloud deployment (DigitalOcean)      | ✅      |
| Rate limiting on login (3/min)       | ✅      |
| Latency alert (>1s threshold)        | ✅      |

---

## CI/CD

Every push to `main` triggers automatic deployment:

1. GitHub Actions SSHs into the DigitalOcean droplet
2. Pulls the latest code
3. Runs `docker compose up --build -d`

Caddy handles HTTPS and reverse proxying for all subdomains.

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | SvelteKit, TypeScript, Tailwind v4|
| Backend     | Node.js, Express                  |
| Database    | PostgreSQL 16                     |
| Cache/Queue | Redis 7, BullMQ                  |
| Auth        | JWT, bcryptjs                     |
| Real-time   | Server-Sent Events               |
| Testing     | Jest                              |
| CI/CD       | GitHub Actions                    |
| Hosting     | DigitalOcean + Caddy              |

---

## Project Structure

```
├── frontend/            # SvelteKit SPA
├── services/
│   ├── gateway/         # Order Gateway (port 3001)
│   ├── stock/           # Stock Service (port 3002)
│   ├── kitchen/         # Kitchen Queue (port 3003)
│   ├── notification/    # Notification Hub (port 3004)
│   └── identity/        # Identity Provider (port 3005)
├── db/
│   └── init.sql         # Database schema + seed data
├── docs/                # Stack report, requirements, docs
├── docker-compose.yml   # Run everything with one command
└── .github/workflows/   # CI/CD pipeline
```
