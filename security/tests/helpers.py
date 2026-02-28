"""Utilidades comunes para los tests de seguridad."""

import json
import os

CRAWL_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)
)


def read_file(relative_path: str) -> str:
    """Lee un archivo relativo a la raíz del crawl."""
    full_path = os.path.join(CRAWL_ROOT, relative_path)
    with open(full_path, encoding="utf-8", errors="replace") as f:
        return f.read()


def parse_headers(header_text: str) -> dict[str, list[str]]:
    """Parsea un archivo .headers (JSON) y devuelve un dict con los
    nombres de cabecera en minúsculas como claves y listas de valores."""
    data = json.loads(header_text)
    raw = data.get("headers", {})
    headers: dict[str, list[str]] = {}
    for name, value in raw.items():
        headers.setdefault(name.lower(), []).append(value)
    return headers


def file_exists(relative_path: str) -> bool:
    """Comprueba si un archivo existe en el crawl."""
    return os.path.isfile(os.path.join(CRAWL_ROOT, relative_path))
