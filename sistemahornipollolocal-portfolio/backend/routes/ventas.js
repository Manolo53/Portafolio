const express = require('express');
const router = express.Router();
const pool = require('../db');
const PRODUCTO_CONTROL_STOCK = process.env.STOCK_TRACKED_PRODUCT || 'Producto de ejemplo';

const { imprimirDirecto } = require('../printer/imprimirDirecto');

// =========================================================================
//  REGISTRAR VENTA
// =========================================================================

router.post('/registrar-venta', async (req, res) => {
    const { productos, total, sucursal_id, metodo_pago } = req.body;
    const metodoSeguro = metodo_pago || 'efectivo';

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const queryVenta = `
            INSERT INTO ventas (total, sucursal_id, metodo_pago, estado, fecha) 
            VALUES ($1, $2, $3, 'pagado', NOW() AT TIME ZONE 'America/Mexico_City') 
            RETURNING id;
        `;

        const resultado = await client.query(queryVenta, [total, sucursal_id, metodoSeguro]);
        const vId = resultado.rows[0].id;

        for (let p of productos) {
            await client.query(
                `INSERT INTO detalle_ventas 
                (venta_id, producto_id, cantidad, precio_final) 
                VALUES ($1, $2, $3, $4)`,
                [vId, p.id_producto || p.id, p.cantidad, p.precio]
            );

            if (p.nombre === PRODUCTO_CONTROL_STOCK) {
                await client.query(
                    `UPDATE inventario 
                     SET stock_actual = stock_actual - $1 
                     WHERE id = $2`,
                    [p.cantidad, p.id_producto || p.id]
                );
            }
        }

        await client.query('COMMIT');

        let cuerpo = '';

cuerpo += 'DEMO POS\n';
cuerpo += 'Sucursal de ejemplo\n';
cuerpo += '--------------------------------\n';
cuerpo += `FOLIO: ${vId}\n`;
cuerpo += `FECHA: ${new Date().toLocaleString('es-MX')}\n`;
cuerpo += '--------------------------------\n';
cuerpo += 'CANT PRODUCTO          IMPORTE\n';
cuerpo += '--------------------------------\n';

for (let p of productos) {
    const precio = parseFloat(p.precio) || 0;
    const cantidad = parseInt(p.cantidad) || 1;
    const subtotal = precio * cantidad;

    const cant = String(cantidad).padEnd(5, ' ');
    const nombre = String(p.nombre).substring(0, 18).padEnd(18, ' ');
    const importe = `$${subtotal.toFixed(2)}`.padStart(9, ' ');

    cuerpo += `${cant}${nombre}${importe}\n`;
}

cuerpo += '--------------------------------\n';
cuerpo += `TOTAL:${('$' + parseFloat(total).toFixed(2)).padStart(26, ' ')}\n`;
cuerpo += `PAGO: ${metodoSeguro.toUpperCase()}\n`;
cuerpo += '--------------------------------\n';
cuerpo += 'GRACIAS POR SU COMPRA\n';

        if (metodoSeguro !== 'tarjeta') {
            imprimirDirecto(cuerpo, `ticket_${vId}`);
        }

        res.json({ success: true, ventaId: vId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error al registrar venta local:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    } finally {
        client.release();
    }
});

//  CANCELAR VENTA BLOQUEADO EN LOCAL

router.delete('/eliminar-venta/:id', (req, res) => {
    return res.status(403).json({
        success: false,
        error: 'Las cancelaciones están bloqueadas en sucursal. Solicítala al administrador desde la nube.'
    });
});

//  REIMPRIMIR TICKET

router.post('/reimprimir/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const ventaRes = await pool.query(
            'SELECT total, fecha, sucursal_id, metodo_pago FROM ventas WHERE id = $1',
            [id]
        );

        if (ventaRes.rows.length === 0) {
            return res.status(404).json({ error: "Ticket no encontrado" });
        }

        const productosRes = await pool.query(`
            SELECT p.nombre, d.cantidad, d.precio_final AS precio
            FROM detalle_ventas d
            JOIN inventario p ON d.producto_id = p.id
            WHERE d.venta_id = $1
        `, [id]);


        let cuerpo = '';

        cuerpo += 'DEMO POS\n';
        cuerpo += 'Sucursal de ejemplo\n';
        cuerpo += '--------------------------------\n';
        cuerpo += '      ** REIMPRESION **\n'; 
        cuerpo += `FOLIO: ${id}\n`;
        cuerpo += `FECHA: ${new Date(ventaRes.rows[0].fecha).toLocaleString('es-MX')}\n`;
        cuerpo += '--------------------------------\n';
        cuerpo += 'CANT PRODUCTO          IMPORTE\n';
        cuerpo += '--------------------------------\n';

        for (let p of productosRes.rows) {
            const precio = parseFloat(p.precio) || 0;
            const cantidad = parseInt(p.cantidad) || 1;
            const subtotal = precio * cantidad;

            const cant = String(cantidad).padEnd(5, ' ');
            const nombre = String(p.nombre).substring(0, 18).padEnd(18, ' '); // Ajustado a 18 para que cuadre a 32 chars igual que ventas
            const importe = `$${subtotal.toFixed(2)}`.padStart(9, ' '); // Ajustado a 9

            cuerpo += `${cant}${nombre}${importe}\n`;
        }

        cuerpo += '--------------------------------\n';
        cuerpo += `TOTAL:${('$' + parseFloat(ventaRes.rows[0].total).toFixed(2)).padStart(26, ' ')}\n`;
        cuerpo += `PAGO: ${String(ventaRes.rows[0].metodo_pago || 'efectivo').toUpperCase()}\n`;
        cuerpo += '--------------------------------\n';
        cuerpo += 'GRACIAS POR SU COMPRA\n'; // Mensaje final

        imprimirDirecto(cuerpo, `reimpresion_${id}`);

        res.json({ success: true });


    } catch (err) {
        console.error("Error al reimprimir:", err);
        res.status(500).json({ error: err.message });
    }
});

//  DASHBOARD

router.get('/dashboard-hoy', async (req, res) => {
    const sucursal_id = req.query.sucursal_id || 1;
    const fechaSeleccionada = req.query.fecha || new Date().toISOString().split('T')[0];

    try {
        const resMetricas = await pool.query(`
            SELECT 
                COALESCE(SUM(total), 0) AS total_dinero, 
                COUNT(id) AS total_ventas, 
                COALESCE(AVG(total), 0) AS ticket_promedio,
                COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) AS total_efectivo,
                COALESCE(SUM(CASE WHEN metodo_pago = 'tarjeta' THEN total ELSE 0 END), 0) AS total_tarjeta,
                COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END), 0) AS total_transferencia
            FROM ventas 
            WHERE fecha::date = $2 
              AND estado = 'pagado' 
              AND sucursal_id = $1
        `, [sucursal_id, fechaSeleccionada]);

        const resGastos = await pool.query(`
            SELECT COALESCE(SUM(monto), 0) AS total_gastos 
            FROM gastos 
            WHERE fecha::date = $2 AND sucursal_id = $1
        `, [sucursal_id, fechaSeleccionada]);

        const resTop = await pool.query(`
            SELECT p.nombre, SUM(d.cantidad) AS cantidad_vendida
            FROM detalle_ventas d
            JOIN inventario p ON d.producto_id = p.id
            JOIN ventas v ON d.venta_id = v.id
            WHERE v.fecha::date = $2 
              AND v.estado = 'pagado' 
              AND v.sucursal_id = $1
            GROUP BY p.nombre 
            ORDER BY cantidad_vendida DESC 
            LIMIT 3
        `, [sucursal_id, fechaSeleccionada]);

        const resListaGastos = await pool.query(`
            SELECT concepto, monto, to_char(fecha, 'HH24:MI') AS hora
            FROM gastos 
            WHERE fecha::date = $2 AND sucursal_id = $1
            ORDER BY fecha DESC
        `, [sucursal_id, fechaSeleccionada]);

        const resMetricasMes = await pool.query(`
            SELECT COALESCE(SUM(total), 0) AS total_dinero_mes
            FROM ventas 
            WHERE EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM $2::date) 
              AND EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM $2::date) 
              AND estado = 'pagado' 
              AND sucursal_id = $1
        `, [sucursal_id, fechaSeleccionada]);

        const resGastosMes = await pool.query(`
            SELECT COALESCE(SUM(monto), 0) AS total_gastos_mes 
            FROM gastos 
            WHERE EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM $2::date) 
              AND EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM $2::date) 
              AND sucursal_id = $1
        `, [sucursal_id, fechaSeleccionada]);

        res.json({
            metricas: resMetricas.rows[0],
            totalGastos: parseFloat(resGastos.rows[0]?.total_gastos || 0),
            topProductos: resTop.rows,
            listaGastos: resListaGastos.rows,
            ventasMes: parseFloat(resMetricasMes.rows[0]?.total_dinero_mes || 0),
            gastosMes: parseFloat(resGastosMes.rows[0]?.total_gastos_mes || 0)
        });

    } catch (err) {
        console.error("🚨 ERROR EN DASHBOARD LOCAL:", err.message);
        res.status(500).json({ error: err.message });
    }
});

//  HISTORIAL

router.get('/historial-hoy', async (req, res) => {
    const sucursal_id = req.query.sucursal_id || 1;
    const fechaSeleccionada = req.query.fecha || new Date().toISOString().split('T')[0];

    try {
        const result = await pool.query(`
            SELECT id, total, to_char(fecha, 'HH24:MI:SS') AS hora, estado, metodo_pago
            FROM ventas 
            WHERE fecha::date = $2 
              AND sucursal_id = $1 
            ORDER BY id DESC
        `, [sucursal_id, fechaSeleccionada]);

        res.json(result.rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//  DETALLE TICKET

router.get('/detalle-ticket/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const detallesRes = await pool.query(`
            SELECT p.nombre, d.cantidad, d.precio_final AS precio
            FROM detalle_ventas d
            JOIN inventario p ON d.producto_id = p.id
            WHERE d.venta_id = $1
        `, [id]);

        res.json(detallesRes.rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
