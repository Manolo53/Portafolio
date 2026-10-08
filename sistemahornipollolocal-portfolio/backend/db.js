const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Directorio raíz del proyecto
const ROOT_DIR = path.resolve(__dirname, '..');

// Cargar variables de entorno
dotenv.config({
    path: process.env.ENV_PATH || path.join(ROOT_DIR, '.env')
});

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 5432),

    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

// Funcion para desconexiones del servicio
pool.on('error', (err) => {
    console.error('❌ Error inesperado en PostgreSQL:', err);
});

module.exports = pool;