"""
Test 1 — Cabeceras de seguridad HTTP

Verifica que las respuestas del crawl incluyen las cabeceras de
seguridad recomendadas (OWASP Secure Headers Project).

Hallazgos esperados:
- HSTS ausente en todas las respuestas
- CSP ausente en páginas públicas
- X-Frame-Options ausente en páginas públicas
- Referrer-Policy ausente en páginas públicas
- Server disclosure (nginx)
"""

import pytest
from helpers import parse_headers, read_file, file_exists

# ──────────────────────────────────────────────
# Archivos de cabeceras disponibles en el crawl
# ──────────────────────────────────────────────
HEADER_FILES = [
    "index.html.headers",
    "wp-login.php.headers",
    "wp-links-opml.php.headers",
    "wp-sitemap-posts-product-1.xml.headers",
]


@pytest.fixture(params=HEADER_FILES, ids=HEADER_FILES)
def headers(request):
    """Devuelve las cabeceras parseadas de cada archivo .headers."""
    path = request.param
    if not file_exists(path):
        pytest.skip(f"{path} no encontrado en el crawl")
    return path, parse_headers(read_file(path))


# ──────────────────────────────────────────────
# HSTS — Strict-Transport-Security
# ──────────────────────────────────────────────
class TestHSTS:
    """Verifica la presencia de Strict-Transport-Security."""

    def test_hsts_missing(self, headers):
        """VULN-01: Ningún archivo tiene cabecera HSTS."""
        path, h = headers
        assert "strict-transport-security" not in h, (
            f"{path} tiene HSTS — verificar si se añadió recientemente"
        )


# ──────────────────────────────────────────────
# Content-Security-Policy
# ──────────────────────────────────────────────
class TestCSP:
    """Verifica Content-Security-Policy."""

    def test_login_has_csp(self):
        """wp-login.php SÍ tiene CSP (frame-ancestors)."""
        if not file_exists("wp-login.php.headers"):
            pytest.skip("wp-login.php.headers no encontrado")
        h = parse_headers(read_file("wp-login.php.headers"))
        assert "content-security-policy" in h
        assert any("frame-ancestors" in v for v in h["content-security-policy"])

    @pytest.mark.parametrize("path", [
        "index.html.headers",
        "wp-links-opml.php.headers",
        "wp-sitemap-posts-product-1.xml.headers",
    ])
    def test_public_pages_missing_csp(self, path):
        """VULN-02: Páginas públicas NO tienen CSP."""
        if not file_exists(path):
            pytest.skip(f"{path} no encontrado")
        h = parse_headers(read_file(path))
        assert "content-security-policy" not in h, (
            f"{path} tiene CSP — verificar"
        )


# ──────────────────────────────────────────────
# X-Frame-Options
# ──────────────────────────────────────────────
class TestXFrameOptions:
    """Verifica protección anti-clickjacking."""

    def test_login_has_xframe(self):
        """wp-login.php tiene X-Frame-Options: SAMEORIGIN."""
        if not file_exists("wp-login.php.headers"):
            pytest.skip("wp-login.php.headers no encontrado")
        h = parse_headers(read_file("wp-login.php.headers"))
        assert "x-frame-options" in h
        assert any("SAMEORIGIN" in v for v in h["x-frame-options"])

    @pytest.mark.parametrize("path", [
        "index.html.headers",
        "wp-links-opml.php.headers",
    ])
    def test_public_pages_missing_xframe(self, path):
        """VULN-07: Páginas públicas NO tienen X-Frame-Options."""
        if not file_exists(path):
            pytest.skip(f"{path} no encontrado")
        h = parse_headers(read_file(path))
        assert "x-frame-options" not in h


# ──────────────────────────────────────────────
# Referrer-Policy
# ──────────────────────────────────────────────
class TestReferrerPolicy:
    """Verifica Referrer-Policy."""

    def test_login_has_referrer_policy(self):
        """wp-login.php tiene Referrer-Policy."""
        if not file_exists("wp-login.php.headers"):
            pytest.skip("wp-login.php.headers no encontrado")
        h = parse_headers(read_file("wp-login.php.headers"))
        assert "referrer-policy" in h

    @pytest.mark.parametrize("path", [
        "index.html.headers",
        "wp-links-opml.php.headers",
    ])
    def test_public_missing_referrer_policy(self, path):
        """VULN-09: Páginas públicas NO tienen Referrer-Policy."""
        if not file_exists(path):
            pytest.skip(f"{path} no encontrado")
        h = parse_headers(read_file(path))
        assert "referrer-policy" not in h


# ──────────────────────────────────────────────
# Server Disclosure
# ──────────────────────────────────────────────
class TestServerDisclosure:
    """Verifica divulgación del servidor."""

    def test_server_header_discloses_nginx(self, headers):
        """VULN-08: La cabecera Server revela 'nginx'."""
        path, h = headers
        if "server" not in h:
            pytest.skip(f"{path} no tiene cabecera Server")
        assert any("nginx" in v.lower() for v in h["server"]), (
            f"{path}: Se esperaba 'nginx' en Server header"
        )


# ──────────────────────────────────────────────
# X-Content-Type-Options
# ──────────────────────────────────────────────
class TestXContentTypeOptions:
    """Verifica X-Content-Type-Options."""

    def test_present_in_index(self):
        """index.html SÍ tiene X-Content-Type-Options: nosniff."""
        if not file_exists("index.html.headers"):
            pytest.skip("index.html.headers no encontrado")
        h = parse_headers(read_file("index.html.headers"))
        assert "x-content-type-options" in h
        assert any("nosniff" in v for v in h["x-content-type-options"])

    def test_missing_in_opml(self):
        """VULN-11: wp-links-opml.php NO tiene X-Content-Type-Options."""
        if not file_exists("wp-links-opml.php.headers"):
            pytest.skip("wp-links-opml.php.headers no encontrado")
        h = parse_headers(read_file("wp-links-opml.php.headers"))
        assert "x-content-type-options" not in h


# ──────────────────────────────────────────────
# Cookie Security
# ──────────────────────────────────────────────
class TestCookieSecurity:
    """Verifica atributos de seguridad en cookies."""

    def test_login_cookie_missing_samesite(self):
        """VULN-10: Cookie wordpress_test_cookie no tiene SameSite."""
        if not file_exists("wp-login.php.headers"):
            pytest.skip("wp-login.php.headers no encontrado")
        raw = read_file("wp-login.php.headers")
        h = parse_headers(raw)
        if "set-cookie" not in h:
            pytest.skip("No hay Set-Cookie en wp-login.php.headers")

        for cookie_val in h["set-cookie"]:
            if "wordpress_test_cookie" in cookie_val:
                assert "samesite" not in cookie_val.lower(), (
                    "Cookie ahora tiene SameSite — verificar"
                )
                return

        pytest.skip("Cookie wordpress_test_cookie no encontrada")
