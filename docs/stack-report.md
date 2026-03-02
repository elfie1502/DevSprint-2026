# Stack Report

## Backend: Node.js + Express

Node's async model is perfect for I/O heavy workloads like database calls and service communication. Express keeps the code simple and readable.

## Database: PostgreSQL 16

Transactional correctness matters here, especially with optimistic locking in the Stock Service to handle concurrent purchases without row locks.

## Cache & Queue: Redis 7 + BullMQ

Redis caches menu quantities for fast lookups and backs BullMQ for the job queue. Since orders must be acknowledged quickly but cooking takes time, I decouple acknowledgment from execution with job queues that persist and retry on failure.

## Notifications: Server-Sent Events

Instead of WebSockets, SSE handles notifications since the browser only receives updates from the server. It works over plain HTTP and reconnects automatically.

## Auth: JWT + bcryptjs + express-rate-limit

JWTs expire after 8 hours. Passwords are hashed with bcrypt at cost 10. Login is rate limited to 3 attempts per minute to prevent brute force.

## Frontend: SvelteKit 2 + TypeScript + Tailwind CSS 4

SvelteKit's file-based routing and reactive state made rapid development possible. TypeScript keeps API contracts clear and Tailwind eliminates the need for separate stylesheets.

## Infrastructure: Docker + Compose

Each service runs in its own container with health checks. Compose starts them in the right order reliably.

## CI/CD: GitHub Actions + DigitalOcean

On every push to main, GitHub Actions SSHs to the server, pulls the code, and rebuilds with Docker Compose. Caddy handles HTTPS with Let's Encrypt for all subdomains.

## Testing: Jest

Unit tests cover order validation and Stock Service quantity logic.