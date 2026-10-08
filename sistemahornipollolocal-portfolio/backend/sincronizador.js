const pool = require('./db');
const axios = require('axios');

// CONFIGURACIÓN DESDE .env
const SUCURSAL_ID = Number(process.env.SUCURSAL_ID || 1);
const PRODUCTO_CONTROL_STOCK = process.env.STOCK_TRACKED_PRODUCT || 'Producto de ejemplo';
const TOKEN = process.env.SYNC_TOKEN;
const BASE_URL_NUBE = process.env.BASE_URL_NUBE || '';
const INTERVALO_SYNC_MS = Number(process.env.INTERVALO_SYNC_MS || 60000);

if (!TOKEN || !BASE_URL_NUBE) {
    console.log('Sincronización desactivada: configura SYNC_TOKEN y BASE_URL_NUBE para habilitarla.');
}

async function ejecutarSincronizacionEcosistema() {
    if (!TOKEN || !BASE_URL_NUBE) return;

    const client = await pool.connect();

    try {
        // FASE 1: SUBIR VENTAS LOCALES A LA NUBE
        const queryVentas = `
            SELECT id, total, sucursal_id, metodo_pago, estado,
                   to_char(fecha, 'YYYY-MM-DD HH24:MI:SS') AS fecha
            FROM ventas
            WHERE sincronizado = FALSE
            LIMIT 50;
        `;

        const resVentas = await client.query(queryVentas);

        if (resVentas.rows.length > 0) {
            const ventasPendientes = resVentas.rows;
            const idsVentas = ventasPendientes.map(v => v.id);

            const queryDetalles = `
                SELECT venta_id, producto_id, cantidad, precio_final
                FROM detalle_ventas
                WHERE venta_id = ANY($1);
            `;

            const resDetalles = await client.query(queryDetalles, [idsVentas]);
            const detallesPendientes = resDetalles.rows;

            const respuestaSubida = await axios.post(
                `${BASE_URL_NUBE}/sincronizar-ventas`,
                {
                    ventas: ventasPendientes,
                    detalles: detallesPendientes,
                    token_seguridad: TOKEN
                },
                { timeout: 10000 }
            );

            if (respuestaSubida.data.success) {
                await client.query('BEGIN');

                await client.query(
                    `UPDATE ventas SET sincronizado = TRUE WHERE id = ANY($1)`,
                    [idsVentas]
                );

                await client.query('COMMIT');

                console.log(
                    `[Sincronizador] ✅ ${ventasPendientes.length} ventas subidas ` +
                    `(Folios: ${idsVentas[0]} al ${idsVentas[idsVentas.length - 1]})`
                );
            }
        }

        // FASE 2: DESCARGAR ÓRDENES DE CANCELACIÓN
        const respuestaOrdenes = await axios.get(
            `${BASE_URL_NUBE}/obtener-ordenes-pendientes`,
            {
                params: {
                    sucursal_id: SUCURSAL_ID,
                    token_seguridad: TOKEN
                },
                timeout: 10000
            }
        );

        const ordenes = Array.isArray(respuestaOrdenes.data)
            ? respuestaOrdenes.data
            : [];

        for (let orden of ordenes) {
            if (orden.tipo_accion !== 'CANCELAR_VENTA') continue;

            const { venta_id } = orden.datos || {};
            if (!venta_id) continue;

            try {
                await client.query('BEGIN');

                const checkVenta = await client.query(
                    'SELECT estado FROM ventas WHERE id = $1',
                    [venta_id]
                );

                if (checkVenta.rows.length > 0 && checkVenta.rows[0].estado !== 'cancelado') {
                    const detalles = await client.query(`
                        SELECT d.producto_id, d.cantidad, i.nombre
                        FROM detalle_ventas d
                        JOIN inventario i ON d.producto_id = i.id
                        WHERE d.venta_id = $1
                    `, [venta_id]);

                    for (let prod of detalles.rows) {
                        if (prod.nombre === PRODUCTO_CONTROL_STOCK) {
                            await client.query(
                                `UPDATE inventario
                                 SET stock_actual = stock_actual + $1
                                 WHERE id = $2`,
                                [prod.cantidad, prod.producto_id]
                            );
                        }
                    }

                    await client.query(
                        `UPDATE ventas
                         SET estado = 'cancelado', sincronizado = TRUE
                         WHERE id = $1`,
                        [venta_id]
                    );

                    console.log(`[Sincronizador] ⚠️ Venta #${venta_id} anulada por orden remota.`);
                }

                await client.query('COMMIT');

                await axios.post(
                    `${BASE_URL_NUBE}/marcar-orden-procesada`,
                    {
                        orden_id: orden.id,
                        token_seguridad: TOKEN
                    },
                    { timeout: 10000 }
                );

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[Sincronizador] Error procesando orden ${orden.id}:`, error.message);
            }
        }

    } catch (error) {
        if (
            error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNABORTED'
        ) {
            console.log('[Sincronizador] 📡 Sin conexión con la nube...');
        } else {
            console.error('🚨 Error interno en el Sincronizador:', error.message || error);
        }
    } finally {
        client.release();
    }
}

setInterval(ejecutarSincronizacionEcosistema, INTERVALO_SYNC_MS);

// Ejecuta una vez al arrancar
setTimeout(ejecutarSincronizacionEcosistema, 5000);

module.exports = { ejecutarSincronizacionEcosistema };
