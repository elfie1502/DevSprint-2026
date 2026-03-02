import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

// keep track of active SSE connections
const connections = new Map(); // orderId → Set<response>

// stats
const metrics = {
    notifications_sent: 0,
    connections_total: 0,
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

// endpoints
\n// GET /events/:orderId: SSE stream
app.get('/events/:orderId', (req, res) => {
    const { orderId } = req.params;

    // set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // add this connection to the set for this order
    if (!connections.has(orderId)) {
        connections.set(orderId, new Set());
    }
    connections.get(orderId).add(res);
    metrics.connections_total++;

    // say hi
    res.write(`event: connected\ndata: ${JSON.stringify({ order_id: orderId, message: 'Connected' })}\n\n`);

    // heartbeat so proxies don't kill the connection
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 25000);

    // clean up when client disconnects
    req.on('close', () => {
        clearInterval(heartbeat);
        const set = connections.get(orderId);
        if (set) {
            set.delete(res);
            if (set.size === 0) connections.delete(orderId);
        }
    });
});

// POST /notify: called when order status changes
app.post('/notify', track(async (req, res) => {
    const { order_id, status, item_name, item_emoji, student_name } = req.body;

    if (!order_id || !status) {
        return res.status(400).json({ error: 'order_id and status are required' });
    }

    // build the payload
    const payload = JSON.stringify({
        order_id,
        status,
        item_name,
        item_emoji,
        student_name,
        timestamp: new Date().toISOString(),
    });

    // broadcast to all clients watching this order
    const set = connections.get(order_id);
    if (set && set.size > 0) {
        for (const clientRes of set) {
            clientRes.write(`event: status\ndata: ${payload}\n\n`);
        }
        metrics.notifications_sent++;
    }

    res.json({ delivered: set ? set.size : 0 });
}));

// GET /health
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'notification-hub',
        active_connections: [...connections.values()].reduce((acc, s) => acc + s.size, 0),
    });
});

// GET /metrics
app.get('/metrics', (req, res) => {
    res.json({
        service: 'notification-hub',
        active_connections: [...connections.values()].reduce((acc, s) => acc + s.size, 0),
        notifications_sent: metrics.notifications_sent,
        connections_total: metrics.connections_total,
        total_requests: metrics.requests,
        latency_avg_ms: metrics.requests
            ? Math.round(metrics.latency_sum / metrics.requests)
            : 0,
    });
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

// POST /chaos/die: for chaos engineering
app.post('/chaos/die', (req, res) => {
    res.json({ message: 'Notification Hub going down' });
    setTimeout(() => process.exit(1), 100);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Notification Hub running on :${PORT}`));
