# Despliegue gratuito: Vercel + Render

Combo recomendado 100% $0 para este repo (sin DB).

## 1. Backend en Render (Free)

1. Sube esta rama a GitHub.
2. En https://dashboard.render.com -> New -> Web Service -> selecciona tu repo/rama `chore/deploy-free-hosting`.
3. Render detecta `render.yaml`: runtime Docker, `healthCheckPath: /api/v1/health`.
4. Variables:
   - `BACKEND_CORS_ORIGINS=https://tu-app.vercel.app,http://localhost:3000`
5. Deploy. Obtendras: `https://cv-matcher-backend.onrender.com`
6. Verifica: `https://tu-backend.onrender.com/api/v1/health` -> `{"status":"ok"}`

Notas Free:
- 750h/mes = 1 servicio siempre encendido.
- Se duerme a los 15min sin trafico, despierta en 30-60s.
- No necesitas Postgres Free (el estado es local en navegador).

## 2. Frontend en Vercel (Hobby)

1. En https://vercel.com -> New Project -> importa repo.
2. Root Directory: `frontend`
3. Framework: Next.js (auto).
4. Env var:
   - `NEXT_PUBLIC_API_BASE_URL=https://tu-backend.onrender.com/api/v1`
5. Deploy. Obtendras: `https://tu-app.vercel.app`

> Vercel Hobby es gratis pero no comercial. Para uso comercial o bandwidth ilimitado usa Cloudflare Pages.

## 3. Conectar ambos

1. Vuelve a Render y actualiza `BACKEND_CORS_ORIGINS` con tu URL real de Vercel.
2. En Vercel haz Redeploy (porque `NEXT_PUBLIC_*` se incrusta en build).

## Local sigue igual

```bash
docker compose up --build
# frontend http://localhost:3000, backend http://localhost:8000/docs
```
