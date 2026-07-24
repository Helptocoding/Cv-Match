# Architecture

CV Matcher is a privacy-first monorepo with a browser-based state model and a stateless FastAPI backend.

## Frontend

- Next.js App Router UI
- localStorage-backed provider configuration
- REST client to the backend

## Backend

- FastAPI REST API
- LiteLLM wrapper for provider calls
- deterministic fallbacks for tests and offline development
- PDF/DOCX/text extraction and Harvard PDF export

## Security defaults

- API keys only via headers
- no key persistence on the server
- no key logging
