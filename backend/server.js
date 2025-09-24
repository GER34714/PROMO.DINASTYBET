const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ===== CONFIG =====
// Números que querés dejar fijos de antemano
const numerosFijos = [73, 44, 87, 93];

// ✅ Solo Joaki en formato internacional (Argentina)
const cajeros = ['+5491123365501'];
let indiceCajero = 0; // no rota porque solo hay uno

// Archivo de almacenamiento de reservas
const DATA_FILE = path.join(__dirname, 'data.json');
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

// ===== RUTAS =====

// 🔹 Números bloqueados: fijos + todos los que ya eligieron
app.get('/api/bloqueados', (req, res) => {
  try {
    const lista = JSON.parse(fs.readFileSync(DATA_FILE));
    const elegidos = lista.map(item => item.numero);
    const bloqueados = Array.from(new Set([...numerosFijos, ...elegidos]));
    res.json({ bloqueados });
  } catch (err) {
    console.error('Error leyendo data.json', err);
    res.status(500).json({ bloqueados: numerosFijos });
  }
});

// 🔹 Cajero (siempre Joaki)
app.get('/api/cajero', (req, res) => {
  const numero = cajeros[indiceCajero];
  indiceCajero = (indiceCajero + 1) % cajeros.length;
  res.json({ cajero: numero });
});

// 🔹 Registrar elección
app.post('/api/registrar', (req, res) => {
  try {
    const { numero, telefono } = req.body;
    const lista = JSON.parse(fs.readFileSync(DATA_FILE));

    // Si el número ya está elegido, no lo guardamos
    if (lista.some(item => item.numero === numero)) {
      return res.json({ ok: false, mensaje: 'Número ya ocupado' });
    }

    const cajeroAsignado = cajeros[(indiceCajero - 1 + cajeros.length) % cajeros.length];
    lista.push({ numero, telefono, cajeroAsignado, fecha: new Date() });
    fs.writeFileSync(DATA_FILE, JSON.stringify(lista, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error('Error registrando número', err);
    res.status(500).json({ ok: false });
  }
});

// 🔹 Número ganador (para ganador.html)
app.get('/api/ganador', (req, res) => {
  res.json({ ganador: 93 }); // ⚡ Cambiá 93 por el número que quieras anunciar
});

// 🔹 Stats: total de participantes y últimos números
app.get('/api/stats', (req, res) => {
  try {
    const lista = JSON.parse(fs.readFileSync(DATA_FILE));
    const total = lista.length;
    const ultimos = lista.slice(-5).reverse().map(item => item.numero);
    res.json({ total, ultimos });
  } catch (err) {
    console.error('Error obteniendo stats', err);
    res.status(500).json({ total: 0, ultimos: [] });
  }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor corriendo en puerto', PORT));
