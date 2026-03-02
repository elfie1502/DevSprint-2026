import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { createClient } from 'redis';
import rateLimit from 'express-rate-limit';

const { Pool } = pg;
const app = express();
app.use(express.json());
app.use(cors());

// db connection
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// redis for caching
const redis = createClient({ url: process.env.REDIS_URL });
redis.on('error', (e) => console.error('Redis error:', e));
await redis.connect();

// keeping track of stats
const metrics = {
    logins_total: 0,
    login_failures: 0,
    registrations_total: 0,
    requests: 0,
    latency_sum: 0,
};

const track = (fn) => async (req, res, next) => {
    const start = Date.now();
    metrics.requests++;
    try {
        await fn(req, res, next);
    } catch (e) {
        metrics.login_failures++;
        next(e);
    } finally {
        metrics.latency_sum += Date.now() - start;
    }
};

// ── Rate Limiter ──────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({ // prevents brute force on login
    windowMs: 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.body?.student_id || req.ip,
    message: { error: 'Too many login attempts. Try again in a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// endpoints
app.post('/auth/login', loginLimiter, track(async (req, res) => {
    const { student_id, password } = req.body;

    if (!student_id || !password) {
        return res.status(400).json({ error: 'student_id and password are required' });
    }

    const result = await db.query(
        'SELECT * FROM identity.students WHERE student_id = $1',
        [student_id]
    );

    if (result.rows.length === 0) {
        metrics.login_failures++;
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const student = result.rows[0];
    // check password
    const valid = await bcrypt.compare(password, student.password_hash);

    if (!valid) {
        metrics.login_failures++;
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    metrics.logins_total++;

    const token = jwt.sign(
        {
            sub: student.student_id,
            name: student.full_name,
            dept: student.department,
            batch: student.batch,
            avatar: student.avatar_seed,
            role: student.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

    res.json({
        token,
        student: {
            student_id: student.student_id,
            full_name: student.full_name,
            department: student.department,
            batch: student.batch,
            avatar_seed: student.avatar_seed,
            role: student.role,
        },
    });
}));

// POST /auth/register
app.post('/auth/register', track(async (req, res) => {
    const { student_id, password, full_name, department, batch, avatar_seed } = req.body;

    if (!student_id || !password || !full_name) {
        return res.status(400).json({ error: 'student_id, password, and full_name are required' });
    }
// hash password
    
    const password_hash = await bcrypt.hash(password, 10);
    const seed = avatar_seed || `${student_id}_${Date.now()}`;

    try {
        const result = await db.query(
            `INSERT INTO identity.students (student_id, password_hash, full_name, department, batch, avatar_seed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING student_id, full_name, department, batch, avatar_seed, role, created_at`,
            [student_id, password_hash, full_name, department || null, batch || null, seed]
        );

        metrics.registrations_total++;
        // duplicate key error
        res.status(201).json({ student: result.rows[0] });
    } catch (e) {
        if (e.code === '23505') {
            return res.status(409).json({ error: 'Student ID already registered' });
        }
        throw e;
    }
}));

// GET /auth/me
app.get('/auth/me', track(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing token' });
    }

    try {
        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        const result = await db.query(
            'SELECT student_id, full_name, department, batch, avatar_seed, role, created_at FROM identity.students WHERE student_id = $1',
            [payload.sub]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
        res.json({ student: result.rows[0] });
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}));

// POST /auth/change-password
const changePwLimiter = rateLimit({ // limit password changes too
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.body?.student_id || req.ip,
    message: { error: 'Too many password change attempts. Try again in a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/auth/change-password', changePwLimiter, track(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing token' });
    }

    let payload;
    try {
        payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'current_password and new_password are required' });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const result = await db.query(
        'SELECT * FROM identity.students WHERE student_id = $1',
        [payload.sub]
    );
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
    }

    const student = result.rows[0];
    const valid = await bcrypt.compare(current_password, student.password_hash);
    if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const new_hash = await bcrypt.hash(new_password, 10);
    await db.query(
        'UPDATE identity.students SET password_hash = $1 WHERE student_id = $2',
        [new_hash, payload.sub]
    );

    res.json({ message: 'Password updated successfully' });
}));

// GET /health
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        const redisOk = await redis.ping();
        res.json({ status: 'ok', service: 'identity-provider', db: 'ok', redis: redisOk === 'PONG' ? 'ok' : 'error' });
    } catch (e) {
        res.status(503).json({ status: 'down', error: e.message });
    }
});

// GET /metrics
app.get('/metrics', (req, res) => {
    res.json({
        service: 'identity-provider',
        logins_total: metrics.logins_total,
        login_failures: metrics.login_failures,
        registrations_total: metrics.registrations_total,
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

// POST /chaos/die — for chaos engineering (gateway calls this)
app.post('/chaos/die', (req, res) => {
    res.json({ message: 'Identity Provider going down' });
    setTimeout(() => process.exit(1), 100);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Identity Provider running on :${PORT}`));
