import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { createClient } from 'redis';

const { Pool } = pg;
const app = express();
app.use(express.json());
app.use(cors());

// postgres db
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// redis for caching stock
const redis = createClient({ url: process.env.REDIS_URL });
redis.on('error', (e) => console.error('Redis error:', e));
await redis.connect();

// basic tracking
const metrics = {
    decrements_total: 0,
    conflicts: 0,
    requests: 0,
    latency_sum: 0,
};

const track = (fn) => async (req, res, next) => {
    const start = Date.now();
    metrics.requests++;
    try { await fn(req, res, next); }
    catch (e) { next(e); }
    finally { metrics.latency_sum += Date.now() - start; }
};

// helper to refresh redis
async function cacheStock(items) {
    const pipeline = redis.multi();
    for (const item of items) {
        pipeline.set(`stock:${item.id}`, String(item.qty), { EX: 300 });
    }
    await pipeline.exec();
}

// endpoints

// GET /stock: all items, refreshes Redis cache
app.get('/stock', track(async (req, res) => {
    const result = await db.query(
        'SELECT * FROM stock.menu_items ORDER BY category, name'
    );
    await cacheStock(result.rows);
    res.json({ items: result.rows });
}));

// GET /stock/:itemId
app.get('/stock/:itemId', track(async (req, res) => {
    const result = await db.query(
        'SELECT * FROM stock.menu_items WHERE id = $1',
        [req.params.itemId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: result.rows[0] });
}));

// POST /stock/decrement: updating stock count
app.post('/stock/decrement', track(async (req, res) => {
    const { item_id, idempotency_key } = req.body;
    if (!item_id) return res.status(400).json({ error: 'item_id is required' });

    // grab current version
    const current = await db.query(
        'SELECT id, qty, version FROM stock.menu_items WHERE id = $1',
        [item_id]
    );

    if (current.rows.length === 0) return res.status(404).json({ error: 'Item not found' });

    const { qty, version } = current.rows[0];

    if (qty <= 0) {
        metrics.conflicts++;
        return res.status(409).json({ error: 'Out of stock' });
    }

    // use optimistic locking so concurrent updates fail gracefully
    const updated = await db.query(
        `UPDATE stock.menu_items
     SET qty = qty - 1, version = version + 1
     WHERE id = $1 AND version = $2 AND qty > 0
     RETURNING qty, version`,
        [item_id, version]
    );

    if (updated.rows.length === 0) {
        metrics.conflicts++;
        return res.status(409).json({ error: 'Concurrent modification detected, please retry' });
    }

    const newQty = updated.rows[0].qty;
    metrics.decrements_total++;

    // keep redis in sync
    await redis.set(`stock:${item_id}`, String(newQty), { EX: 300 });

    res.json({ success: true, remaining_qty: newQty });
}));

// POST /stock/seed: reset all quantities to defaults
app.post('/stock/seed', track(async (req, res) => {
    await db.query(`
    UPDATE stock.menu_items SET qty = CASE
      WHEN name = 'Chicken Biryani' THEN 50
      WHEN name = 'Beef Tehari'     THEN 40
      WHEN name = 'Mango Lassi'     THEN 100
      WHEN name = 'Dates (7 pcs)'   THEN 200
      WHEN name = 'Piyaju'          THEN 150
      WHEN name = 'Jilapi'          THEN 120
      ELSE 50
    END, version = 0
  `);
    // Refresh cache
    const result = await db.query('SELECT * FROM stock.menu_items');
    await cacheStock(result.rows);
    res.json({ message: 'Stock reset to defaults' });
}));

// GET /health
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        const redisOk = await redis.ping();
        res.json({ status: 'ok', service: 'stock-service', db: 'ok', redis: redisOk === 'PONG' ? 'ok' : 'error' });
    } catch (e) {
        res.status(503).json({ status: 'down', error: e.message });
    }
});

// GET /metrics
app.get('/metrics', (req, res) => {
    res.json({
        service: 'stock-service',
        decrements_total: metrics.decrements_total,
        conflicts: metrics.conflicts,
        total_requests: metrics.requests,
        latency_avg_ms: metrics.requests
            ? Math.round(metrics.latency_sum / metrics.requests)
            : 0,
    });
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => { // error handling
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

// POST /chaos/die: for chaos engineering
app.post('/chaos/die', (req, res) => {
    res.json({ message: 'Stock Service going down' });
    setTimeout(() => process.exit(1), 100);
});

// start it up
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Stock Service running on :${PORT}`));
