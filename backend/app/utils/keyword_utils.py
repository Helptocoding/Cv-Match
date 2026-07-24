ALIASES = {
    "js": "javascript",
    "ts": "typescript",
    "nextjs": "next.js",
    "postgres": "postgresql",
}


def normalize_keyword(keyword: str) -> str:
    normalized = keyword.strip().lower()
    return ALIASES.get(normalized, normalized)


def normalize_keywords(keywords: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized_keywords: list[str] = []
    for keyword in keywords:
        normalized = normalize_keyword(keyword)
        if normalized and normalized not in seen:
            seen.add(normalized)
            normalized_keywords.append(normalized)
    return normalized_keywords
