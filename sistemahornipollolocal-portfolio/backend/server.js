const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const axios = require('axios');
const dotenv = require('dotenv');

const app = express();

// Rutas base compatibles Windows / Ubuntu
const BACKEND_DIR = __dirname;
const ROOT_DIR = path.resolve(BACKEND_DIR, '..');
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(ROOT_DIR, 'frontend');
const ENV_PATH = process.env.ENV_PATH || path.join(ROOT_DIR, '.env');

// Cargar .env
dotenv.config({ path: ENV_PATH });
const PORT = process.env.PORT || 3000;

const colaImpresion = require('./colaImpresion');

// Arranca sincronizador local - nube
require('./sincronizador');

// Middlewares
app.use(cors());
app.use(express.json());

// Servir frontend
app.use(express.static(FRONTEND_DIR));

// Rutas API
const inventarioRoutes = require('./routes/inventario');
const ventasRoutes = require('./routes/ventas');
const gastosRoutes = require('./routes/gastos');

app.use('/api/inventario', inventarioRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/gastos', gastosRoutes);

// Autenticacion del PIN admin
app.post('/api/auth/verificar-pin', (req, res) => {
    const { pin } = req.body;
    const PIN_CORRECTO = process.env.ADMIN_PASSWORD;

    if (!PIN_CORRECTO) {
        console.error("⚠️ ADMIN_PASSWORD no está configurado en .env");
        return res.status(500).json({
            valid: false,
            error: "Error de configuración del servidor"
        });
    }

    if (pin === PIN_CORRECTO) {
        return res.json({ valid: true, role: 'administrador' });
    }

    return res.status(401).json({
        valid: false,
        error: "PIN incorrecto"
    });
});

// Página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Cola de impresión local
app.get('/api/impresion/pendientes', (req, res) => {
    const sucursal_id = String(req.query.sucursal_id || '1');
    const cola = colaImpresion[sucursal_id];

    if (cola && cola.length > 0) {
        const ticket = cola.shift();
        return res.json({ hayTicket: true, cuerpo_ticket: ticket });
    }

    res.json({ hayTicket: false });
});

// Estado del sistema
app.get('/api/sistema/estado', async (req, res) => {
    const estado = {
        local: true,
        postgres: false,
        nube: false,
        ventasPendientes: 0,
        fecha: new Date().toLocaleString('es-MX')
    };

    try {
        await pool.query('SELECT 1');
        estado.postgres = true;

        const pendientes = await pool.query(`
            SELECT COUNT(*) AS total
            FROM ventas
            WHERE sincronizado = FALSE
        `);

        estado.ventasPendientes = parseInt(pendientes.rows[0].total || 0);
    } catch (error) {
        console.error("Error PostgreSQL local:", error.message);
        estado.postgres = false;
    }

    try {
        const nubeUrl = process.env.API_NUBE;
        if (nubeUrl) {
            await axios.get(nubeUrl, { timeout: 3000 });
            estado.nube = true;
        }
    } catch (error) {
        estado.nube = false;
    }

    res.json(estado);
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Servidor LOCAL Sistema POS activo en puerto ${PORT}`);
    console.log(`>>> Frontend: ${FRONTEND_DIR}`);
    console.log(`>>> ENV: ${ENV_PATH}`);
});
