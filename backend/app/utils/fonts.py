from __future__ import annotations

from dataclasses import dataclass


FONT_PACKAGES: dict[str, str] = {
    "serif": "fonts-liberation",
    "garamond": "fonts-ebgaramond",
    "noto": "fonts-noto-core",
    "carlito": "fonts-crosextra-carlito",
}


DEFAULT_FONT = "serif"


@dataclass(frozen=True)
class FontOption:
    key: str
    label: str
    css_family: str


FONT_CHOICES: dict[str, FontOption] = {
    "serif": FontOption(
        key="serif",
        label="Liberation Serif",
        css_family="'Liberation Serif', 'Times New Roman', serif",
    ),
    "garamond": FontOption(
        key="garamond",
        label="EB Garamond",
        css_family="'EB Garamond', Garamond, serif",
    ),
    "noto": FontOption(
        key="noto",
        label="Noto Serif",
        css_family="'Noto Serif', serif",
    ),
    "carlito": FontOption(
        key="carlito",
        label="Carlito",
        css_family="'Carlito', Calibri, sans-serif",
    ),
}


def resolve_font(font_key: str) -> FontOption:
    return FONT_CHOICES.get(font_key, FONT_CHOICES[DEFAULT_FONT])
