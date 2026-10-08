# Sistema POS e inventario

Aplicación de punto de venta con una interfaz web y una API local en Node.js. Permite registrar ventas, consultar inventario, registrar gastos e imprimir tickets.

> Proyecto de portafolio. Usa datos ficticios y no incluye credenciales ni conexión a un servidor remoto.

## Funcionalidades

- Registro de ventas y detalle de productos.
- Consulta y actualización de existencias.
- Registro de gastos por sucursal.
- Impresión local de tickets.
- Consulta del estado de PostgreSQL.
- Sincronización remota opcional, desactivada por defecto.
- Interfaz en español adaptable a pantallas pequeñas.

## Tecnologías

- Node.js y Express
- PostgreSQL
- JavaScript, HTML y CSS
- Axios y dotenv
- CUPS para impresión local opcional

## Estructura del proyecto

```text
sistemahornipollolocal-portfolio/
├── backend/
│   ├── printer/
│   ├── routes/
│   ├── db.js
│   ├── server.js
│   └── sincronizador.js
├── frontend/
│   ├── config.js
│   ├── index.html
│   └── style.css
├── package.json
└── package-lock.json
```

## Requisitos

- Node.js y npm
- PostgreSQL
- Una base de datos con las tablas que utiliza la aplicación (`ventas`, `detalle_ventas`, `inventario` y `gastos`)

El proyecto no incluye un esquema SQL ni datos de ejemplo. La impresión requiere CUPS y una impresora configurada.

## Instalación local

1. Clona el repositorio:

   ```bash
   git clone https://github.com/Manolo53/portafolio-SistemaHornipollo.git
   ```

2. Entra en la carpeta del proyecto e instala las dependencias:

   ```bash
   cd portafolio-SistemaHornipollo/sistemahornipollolocal-portfolio
   npm install
   ```

3. Copia `.env.example` como `.env` y completa la configuración de tu PostgreSQL local. Usa datos ficticios para pruebas y no subas `.env` a GitHub.

4. Inicia el servidor:

   ```bash
   npm start
   ```

5. Abre `http://localhost:3000` en tu navegador.

## Configuración opcional

La sincronización remota está desactivada por defecto. Para probarla, configura una URL de demostración autorizada y un token de prueba en tu archivo `.env`, y define la URL del servidor en `frontend/config.js`.

Para usar la impresora, configura `PRINTER_NAME` con el nombre que reconoce CUPS.
