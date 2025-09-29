const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // 👈 PostgreSQL

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ===== CONFIG =====
const numerosFijos = [73, 44, 87, 93];      // Números bloqueados de antemano
const cajeros = ['+5491123365501'];         // Joaki
let indiceCajero = 0;                       // Rota si hubiera más de un cajero

// ✅ Conexión a la base PostgreSQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ✅ Crear tabla 'reservas' si todavía no existe (esto evita entrar a psql)
pool.query(`
CREATE TABLE IF NOT EXISTS reservas (
  id SERIAL PRIMARY KEY,
  numero INT UNIQUE NOT NULL,
  telefono TEXT,
  cajero TEXT,
  fecha TIMESTAMP DEFAULT NOW()
);
`).then(() => {
  console.log("Tabla 'reservas' lista ✅");
}).catch(err => {
  console.error("Error creando tabla", err);
});

// ===== Helpers =====

// Devuelve array de números reservados
async function obtenerReservados() {
  const { rows } = await pool.query('SELECT numero FROM reservas');
  return rows.map(r => r.numero);
}

// Intenta reservar un número
async function reservarNumero(numero, telefono, cajero) {
  try {
    await pool.query(
      'INSERT INTO reservas (numero, telefono, cajero) VALUES ($1,$2,$3)',
      [numero, telefono, cajero]
    );
    return { ok: true };
  } catch (err) {
    if (err.code === '23505') { // UNIQUE violation
      return { ok: false, msg: 'Número ya ocupado' };
    }
    console.error('Error al reservar número', err);
    return { ok: false };
  }
}

// Stats: total de participantes y últimos 5 números
async function obtenerStats() {
  const { rows: ult } = await pool.query(
    'SELECT numero FROM reservas ORDER BY fecha DESC LIMIT 5'
  );
  const { rows: count } = await pool.query(
    'SELECT COUNT(*) FROM reservas'
  );
  return {
    total: parseInt(count[0].count, 10),
    ultimos: ult.map(r => r.numero)
  };
}

// ===== RUTAS =====

// 🔹 Lista de números bloqueados
app.get('/api/bloqueados', async (req, res) => {
  try {
    const reservados = await obtenerReservados();
    const bloqueados = Array.from(new Set([...numerosFijos, ...reservados])).sort((a,b)=>a-b);
    res.json({ bloqueados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ bloqueados: numerosFijos });
  }
});

// 🔹 Cajero (rota si hubiera varios)
app.get('/api/cajero', (req, res) => {
  const numero = cajeros[indiceCajero];
  indiceCajero = (indiceCajero + 1) % cajeros.length;
  res.json({ cajero: numero });
});

// 🔹 Registrar elección de número
app.post('/api/registrar', async (req, res) => {
  const numero = parseInt(req.body.numero, 10);
  const telefono = String(req.body.telefono || 'sin-dato');
  const cajero = cajeros[(indiceCajero - 1 + cajeros.length) % cajeros.length];

  const result = await reservarNumero(numero, telefono, cajero);
  if (!result.ok) return res.json({ ok: false, mensaje: result.msg });
  res.json({ ok: true });
});

// 🔹 Número ganador (puedes cambiar el 93 por el que quieras)
app.get('/api/ganador', (req, res) => {
  res.json({ ganador: 93 });
});

// 🔹 Stats
app.get('/api/stats', async (req, res) => {
  const stats = await obtenerStats();
  res.json(stats);
});

// 🔹 Healthcheck
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor corriendo en puerto', PORT));
