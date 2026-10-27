# Virtual Challenge - Frontend

Aplicación web de Virtual Challenge para estudiantes, docentes y administradores. Permite gestionar espacios académicos, realizar conversaciones orales con un asistente de IA y consultar los resultados e intentos registrados.

Este repositorio contiene únicamente la interfaz web. La autenticación, los datos y las operaciones de evaluación dependen del [backend](https://github.com/harrysoler/ai_conversational_evaluator_backend).

## Funcionalidades

- Acceso según el perfil de estudiante, docente o administrador.
- Gestión y consulta de programas, espacios académicos y asignaciones.
- Experiencia de Live Talk para estudiantes.
- Consulta de resultados e historial de intentos.
- Comunicación con el backend mediante su API HTTP.

## Tecnologías

- React 19 y TypeScript.
- Vite 8.
- TanStack AI para la experiencia conversacional.
- Axios para las solicitudes HTTP.
- Better Auth para los flujos de autenticación de la aplicación.

## Requisitos

- Node.js 20.19 o posterior, o 22.12 o posterior, según los requisitos de Vite. Consulta la [guía oficial de Vite](https://vite.dev/guide/).
- npm.
- El backend en ejecución y una base de datos configurada para usar todas las funciones de la aplicación.

## Puesta en marcha

### 1. Instalar dependencias

Desde la raíz de este repositorio:

```bash
npm install
```

### 2. Configurar el backend de la aplicación

Crea un archivo local `.env.development` a partir del ejemplo:

```bash
cp .env.development.example .env.development
```

La variable disponible es:

| Variable | Descripción | Valor local sugerido |
| --- | --- | --- |
| `VITE_BACKEND_URL` | URL base de la API del backend | `http://localhost:8000/api` |

Las variables con prefijo `VITE_` quedan disponibles en el navegador. No guardes claves privadas, como una clave de OpenAI, en este archivo.

### 3. Iniciar la aplicación

```bash
npm run dev
```

Vite muestra en la terminal la dirección local, normalmente `http://localhost:5173`. Mantén este proceso activo mientras trabajas.

### 4. Ejecutar backend y frontend juntos

En otra terminal, inicia el backend siguiendo su [guía de instalación](https://github.com/harrysoler/ai_conversational_evaluator_backend#puesta-en-marcha). Si el frontend corre en un puerto distinto de `5173`, configura ese origen también en las variables de CORS del backend.

Las cuentas institucionales importadas ingresan con su correo y, solo para el primer acceso, el número de documento como contraseña temporal. La aplicación exige reemplazarla antes de abrir los módulos.

## Comandos disponibles

```bash
npm run dev      # servidor de desarrollo
npm run build    # verificación de TypeScript y compilación de producción
npm run lint     # análisis estático
npm run preview  # vista previa local de la compilación
```

## Compilación de producción

```bash
npm run build
npm run preview
```

La compilación se genera en `dist/`. Configura `VITE_BACKEND_URL` para el entorno donde se publique la aplicación y sirve los archivos de `dist/` desde un servidor web compatible con aplicaciones de una sola página.

## Estructura del proyecto

```text
src/
├── assets/      recursos gráficos
├── components/  componentes reutilizables
├── lib/         utilidades e integración con servicios
└── ...          vistas y composición de la aplicación
```

## Repositorios relacionados

- [Backend de Virtual Challenge](https://github.com/harrysoler/ai_conversational_evaluator_backend)

