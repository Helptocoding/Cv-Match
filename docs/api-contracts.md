# API Contracts

## Headers

- `X-AI-Provider`: provider slug such as `openai` or `anthropic`
- `X-AI-Model`: model name such as `gpt-4o-mini`
- `X-Provider-Api-Key`: user-provided API key

## Core endpoints

- `POST /api/v1/parse/cv`
- `POST /api/v1/parse/job`
- `POST /api/v1/score/match`
- `POST /api/v1/adapt/cv`
- `POST /api/v1/export/pdf`
