"""
Test 3 — Formularios y Tokens de seguridad

Verifica la exposición de nonces, formularios sin protección CSRF
adecuada, y tokens de seguridad visibles en el HTML del crawl.

Hallazgos esperados:
- Múltiples nonces de WordPress expuestos en HTML
- Formulario de login con redirect URL visible
- Formularios WooCommerce con protección parcial
"""

import re
import pytest
from helpers import read_file, file_exists


# ──────────────────────────────────────────────
# Nonces expuestos
# ──────────────────────────────────────────────
class TestNonceExposure:
    """VULN-04: Nonces y tokens de seguridad expuestos en HTML."""

    EXPECTED_NONCES = [
        ("4a378838aa", "welcomebar ajax_nonce"),
        ("922a58d6da", "PayPal gateway nonce"),
        ("d339bff5ff", "Wishlist nonce"),
        ("5f0786a075", "OceanWP nonce"),
        ("cabc64c34d", "OceanWP wpnonce"),
        ("8dd6dfc15b", "WC Store REST API nonce"),
        ("45a9cc08c0", "Premium Settings nonce"),
        ("450ba2d88b", "Elementor Pro nonce"),
    ]

    @pytest.fixture
    def index_html(self):
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        return read_file("index.html")

    @pytest.mark.parametrize("nonce,description", EXPECTED_NONCES)
    def test_nonce_visible_in_html(self, index_html, nonce, description):
        """Detecta nonce '{nonce}' ({description}) en index.html."""
        assert nonce in index_html, (
            f"Nonce {nonce} ({description}) no encontrado en index.html"
        )

    def test_total_nonces_count(self, index_html):
        """Cuenta el número total de nonces hexadecimales expuestos."""
        # Patrón: "nonce":"<10 caracteres hex>"
        nonces = re.findall(r'nonce["\s:]+["\']([a-f0-9]{8,12})["\']', index_html)
        assert len(nonces) >= 5, (
            f"Se esperaban ≥5 nonces, encontrados {len(nonces)}: {nonces}"
        )

    def test_paypal_nonces_exposed(self, index_html):
        """Detecta nonces específicos de PayPal WC-AJAX."""
        paypal_nonces = [
            "d92bdd9bd4",  # simulate_cart
            "8c2c059bd3",  # create_order
            "866ad58a05",  # approve_order
        ]
        found = [n for n in paypal_nonces if n in index_html]
        assert len(found) >= 2, (
            f"Se esperaban ≥2 nonces PayPal, encontrados: {found}"
        )


# ──────────────────────────────────────────────
# Formulario de login
# ──────────────────────────────────────────────
class TestLoginForm:
    """Análisis del formulario de login en wp-login.php."""

    @pytest.fixture
    def login_html(self):
        if not file_exists("wp-login.php"):
            pytest.skip("wp-login.php no encontrado")
        return read_file("wp-login.php")

    def test_login_form_present(self, login_html):
        """El formulario de login existe."""
        assert "<form" in login_html
        assert 'name="loginform"' in login_html or "loginform" in login_html

    def test_login_redirect_url_exposed(self, login_html):
        """La URL de redirección post-login es visible."""
        assert "wp-admin" in login_html, (
            "No se encontró redirect a wp-admin en el login"
        )

    def test_login_has_password_field(self, login_html):
        """El campo de contraseña existe."""
        assert 'type="password"' in login_html

    def test_login_has_username_field(self, login_html):
        """El campo de usuario existe."""
        assert 'name="log"' in login_html

    def test_login_nonce_exposed(self, login_html):
        """Nonce del formulario de login visible en el HTML."""
        # WordPress login nonce
        nonce_match = re.search(
            r'name=["\']_wpnonce["\'].*?value=["\']([a-f0-9]+)["\']',
            login_html,
            re.DOTALL,
        )
        if nonce_match:
            assert len(nonce_match.group(1)) >= 8
        else:
            # Buscar cualquier nonce en el login
            assert re.search(r'[a-f0-9]{10}', login_html), (
                "No se encontró ningún nonce en wp-login.php"
            )


# ──────────────────────────────────────────────
# Formularios WooCommerce
# ──────────────────────────────────────────────
class TestWooCommerceForms:
    """Análisis de formularios de WooCommerce (add-to-cart)."""

    def _get_sample_product(self):
        """Busca un producto de ejemplo en el crawl."""
        import os
        from helpers import CRAWL_ROOT
        product_dir = os.path.join(CRAWL_ROOT, "producto")
        if not os.path.isdir(product_dir):
            return None
        for entry in os.listdir(product_dir):
            index = os.path.join(product_dir, entry, "index.html")
            if os.path.isfile(index):
                return os.path.join("producto", entry, "index.html")
        return None

    def test_product_form_exists(self):
        """Al menos un producto tiene formulario add-to-cart."""
        path = self._get_sample_product()
        if path is None:
            pytest.skip("No se encontró ningún producto")
        content = read_file(path)
        assert "<form" in content.lower(), (
            f"No se encontró formulario en {path}"
        )

    def test_add_to_cart_action_url(self):
        """El formulario add-to-cart envía datos al sitio correcto."""
        path = self._get_sample_product()
        if path is None:
            pytest.skip("No se encontró ningún producto")
        content = read_file(path)
        # Los formularios add-to-cart usan URLs del propio sitio
        has_form = "add-to-cart" in content or "add_to_cart" in content
        assert has_form, (
            f"No se encontró acción add-to-cart en {path}"
        )


# ──────────────────────────────────────────────
# Formulario de búsqueda
# ──────────────────────────────────────────────
class TestSearchForm:
    """Verifica formularios de búsqueda."""

    def test_search_form_in_index(self):
        """El formulario de búsqueda existe en la página principal."""
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        content = read_file("index.html")
        assert 'type="search"' in content or "search-form" in content, (
            "No se encontró formulario de búsqueda"
        )
