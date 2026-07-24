# Contributing

## Setup

1. Copy `.env.example` values if needed.
2. Start backend and frontend locally or with Docker.
3. Keep prompts in `backend/app/prompts/` instead of hardcoding prompt text.

## Guidelines

- preserve BYOK privacy guarantees
- do not log or persist provider keys
- keep parsing and scoring logic covered with tests
- prefer extending existing services over duplicating logic

## Pull requests

- explain user-facing changes
- include screenshots for UI changes when relevant
- document new environment variables in `README.md`
