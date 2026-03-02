STACK REPORT AND JUSTIFICATION

# Runtime and Framework: Node.js + Express

Each of the five back-end services uses Node.js with Express. This is a good choice because of the I/O workloads that each service has to do (e.g., calling the database, looking things up in Redis, making HTTP requests to other services), which makes Node.js' asynchronous programming model well-suited to this application. As far as frameworks go, I chose Express primarily for its simplicity; there isn't a lot of "magic" in Express, mostly just middleware and route handlers. This made each service relatively simple and easy to follow.

# Database: PostgreSQL 16

I have chosen PostgreSQL to store our persistent data across three logical schemas: identity, stock, and orders. Our primary reason for choosing PostgreSQL was for transactional correctness, since I am using optimistic locking in the Stock Service, native UUID generation, and the reliability of UNIQUE constraints to enforce idempotent keys. Since I are using a single instance of PostgreSQL with multiple schemas, I can keep Docker Compose simple for a hackathon-style project.

I are implementing **optimistic locking** in the Stock Service by using a version number in the Stock table. When I attempt to decrease the quantity of an item by one, I will only update the quantity if the version number is still the same as the version number I retrieved from the database. Therefore, if multiple requests to purchase the last remaining quantity of an item occur simultaneously, they will be rejected immediately, without the need for row level locks.

```sql
UPDATE stock.menu_items
SET qty = qty - 1, version = version + 1
WHERE id = $1 AND version = $2 AND qty > 0
RETURNING qty, version
```

# Cache and Queue Backend: Redis 7

Redis serves two functions. First, every time the Stock Service fetches the menu items, it stores the current quantity of each item in Redis with a TTL of 5 minutes. The Gateway then looks for these quantities in Redis before sending the order to the Stock Service. If an item is sold out, the Gateway will reject the order immediately without even hitting the database. Second, Redis provides the backing for BullMQ, the job queue that the Kitchen Queue uses to create the pipeline of jobs for the kitchen workers.

# Job Queue: BullMQ

Because orders must be acknowledged within 2 seconds, but cooking may take anywhere from 3 to 7 seconds, I have decoupled the acknowledgement of the order from the actual cooking process using BullMQ. Additionally, BullMQ provides retry functionality and job persistence, so if a kitchen worker crashes, an order in progress will not be lost silently.

# Real-Time Notifications: Server-Sent Events

Instead of using WebSockets, the Notification Hub is using SSE (Server-Sent Events) because the browser only needs to receive events from the server, not send them. SSE works over a standard HTTP connection, doesn't require specialized infrastructure, and the browser's EventSource API will reconnect automatically if the connection is dropped. The hub maintains an orderId->Set mapping and sends notifications to all connected clients whenever the kitchen worker posts a status change.

# Authentication: JWT + bcryptjs + express-rate-limit

The Identity Provider generates JWTs that expire after 8 hours. The Gateway verifies local tokens using the shared secret, therefore does not make a database call per request. Passwords are hashed using bcrypt at a cost factor of 10. I have implemented login with a rate limit of 3 attempts per minute per Student ID to meet the requirements of brute force protection.

# Frontend: SvelteKit + TypeScript + Tailwind CSS v4

SvelteKit's file-based routing and Svelte 5's rune system ($state, $derived) allowed us to rapidly develop the student flow and admin dashboard with reactive real-time updates. TypeScript explicitly defined the types of responses from the APIs. Tailwind's utility classes eliminated the need for separate stylesheets to maintain during the rapid development of the project.

# Containerization: Docker + Compose

Each service is running in its own container. Compose manages the start-up order based upon depends_on with condition: service_healthy. Thus, docker-compose up --build will reliably bring the entire system up in the proper order each time.

# Testing: Jest

Jest unit tests in the Gateway and Stock Service test the validation of the orders (invalid fields, invalid format of the auth header), and the logic of the Stock Service to decrease the quantity of an item (successful reduction, zero-stock rejection, optimistic lock conflict). Jest was selected due to its zero configuration and familiar API. The --experimental-vm-modules flag is necessary because the services use ES modules.

# Summary Table

| Layer | Technology | Version |
| --- | --- | --- |
| Service runtime | Node.js | 22 (Alpine) |
| HTTP framework | Express | 4.x |
| Database | PostgreSQL | 16 (Alpine) |
| Cache and queue backend | Redis | 7 (Alpine) |
| Job queue | BullMQ | 5.x |
| Auth tokens | jsonwebtoken | 9.x |
| Password hashing | bcryptjs | 2.x |
| Rate limiting | express-rate-limit | 7.x |
| Frontend framework | SvelteKit | 2.x |
| Frontend language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Icons | Lucide Svelte | 0.576.x |
| Unique IDs | uuid | 9.x (services), 13.x (frontend) |
| Containerization | Docker + Compose | Compose v2 |
| Testing | Jest | 29.x |