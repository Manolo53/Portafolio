# Sistema POS e inventario

Aplicación de punto de venta con interfaz web y una API local en Node.js. El proyecto incluye registro de ventas, consulta de inventario, registro de gastos, impresión de tickets y una opción de sincronización con un servidor remoto.


## Funcionalidades

- Registro de ventas y detalle de productos.
- Actualización y consulta de existencias.
- Registro de gastos.
- Impresión local de tickets compatibles con CUPS (`lp`).
- Consulta del estado de PostgreSQL y del servidor remoto.
- Sincronización opcional de ventas y órdenes de cancelación.
- Interfaz en español adaptable a pantallas pequeñas.

## Tecnologías

- Node.js y Express
- PostgreSQL (`pg`)
- HTML, CSS y JavaScript
- Axios y dotenv
- CUPS para impresión local opcional

## Requisitos

- Node.js y npm instalados.
- Una instancia local de PostgreSQL.
- CUPS y una impresora configurada solo si deseas probar la impresión.

## Configuración local

1. Clona o descarga el repositorio.
2. En la carpeta del proyecto, instala dependencias con `npm install`.
3. Copia `.env.example` como `.env` y completa los datos de tu PostgreSQL local. Usa contraseñas y tokens de prueba.
4. Prepara en PostgreSQL el esquema que requiere la aplicación.
5. Cambia `STOCK_TRACKED_PRODUCT` en `.env` al nombre del producto ficticio al que quieres aplicar el ajuste de existencias.
6. Si tienes un servidor maestro de demostración autorizado, completa `BASE_URL_NUBE` y `API_NUBE` en `.env`, y coloca su URL base en `frontend/config.js`. Si no lo tienes, deja estos valores vacíos; las funciones locales siguen usando la API del mismo servidor.
7. Para la impresora, configura `PRINTER_NAME` con el nombre local que reconoce CUPS.
8. Inicia el servidor con `npm start` y abre `http://localhost:3000`.

## Estructura

```text
backend/
  routes/              Rutas de ventas, gastos e inventario
  printer/             Impresión local opcional
  db.js                Conexión a PostgreSQL
  server.js            Servidor Express y archivos estáticos
  sincronizador.js     Sincronización remota opcional
frontend/
  index.html            Interfaz principal
  config.js             URL pública opcional del servidor maestro
  style.css             Estilos
.env.example            Plantilla de configuración local
```


