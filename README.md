# CV Matcher

CV Matcher is an open source BYOK web app that compares a CV against a job description, explains the match score, suggests a tailored version of the CV, and exports a polished result.

## What is included

- `frontend/`: Next.js 14 App Router, TypeScript, Tailwind CSS
- `backend/`: FastAPI service with parsing, scoring, adaptation, and export endpoints
- `docker-compose.yml`: one-command local startup
- no database by default; state stays in the browser

## Privacy model

- users provide their own provider API key in the browser
- keys are sent to the backend only through headers
- the backend does not persist or log API keys
- local browser storage can persist the key, or users can clear it between sessions

## MVP flow

1. Upload CV as PDF/DOCX or paste plain text
2. Paste a job description
3. Choose provider, model, and API key
4. Parse both documents into structured JSON
5. Calculate weighted match scores by category
6. Generate an adapted CV draft without inventing experience
7. Export a Harvard-style PDF

## Local development

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

Frontend runs on `http://localhost:3000` and backend docs on `http://localhost:8000/docs`.

## Tests

```bash
cd backend
pytest
```

## Frontend build

```bash
cd frontend
npm ci
npm run build
```

## LLM providers

The backend uses LiteLLM as a unified provider abstraction. If a provider call fails, returns invalid JSON, or no key is supplied, the current MVP falls back to deterministic heuristics and returns processing warnings in the API response metadata.

## PDF export

The Harvard export path renders an HTML/CSS template to PDF with `xhtml2pdf`, and falls back to a simpler reportlab renderer if HTML rendering fails.

## Additional exports

- DOCX export is generated with `python-docx`
- Markdown export is generated directly from the adapted CV structure

## Contributing

See `CONTRIBUTING.md`.
