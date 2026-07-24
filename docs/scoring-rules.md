# Scoring Rules

Default weights:

- skills: 35
- experience: 30
- education: 15
- keywords_ats: 20

Each category returns:

- `score`
- `matched`
- `missing`
- `notes`

The engine normalizes common aliases such as `js` to `javascript` and `postgres` to `postgresql` before comparing terms.
