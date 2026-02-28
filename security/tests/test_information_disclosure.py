"""
Test 2 — Divulgación de información

Verifica que el crawl expone versiones de software, rutas internas,
credenciales parciales y otros datos sensibles.

Hallazgos esperados:
- Versiones de WordPress, plugins y temas en el HTML
- Client ID de PayPal visible
- API REST accesible sin autenticación
- Endpoints AJAX y WC-AJAX enumerados
"""

import re
import json
import pytest
from helpers import read_file, file_exists, CRAWL_ROOT


# ──────────────────────────────────────────────
# Versiones de software expuestas
# ──────────────────────────────────────────────
class TestVersionDisclosure:
    """VULN-03: Versiones de software en parámetros ?ver=."""

    EXPECTED_VERSIONS = {
        "6.9.1": "WordPress",
        "10.4.3": "WooCommerce",
        "3.35.0": "Elementor",
        "3.17.1": "Elementor Pro",
        "3.5.5": "OceanWP",
        "3.7.1": "jQuery",
    }

    @pytest.fixture
    def index_html(self):
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        return read_file("index.html")

    @pytest.mark.parametrize("version,component", [
        ("6.9.1", "WordPress"),
        ("10.4.3", "WooCommerce"),
        ("3.35.0", "Elementor"),
        ("3.17.1", "Elementor Pro"),
        ("3.5.5", "OceanWP"),
    ])
    def test_version_exposed_in_index(self, index_html, version, component):
        """Detecta versión de {component} ({version}) en index.html."""
        pattern = rf"ver={re.escape(version)}"
        assert re.search(pattern, index_html), (
            f"No se encontró ver={version} ({component}) en index.html"
        )

    def test_jquery_version_in_login(self):
        """Detecta versión de jQuery en wp-login.php."""
        if not file_exists("wp-login.php"):
            pytest.skip("wp-login.php no encontrado")
        content = read_file("wp-login.php")
        assert "ver=3.7.1" in content, (
            "No se encontró jQuery 3.7.1 en wp-login.php"
        )

    def test_total_version_params(self):
        """Cuenta el número total de parámetros ?ver= en index.html."""
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        content = read_file("index.html")
        matches = re.findall(r"ver=[0-9][0-9.]*", content)
        # Debe haber múltiples versiones expuestas
        assert len(matches) >= 5, (
            f"Se esperaban ≥5 parámetros ver=, encontrados {len(matches)}"
        )


# ──────────────────────────────────────────────
# PayPal Client ID
# ──────────────────────────────────────────────
class TestPayPalExposure:
    """VULN-05: Client ID de PayPal visible en el HTML."""

    def test_paypal_client_id_exposed(self):
        """Detecta el Client ID de PayPal en index.html."""
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        content = read_file("index.html")
        # Buscar patrón de Client ID de PayPal
        match = re.search(r'client-id["\s:]+([A-Za-z0-9_-]{20,})', content)
        assert match is not None, "No se encontró Client ID de PayPal"
        client_id = match.group(1)
        assert len(client_id) > 20, (
            f"Client ID demasiado corto: {client_id}"
        )


# ──────────────────────────────────────────────
# API REST de WordPress
# ──────────────────────────────────────────────
class TestRESTAPIExposure:
    """VULN-06: API REST accesible públicamente."""

    def test_wp_json_index_exists(self):
        """El directorio wp-json/ está disponible en el crawl."""
        assert file_exists("wp-json/index.html"), (
            "wp-json/index.html no encontrado en el crawl"
        )

    def test_wp_v2_pages_accessible(self):
        """Endpoint /wp/v2/pages expone listado de páginas."""
        path = "wp-json/wp/v2/pages.json"
        if not file_exists(path):
            pytest.skip(f"{path} no encontrado")
        content = read_file(path)
        data = json.loads(content)
        assert isinstance(data, list), "Se esperaba una lista de páginas"
        assert len(data) > 0, "Se esperaban páginas en el endpoint"

    def test_wc_categories_accessible(self):
        """Endpoint WooCommerce /wc/store/v1/products/categories accesible."""
        path = "wp-json/wc/store/v1/products/categories.json"
        if not file_exists(path):
            pytest.skip(f"{path} no encontrado")
        content = read_file(path)
        data = json.loads(content)
        assert isinstance(data, list), "Se esperaba una lista de categorías"
        assert len(data) > 0, "Se esperaban categorías en el endpoint"

    def test_oembed_link_in_html(self):
        """El link oEmbed expone la URL de la API REST."""
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        content = read_file("index.html")
        assert "wp-json/oembed" in content, (
            "No se encontró referencia a oEmbed en index.html"
        )


# ──────────────────────────────────────────────
# Endpoints AJAX expuestos
# ──────────────────────────────────────────────
class TestAJAXEndpoints:
    """VULN-12: Endpoints AJAX y WC-AJAX enumerados."""

    EXPECTED_ENDPOINTS = [
        "ppc-simulate-cart",
        "ppc-create-order",
        "ppc-approve-order",
        "ppc-get-order",
        "ppc-validate-checkout",
        "ppc-vault-paypal",
    ]

    def test_admin_ajax_url_exposed(self):
        """admin-ajax.php URL visible en el HTML."""
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        content = read_file("index.html")
        assert "wp-admin/admin-ajax.php" in content

    @pytest.mark.parametrize("endpoint", EXPECTED_ENDPOINTS)
    def test_wc_ajax_endpoint_exposed(self, endpoint):
        """Detecta endpoint WC-AJAX '{endpoint}' en index.html."""
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        content = read_file("index.html")
        assert endpoint in content, (
            f"Endpoint {endpoint} no encontrado en index.html"
        )


# ──────────────────────────────────────────────
# Rutas internas
# ──────────────────────────────────────────────
class TestPathDisclosure:
    """Rutas internas del sitio expuestas."""

    PATHS = [
        "wp-content/plugins/",
        "wp-content/themes/oceanwp/",
        "wp-includes/",
        "wp-admin/admin-ajax.php",
    ]

    @pytest.mark.parametrize("path", PATHS)
    def test_internal_path_in_html(self, path):
        """Detecta ruta interna '{path}' en index.html."""
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        content = read_file("index.html")
        assert path in content, (
            f"Ruta {path} no encontrada en index.html"
        )
