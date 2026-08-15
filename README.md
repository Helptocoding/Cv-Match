# CV Matcher

CV Matcher es una aplicación web de código abierto (BYOK) que compara un CV con una descripción de puesto, explica la puntuación de coincidencia, sugiere una versión adaptada del CV y exporta un resultado pulido.

## Qué incluye

- `frontend/`: Next.js 14 App Router, TypeScript, Tailwind CSS
- `backend/`: servicio FastAPI con endpoints para parseo, puntuación, adaptación y exportación
- `docker-compose.yml`: arranque local con un solo comando
- sin base de datos por defecto; el estado se mantiene en el navegador

## Modelo de privacidad

- el usuario proporciona su propia clave API del proveedor en el navegador
- las claves se envían al backend solo mediante cabeceras
- el backend no persiste ni registra las claves API
- el almacenamiento local del navegador puede guardar la clave, o el usuario puede borrarla entre sesiones
- el seguimiento de aplicaciones también es local en el navegador; nunca almacena claves de proveedor ni sube datos al servidor

## Flujo MVP

1. Subir CV como PDF/DOCX o pegar texto plano
2. Pegar la descripción del puesto
3. Seleccionar proveedor, modelo y clave API
4. Parsear ambos documentos a JSON estructurado
5. Calcular puntuaciones de coincidencia ponderadas por categoría
6. Generar un borrador adaptado del CV sin inventar experiencias
7. Exportar un PDF con formato Harvard
8. Revisar una checklist ATS accionable y guardar cada candidatura localmente con estado, notas y siguiente acción

## Desarrollo local

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Docker

```bash
docker compose up --build
```

El frontend se sirve en `http://localhost:3000` y la documentación del backend en `http://localhost:8000/docs`.

## Tests

```bash
cd backend
pytest
```

## Build del frontend

```bash
cd frontend
npm ci
npm run build
```

## Proveedores LLM

El backend utiliza LiteLLM como abstracción unificada para proveedores. Si una llamada al proveedor falla, devuelve JSON inválido o no se proporciona clave, el MVP actual recurre a heurísticos deterministas y devuelve advertencias de procesamiento en la metadata de la respuesta API.

## Exportación a PDF

La ruta de exportación Harvard renderiza una plantilla HTML/CSS a PDF con `xhtml2pdf`, y en caso de fallo usa un renderizador más simple con `reportlab`.

## Exportaciones adicionales

- La exportación DOCX se genera con `python-docx`
- La exportación Markdown se genera directamente desde la estructura del CV adaptado

## Contribuciones

Ver `CONTRIBUTING.md`.

by: felipddiazz
