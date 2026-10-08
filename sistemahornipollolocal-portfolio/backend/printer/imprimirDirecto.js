const { execFile } = require('child_process');

const PRINTER_NAME = process.env.PRINTER_NAME || 'POS-Printer';

function limpiarTexto(txt) {
    return String(txt)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x00-\x7F]/g, '');
}

function imprimirDirecto(contenido) {
    const limpio = limpiarTexto(contenido);

    const INIT = Buffer.from([0x1B, 0x40]);
    const MARGIN_LEFT = Buffer.from([0x1D, 0x4C, 0x00, 0x00]);
    const ALIGN_LEFT = Buffer.from([0x1B, 0x61, 0x00]);
    const FONT_NORMAL = Buffer.from([0x1B, 0x21, 0x00]);
    const FEED_CUT = Buffer.from([0x1B, 0x64, 0x03]);
    const CUT = Buffer.from([0x1D, 0x56, 0x00]);

    const datos = Buffer.concat([
        INIT,
        MARGIN_LEFT,
        ALIGN_LEFT,
        FONT_NORMAL,
        Buffer.from(limpio, 'ascii'),
        Buffer.from('\n\n', 'ascii'),
        FEED_CUT,
        CUT
    ]);

    const lp = execFile(
        'lp',
        ['-d', PRINTER_NAME, '-o', 'raw'],
        (error, stdout, stderr) => {
            if (error) {
                console.error('❌ ERROR LP:', error.message);
                console.error('STDERR:', stderr);
                return;
            }

            console.log('✅ Ticket enviado:', stdout.trim());
        }
    );

    lp.stdin.write(datos);
    lp.stdin.end();
}

module.exports = { imprimirDirecto, limpiarTexto };
