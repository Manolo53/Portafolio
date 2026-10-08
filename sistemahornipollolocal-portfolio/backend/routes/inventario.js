const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const PRODUCTO_CONTROL_STOCK = process.env.STOCK_TRACKED_PRODUCT || 'Producto de ejemplo';

// --- 1. OBTENER LISTA PARA EL PUNTO DE VENTA (Solo Lectura) ---
router.get('/productos-lista', async (req, res) => {
    const sucursal_id = req.query.sucursal_id || 1; 

    try {
        const query = `
            SELECT 
                id, 
                nombre, 
                codigo_barras, 
                precio_sugerido AS precio, 
                tecla_acceso 
            FROM inventario 
            WHERE sucursal_id = $1
            ORDER BY id ASC
        `;
        const resultado = await pool.query(query, [sucursal_id]);
        res.json(resultado.rows);
    } catch (err) {
        console.error("Error al obtener lista de productos:", err.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

//  2. ACTUALIZAR STOCK FÍSICO LOCAL

router.post('/actualizar-stock', async (req, res) => {
    const { producto_id, cantidad_nueva, es_remplazo } = req.body;
    try {
        let query = es_remplazo 
            ? 'UPDATE inventario SET stock_actual = $1, ultima_actualizacion = CURRENT_TIMESTAMP WHERE id = $2'
            : 'UPDATE inventario SET stock_actual = stock_actual + $1, ultima_actualizacion = CURRENT_TIMESTAMP WHERE id = $2';

        await pool.query(query, [cantidad_nueva, producto_id]);
        res.status(200).json({ success: true, message: "Inventario físico local actualizado" });
    } catch (error) {
        console.error("Error al actualizar inventario:", error);
        res.status(500).json({ success: false, error: "Error de servidor" });
    }
});

// 3. VER ESTADO DEL INVENTARIO (Solo Lectura)
router.get('/estado', async (req, res) => {
    const sucursal_id = req.query.sucursal_id || 1;
    try {
        const result = await pool.query('SELECT id, nombre, stock_actual, ultima_actualizacion FROM inventario WHERE sucursal_id = $1', [sucursal_id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener stock" });
    }
});

// 4. ALERTA DE STOCK EN MOSTRADOR (Solo Lectura) 
router.get('/stock-alerta', async (req, res) => {
    const sucursal_id = req.query.sucursal_id || 1;
    try {
        const result = await pool.query(
            'SELECT stock_actual FROM inventario WHERE nombre ILIKE $1 AND sucursal_id = $2', 
            [PRODUCTO_CONTROL_STOCK, sucursal_id]
        );
        res.json({ stock: result.rows.length > 0 ? result.rows[0].stock_actual : 0 });
    } catch (error) {
        res.status(500).json({ error: "Error de servidor" });
    }
});

// 5. ACTUALIZAR PRODUCTO/PRECIO (BLOQUEADO PARA CAJEROS)
router.put('/actualizar-producto/:id', (req, res) => {
    return res.status(403).json({ 
        success: false, 
        error: "Acción denegada. Los precios y nombres del catálogo solo pueden ser modificados por el administrador desde la Nube." 
    });
});

module.exports = router;
