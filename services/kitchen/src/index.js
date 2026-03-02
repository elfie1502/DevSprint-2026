import express from 'express';
import cors from 'cors';
import { Queue, Worker, QueueEvents } from 'bullmq';
import pg from 'pg';
import IORedis from 'ioredis';

const { Pool } = pg;
const app = express();
app.use(express.json());
app.use(cors());

// redis connection for BullMQ
const connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
    maxRetriesPerRequest: null,
});

// postgres db
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// queue for orders to cook
const kitchenQueue = new Queue('kitchen', { connection });

// stats
const metrics = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cook_time_sum: 0,
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

// utils
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function updateOrderStatus(orderId, status) {
    await db.query(
        `UPDATE orders.orders SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, orderId]
    );
}

async function notifyHub(orderId, status, itemName, itemEmoji, studentName) {
    try {
        const url = `${process.env.NOTIFICATION_SERVICE_URL}/notify`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, status, item_name: itemName, item_emoji: itemEmoji, student_name: studentName }),
        });
        if (!res.ok) console.error('Notify hub failed:', await res.text());
    } catch (e) {
        console.error('Notify hub error:', e.message);
    }
}

// the worker that actually processes orders
const worker = new Worker(
    'kitchen',
    async (job) => {
        const { order_id, item_id, item_name, item_emoji, student_name } = job.data;
        const cookStart = Date.now();
        metrics.processing++;

        try {
            // mark as in progress
            await updateOrderStatus(order_id, 'In Kitchen');
            await notifyHub(order_id, 'In Kitchen', item_name, item_emoji, student_name);

            // simulate cooking time
            const cookTime = randomBetween(3000, 7000);
            await sleep(cookTime);

            // ready for pickup
            await updateOrderStatus(order_id, 'Ready');
            await notifyHub(order_id, 'Ready', item_name, item_emoji, student_name);

            metrics.completed++;
            metrics.cook_time_sum += Date.now() - cookStart;
        } catch (e) {
            metrics.failed++;
            throw e;
        } finally {
            metrics.processing--;
        }
    },
    { connection }
);

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
});

// api endpoints
\n// POST /kitchen/enqueue
app.post('/kitchen/enqueue', track(async (req, res) => {
    const { order_id, item_id, item_name, item_emoji, student_name } = req.body;

    if (!order_id || !item_id) {
        return res.status(400).json({ error: 'order_id and item_id are required' });
    }

    const job = await kitchenQueue.add('cook', {
        order_id,
        item_id,
        item_name,
        item_emoji,
        student_name,
    });

    metrics.queued++;

    res.json({ job_id: job.id, message: 'Order received' });
}));

// GET /kitchen/status/:orderId
app.get('/kitchen/status/:orderId', track(async (req, res) => {
    const result = await db.query(
        'SELECT id, status, updated_at FROM orders.orders WHERE id = $1',
        [req.params.orderId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = result.rows[0];
    res.json({ order_id: order.id, status: order.status, updated_at: order.updated_at });
}));

// GET /health
app.get('/health', async (req, res) => {
    try {
        const pingOk = await connection.ping();
        const waiting = await kitchenQueue.getWaitingCount();
        const active = await kitchenQueue.getActiveCount();
        res.json({
            status: 'ok',
            service: 'kitchen-queue',
            redis: pingOk === 'PONG' ? 'ok' : 'error',
            queue_depth: waiting + active,
        });
    } catch (e) {
        res.status(503).json({ status: 'down', error: e.message });
    }
});

// GET /metrics
app.get('/metrics', async (req, res) => {
    const waiting = await kitchenQueue.getWaitingCount();
    const active = await kitchenQueue.getActiveCount();
    res.json({
        service: 'kitchen-queue',
        queued: waiting,
        processing: active,
        completed: metrics.completed,
        failed: metrics.failed,
        avg_cook_time_ms: metrics.completed
            ? Math.round(metrics.cook_time_sum / metrics.completed)
            : 0,
        total_requests: metrics.requests,
        latency_avg_ms: metrics.requests
            ? Math.round(metrics.latency_sum / metrics.requests)
            : 0,
    });
});

// ── Error Handler ─────────────────────────────────────────────────────────────
// error handling
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

// POST /chaos/die: for chaos engineering
app.post('/chaos/die', (req, res) => {
    res.json({ message: 'Kitchen Queue going down' });
    setTimeout(() => process.exit(1), 100);
});

// start it up
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Kitchen Queue running on :${PORT}`));
