import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;
const app = express();
app.use(express.json());
app.use(cors());

// db connection to postgres
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// talking to redis for caching
const redis = createClient({ url: process.env.REDIS_URL });
redis.on('error', (e) => console.error('Redis error:', e));
await redis.connect();

// other services we need to call
const STOCK_URL = process.env.STOCK_SERVICE_URL || 'http://stock-service:3002';
const KITCHEN_URL = process.env.KITCHEN_SERVICE_URL || 'http://kitchen-queue:3003';
const NOTIF_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-hub:3004';
const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL || 'http://identity-provider:3005';

// ── Chaos mode state ──────────────────────────────────────────────────────────
const chaosState = { enabled: false, targetService: null };

// track stats 
const metrics = {
    orders_processed: 0,
    cache_hits: 0,
    failures: 0,
    requests: 0,
    latency_sum: 0,
};

// wrapper to measure time and count requests
const track = (fn) => async (req, res, next) => {
    const start = Date.now();
    metrics.requests++;
    try { await fn(req, res, next); }
    catch (e) { metrics.failures++; next(e); }
    finally { metrics.latency_sum += Date.now() - start; }
};

// check if user has a valid token
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    try {
        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        req.student = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.student?.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    });
}

// the bread and butter - order endpoints and proxies

// GET /menu: proxy to Stock Service
app.get('/menu', track(async (req, res) => {
    const response = await fetch(`${STOCK_URL}/stock`);
    const data = await response.json();
    res.status(response.status).json(data);
}));

// POST /order: the core endpoint
app.post('/order', requireAuth, track(async (req, res) => {
    const { item_id, idempotency_key } = req.body;
    const student = req.student;

    // validate input
    if (!item_id) {
        return res.status(400).json({ error: 'item_id is required' });
    }
    if (!idempotency_key) {
        return res.status(400).json({ error: 'idempotency_key is required' });
    }

    // idempotency check - prevent double-orders
    const existing = await db.query(
        'SELECT * FROM orders.orders WHERE idempotency_key = $1',
        [idempotency_key]
    );
    if (existing.rows.length > 0) {
        return res.json(existing.rows[0]);
    }

    // quick cache check before hitting stock service
    const cachedQty = await redis.get(`stock:${item_id}`);
    if (cachedQty !== null && parseInt(cachedQty) <= 0) {
        metrics.cache_hits++;
        return res.status(409).json({ error: 'Sold out' });
    }

    // fetch item details from stock
    const stockRes = await fetch(`${STOCK_URL}/stock/${item_id}`);
    if (!stockRes.ok) {
        return res.status(404).json({ error: 'Item not found' });
    }
    const { item } = await stockRes.json();

    // try to decrement stock
    const decrementRes = await fetch(`${STOCK_URL}/stock/decrement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id, idempotency_key }),
    });

    if (!decrementRes.ok) {
        const err = await decrementRes.json();
        return res.status(decrementRes.status).json(err);
    }

    // save to db with denormalized info for easy access
    const orderId = uuidv4();
    const orderRes = await db.query(
        `INSERT INTO orders.orders
      (id, student_id, student_name, item_id, item_name, item_emoji, item_price, status, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', $8)
     RETURNING *`,
        [
            orderId,
            student.sub,
            student.name,
            item_id,
            item.name,
            item.emoji,
            item.price,
            idempotency_key,
        ]
    );
    const order = orderRes.rows[0];

    // queue to kitchen
    await fetch(`${KITCHEN_URL}/kitchen/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            order_id: orderId,
            item_id,
            item_name: item.name,
            item_emoji: item.emoji,
            student_name: student.name,
        }),
    });

    metrics.orders_processed++;

    res.json({
        order_id: order.id,
        status: order.status,
        item_name: order.item_name,
        item_emoji: order.item_emoji,
        item_price: order.item_price,
        student_name: order.student_name,
        created_at: order.created_at,
    });
}));

// GET /order/:orderId: fetch current state
app.get('/order/:orderId', requireAuth, track(async (req, res) => {
    const result = await db.query(
        'SELECT * FROM orders.orders WHERE id = $1 AND student_id = $2',
        [req.params.orderId, req.student.sub]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
}));

// GET /orders/history: fetch all orders for the authenticated student
app.get('/orders/history', requireAuth, track(async (req, res) => {
    const result = await db.query(
        'SELECT * FROM orders.orders WHERE student_id = $1 ORDER BY created_at DESC',
        [req.student.sub]
    );
    res.json({ orders: result.rows });
}));

// change password (proxied)
app.post('/auth/change-password', requireAuth, track(async (req, res) => {
    const r = await fetch(`${IDENTITY_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization,
        },
        body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
}));

// chaos engineering chaos for demo purposes

// reset stock (admin only)
app.post('/stock/seed', requireAdmin, track(async (req, res) => {
    const r = await fetch(`${STOCK_URL}/stock/seed`, { method: 'POST' });
    const data = await r.json();
    res.status(r.status).json(data);
}));

// kill a service (for demo/chaos testing)
app.get('/chaos/kill/:service', requireAdmin, track(async (req, res) => {
    const { service } = req.params;
    const serviceMap = {
        stock: STOCK_URL,
        kitchen: KITCHEN_URL,
        notification: NOTIF_URL,
        identity: IDENTITY_URL,
    };

    const url = serviceMap[service];
    if (!url) return res.status(400).json({ error: 'Unknown service' });

    try {
        await fetch(`${url}/chaos/die`, { method: 'POST' });
        res.json({ message: `Chaos signal sent to ${service}` });
    } catch (e) {
        res.status(503).json({ error: 'Failed to reach service', detail: e.message });
    }
}));

// kill this service for chaos engineering
app.post('/chaos/die', (req, res) => {
    res.json({ message: 'Goodbye' });
    setTimeout(() => process.exit(1), 100);
});

// health check that queries all downstream services
app.get('/health', track(async (req, res) => {
    const check = async (name, url) => {
        try {
            const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
            const data = await r.json();
            return { service: name, status: data.status };
        } catch {
            return { service: name, status: 'down' };
        }
    };

    const [redisOk, ...services] = await Promise.all([
        redis.ping().then((r) => r === 'PONG'),
        check('identity-provider', IDENTITY_URL),
        check('stock-service', STOCK_URL),
        check('kitchen-queue', KITCHEN_URL),
        check('notification-hub', NOTIF_URL),
    ]);

    const allOk = redisOk && services.every((s) => s.status === 'ok');

    res.status(allOk ? 200 : 503).json({
        status: allOk ? 'ok' : 'degraded',
        service: 'order-gateway',
        redis: redisOk ? 'ok' : 'error',
        downstream: services,
    });
}));

// GET /metrics
app.get('/metrics', track(async (req, res) => {
    const fetchMetrics = async (name, url) => {
        try {
            const r = await fetch(`${url}/metrics`, { signal: AbortSignal.timeout(2000) });
            return { service: name, ...(await r.json()) };
        } catch {
            return { service: name, error: 'unreachable' };
        }
    };

    const [gateway, ...downstream] = await Promise.all([
        Promise.resolve({
            service: 'order-gateway',
            orders_processed: metrics.orders_processed,
            cache_hits: metrics.cache_hits,
            failures: metrics.failures,
            total_requests: metrics.requests,
            latency_avg_ms: metrics.requests
                ? Math.round(metrics.latency_sum / metrics.requests)
                : 0,
        }),
        fetchMetrics('identity-provider', IDENTITY_URL),
        fetchMetrics('stock-service', STOCK_URL),
        fetchMetrics('kitchen-queue', KITCHEN_URL),
        fetchMetrics('notification-hub', NOTIF_URL),
    ]);

    res.json({ gateway, downstream });
}));

// catch-all error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

// start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Order Gateway running on :${PORT}`));
