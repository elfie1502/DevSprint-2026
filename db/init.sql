-- ============================================================
-- DevSprint 2026 - Database Initialization
-- Single PostgreSQL instance, 3 logical schemas
-- ============================================================

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS stock;
CREATE SCHEMA IF NOT EXISTS orders;

-- ============================================================
-- IDENTITY SCHEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS identity.students (
  id            SERIAL PRIMARY KEY,
  student_id    VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     VARCHAR(100) NOT NULL,
  avatar_seed   VARCHAR(50),
  department    VARCHAR(60),
  batch         VARCHAR(10),
  role          VARCHAR(10) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- STOCK SCHEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS stock.menu_items (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  emoji       VARCHAR(10),
  price       NUMERIC(6,2) NOT NULL,
  qty         INTEGER DEFAULT 100,
  version     INTEGER DEFAULT 0,
  category    VARCHAR(40) DEFAULT 'main',
  image_url   TEXT
);

-- ============================================================
-- ORDERS SCHEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS orders.orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        VARCHAR(20) NOT NULL,
  student_name      VARCHAR(100),
  item_id           INTEGER NOT NULL,
  item_name         VARCHAR(100),
  item_emoji        VARCHAR(10),
  item_price        NUMERIC(6,2),
  status            VARCHAR(30) DEFAULT 'Pending',
  idempotency_key   VARCHAR(100) UNIQUE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SEED: Students (SWE '24 Batch)
-- password is "password" hashed with bcrypt (cost=10)
-- ============================================================
INSERT INTO identity.students (student_id, full_name, avatar_seed, department, batch, role, password_hash)
VALUES
  ('240042141', 'Lamisa Ibnat Zaman',  'lamisa2024',   'SWE', '24', 'student', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('240042120', 'Mubtasim Fuad',       'mubtasim2024', 'SWE', '24', 'student', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('240042102', 'Musaddik Solimullah', 'musaddik2024', 'SWE', '24', 'student', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('240042109', 'Mahdia Hossain',      'mahdia2024',   'SWE', '24', 'student', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('240042118', 'Areeba Zahra Kabir',  'areeba2024',   'SWE', '24', 'student', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT (student_id) DO NOTHING;

-- ============================================================
-- SEED: Admin Account
-- password is "admin123" hashed with bcrypt (cost=10)
-- ============================================================
INSERT INTO identity.students (student_id, full_name, avatar_seed, department, batch, role, password_hash)
VALUES
  ('admin', 'Admin', 'admin_seed', 'ADMIN', '-', 'admin', '$2a$10$ZpMawpIEFe1EgAFC8zdrT.kYzNJ1Ax/5pjMlKV/PA/vib.M6Ap086')
ON CONFLICT (student_id) DO NOTHING;

-- ============================================================
-- SEED: Iftar Menu
-- ============================================================
INSERT INTO stock.menu_items (name, description, emoji, price, qty, category)
VALUES
  ('Chicken Biryani', 'Fragrant basmati rice with tender chicken',  '🍛', 85.00,  50, 'main'),
  ('Beef Tehari',     'Rich beef & spiced rice',                    '🥘', 95.00,  40, 'main'),
  ('Mango Lassi',     'Chilled mango yogurt drink',                 '🥭', 30.00, 100, 'drink'),
  ('Dates (7 pcs)',   'Premium Medjool dates',                      '🌴', 25.00, 200, 'snack'),
  ('Piyaju',          'Crispy lentil fritters',                     '🧅', 15.00, 150, 'snack'),
  ('Jilapi',          'Syrupy spiral sweet',                        '🍬', 20.00, 120, 'snack')
ON CONFLICT DO NOTHING;
