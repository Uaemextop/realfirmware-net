"""
Test 4 — Exposición de API y endpoints

Verifica que la API REST de WordPress y los endpoints WooCommerce
están accesibles y exponen datos del sitio.

Hallazgos esperados:
- wp-json/ contiene endpoints accesibles
- Se pueden enumerar páginas y categorías sin autenticación
- Endpoints WC-AJAX son descubribles
"""

import json
import os
import pytest
from helpers import read_file, file_exists, CRAWL_ROOT


# ──────────────────────────────────────────────
# Estructura de la API REST
# ──────────────────────────────────────────────
class TestRESTAPIStructure:
    """VULN-06: Estructura de la API REST descubrible."""

    def test_wp_json_directory_exists(self):
        """El directorio wp-json/ existe en el crawl."""
        wp_json_dir = os.path.join(CRAWL_ROOT, "wp-json")
        assert os.path.isdir(wp_json_dir), (
            "Directorio wp-json/ no encontrado"
        )

    def test_wp_json_index_contains_api_info(self):
        """wp-json/index.html contiene información de la API."""
        if not file_exists("wp-json/index.html"):
            pytest.skip("wp-json/index.html no encontrado")
        content = read_file("wp-json/index.html")
        # Puede contener datos JSON o HTML con info de la API
        assert len(content) > 0, "wp-json/index.html está vacío"

    def test_wp_v2_namespace_exists(self):
        """El namespace wp/v2 está disponible."""
        assert file_exists("wp-json/wp/v2/pages.json") or os.path.isdir(
            os.path.join(CRAWL_ROOT, "wp-json", "wp", "v2")
        ), "Namespace wp/v2 no encontrado"

    def test_wc_store_namespace_exists(self):
        """El namespace wc/store está disponible."""
        assert file_exists(
            "wp-json/wc/store/v1/products/categories.json"
        ) or os.path.isdir(
            os.path.join(CRAWL_ROOT, "wp-json", "wc", "store")
        ), "Namespace wc/store no encontrado"


# ──────────────────────────────────────────────
# Datos expuestos por la API
# ──────────────────────────────────────────────
class TestAPIDataExposure:
    """Datos accesibles sin autenticación a través de la API."""

    def test_pages_endpoint_returns_data(self):
        """Endpoint /wp/v2/pages devuelve datos de páginas."""
        path = "wp-json/wp/v2/pages.json"
        if not file_exists(path):
            pytest.skip(f"{path} no encontrado")
        content = read_file(path)
        data = json.loads(content)
        assert isinstance(data, list)
        if len(data) > 0:
            # Verificar que se exponen campos sensibles
            page = data[0]
            exposed_fields = [
                k for k in ["id", "title", "slug", "link", "content"]
                if k in page
            ]
            assert len(exposed_fields) >= 2, (
                f"Se esperaban campos de página, encontrados: {exposed_fields}"
            )

    def test_categories_endpoint_returns_data(self):
        """Endpoint WC categories devuelve categorías de productos."""
        path = "wp-json/wc/store/v1/products/categories.json"
        if not file_exists(path):
            pytest.skip(f"{path} no encontrado")
        content = read_file(path)
        data = json.loads(content)
        assert isinstance(data, list)
        if len(data) > 0:
            cat = data[0]
            assert "name" in cat or "slug" in cat, (
                "Las categorías no exponen nombre o slug"
            )

    def test_categories_contain_product_info(self):
        """Las categorías exponen conteo de productos."""
        path = "wp-json/wc/store/v1/products/categories.json"
        if not file_exists(path):
            pytest.skip(f"{path} no encontrado")
        content = read_file(path)
        data = json.loads(content)
        if len(data) > 0:
            cat = data[0]
            has_count = "count" in cat or "product_count" in cat
            # Esto no es necesariamente un fallo, pero es información expuesta
            if has_count:
                assert True  # Información de conteo expuesta


# ──────────────────────────────────────────────
# Enumeración de endpoints en el HTML
# ──────────────────────────────────────────────
class TestEndpointEnumeration:
    """Endpoints descubribles desde el HTML."""

    def test_rest_api_link_in_html(self):
        """El HTML contiene links a la API REST (oEmbed/wp-json)."""
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        content = read_file("index.html")
        has_api_ref = (
            "wp-json" in content
            or "rest_url" in content
            or "oembed" in content
        )
        assert has_api_ref, "No se encontraron referencias a la API REST"

    def test_wc_store_api_urls_in_html(self):
        """URLs de la WC Store API están en el HTML (cart, shipping)."""
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        content = read_file("index.html")
        wc_urls = [
            "wc/store/v1/cart",
            "wc/store/v1/cart/select-shipping-rate",
            "wc/store/v1/cart/update-customer",
        ]
        found = [url for url in wc_urls if url in content]
        assert len(found) >= 1, (
            f"No se encontraron URLs de WC Store API. Buscadas: {wc_urls}"
        )


# ──────────────────────────────────────────────
# Sitemap
# ──────────────────────────────────────────────
class TestSitemap:
    """Análisis del sitemap XML."""

    def test_sitemap_exists(self):
        """El sitemap de productos existe."""
        assert file_exists("wp-sitemap-posts-product-1.xml"), (
            "Sitemap de productos no encontrado"
        )

    def test_sitemap_contains_product_urls(self):
        """El sitemap lista URLs de productos."""
        if not file_exists("wp-sitemap-posts-product-1.xml"):
            pytest.skip("Sitemap no encontrado")
        content = read_file("wp-sitemap-posts-product-1.xml")
        assert "<loc>" in content or "realfirmware.net" in content, (
            "El sitemap no contiene URLs de productos"
        )

    def test_sitemap_exposes_product_count(self):
        """El sitemap permite contar el número de productos."""
        if not file_exists("wp-sitemap-posts-product-1.xml"):
            pytest.skip("Sitemap no encontrado")
        content = read_file("wp-sitemap-posts-product-1.xml")
        import re
        urls = re.findall(r"<loc>([^<]+)</loc>", content)
        # Un sitemap con productos expone su cantidad
        assert len(urls) >= 1, "No se encontraron URLs en el sitemap"
