const express = require('express');
const router = express.Router();
const pool = require('../db');

// Ruta para registrar un gasto nuevo (Añadido sucursal_id)
router.post('/registrar-gasto', async (req, res) => {
    // Recibimos la sucursal_id, si no viene, asignamos 1 por defecto
    const { concepto, monto, sucursal_id = 1 } = req.body;
    
    try {
        await pool.query(
            'INSERT INTO gastos (concepto, monto, fecha, sucursal_id) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)',
            [concepto, monto, sucursal_id]
        );
        res.json({ success: true, mensaje: "Gasto registrado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error en el servidor al guardar gasto" });
    }
});

module.exports = router;