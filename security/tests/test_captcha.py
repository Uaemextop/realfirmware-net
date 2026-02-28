"""
Test 5 — Análisis de CAPTCHA

Verifica la configuración, presencia y ausencia de protección CAPTCHA
en los diferentes puntos de entrada del sitio (formularios, login,
páginas de producto, checkout).

Hallazgos esperados:
- Contenedor reCAPTCHA v2 de PayPal presente en productos pero sin
  script ni sitekey cargados (protección inactiva)
- WPForms configurado con mensajes de error para reCAPTCHA y Turnstile
  pero sin CAPTCHA activo en el formulario de contacto
- Cabecera Permissions-Policy permite dominios CAPTCHA (reCAPTCHA,
  Turnstile, hCaptcha) pero ninguno está implementado
- wp-login.php sin ningún tipo de CAPTCHA
"""

import os
import re
import json
import pytest
from helpers import read_file, file_exists, parse_headers, CRAWL_ROOT


# ──────────────────────────────────────────────
# Contenedor reCAPTCHA v2 de PayPal en productos
# ──────────────────────────────────────────────
class TestPayPalRecaptchaContainer:
    """VULN-13a: Contenedor reCAPTCHA v2 de PayPal sin script activo."""

    def _list_product_pages(self, limit=10):
        """Devuelve hasta `limit` rutas de producto con index.html."""
        product_dir = os.path.join(CRAWL_ROOT, "producto")
        if not os.path.isdir(product_dir):
            return []
        pages = []
        for entry in sorted(os.listdir(product_dir)):
            index = os.path.join("producto", entry, "index.html")
            if file_exists(index):
                pages.append(index)
                if len(pages) >= limit:
                    break
        return pages

    def test_recaptcha_container_present_in_products(self):
        """El div ppcp-recaptcha-v2-container existe en páginas de producto."""
        pages = self._list_product_pages(5)
        if not pages:
            pytest.skip("No se encontraron páginas de producto")
        found = 0
        for page in pages:
            content = read_file(page)
            if "ppcp-recaptcha-v2-container" in content:
                found += 1
        assert found >= 1, (
            "No se encontró ppcp-recaptcha-v2-container en ningún producto"
        )

    def test_recaptcha_container_count(self):
        """Al menos 50 productos contienen el contenedor reCAPTCHA."""
        product_dir = os.path.join(CRAWL_ROOT, "producto")
        if not os.path.isdir(product_dir):
            pytest.skip("Directorio producto/ no encontrado")
        count = 0
        for entry in os.listdir(product_dir):
            index_path = os.path.join(product_dir, entry, "index.html")
            if os.path.isfile(index_path):
                with open(index_path, encoding="utf-8", errors="replace") as f:
                    if "ppcp-recaptcha-v2-container" in f.read():
                        count += 1
        assert count >= 50, (
            f"Se esperaban ≥50 productos con contenedor reCAPTCHA, "
            f"encontrados {count}"
        )

    def test_no_recaptcha_script_loaded_in_product(self):
        """No se carga el script de Google reCAPTCHA en productos."""
        pages = self._list_product_pages(5)
        if not pages:
            pytest.skip("No se encontraron páginas de producto")
        for page in pages:
            content = read_file(page)
            # Verificar que NO se carga el script real de reCAPTCHA
            assert "google.com/recaptcha" not in content, (
                f"Se encontró script reCAPTCHA en {page} — verificar"
            )
            assert "www.gstatic.com/recaptcha" not in content, (
                f"Se encontró script gstatic reCAPTCHA en {page}"
            )

    def test_no_recaptcha_sitekey_in_product(self):
        """No hay sitekey de reCAPTCHA configurada en productos."""
        pages = self._list_product_pages(5)
        if not pages:
            pytest.skip("No se encontraron páginas de producto")
        for page in pages:
            content = read_file(page)
            assert "data-sitekey" not in content, (
                f"Se encontró data-sitekey en {page}"
            )
            # Buscar sitekey en la config JS de PayPalCommerceGateway
            sitekey_match = re.search(
                r'["\']?site_key["\']?\s*:\s*["\']([^"\']+)["\']', content
            )
            if sitekey_match:
                pytest.fail(
                    f"Se encontró site_key '{sitekey_match.group(1)}' en {page}"
                )


# ──────────────────────────────────────────────
# WPForms — CAPTCHA configurado pero inactivo
# ──────────────────────────────────────────────
class TestWPFormsCaptchaConfig:
    """VULN-13b: WPForms tiene mensajes CAPTCHA pero no CAPTCHA activo."""

    @pytest.fixture
    def contacto_html(self):
        if not file_exists("contacto/index.html"):
            pytest.skip("contacto/index.html no encontrado")
        return read_file("contacto/index.html")

    def test_wpforms_recaptcha_error_msg_present(self, contacto_html):
        """WPForms tiene mensaje de error para reCAPTCHA configurado."""
        assert "val_recaptcha_fail_msg" in contacto_html, (
            "No se encontró val_recaptcha_fail_msg en contacto"
        )

    def test_wpforms_turnstile_error_msg_present(self, contacto_html):
        """WPForms tiene mensaje de error para Turnstile configurado."""
        assert "val_turnstile_fail_msg" in contacto_html, (
            "No se encontró val_turnstile_fail_msg en contacto"
        )

    def test_wpforms_captcha_in_readonly_fields(self, contacto_html):
        """WPForms lista 'captcha' como campo readOnly/disallowed."""
        assert '"captcha"' in contacto_html, (
            "No se encontró 'captcha' en readOnlyDisallowedFields"
        )

    def test_no_recaptcha_script_in_contacto(self, contacto_html):
        """No se carga script de reCAPTCHA en la página de contacto."""
        assert "google.com/recaptcha" not in contacto_html, (
            "Se encontró script reCAPTCHA en contacto — verificar"
        )

    def test_no_turnstile_script_in_contacto(self, contacto_html):
        """No se carga script de Turnstile en la página de contacto."""
        assert "challenges.cloudflare.com/turnstile" not in contacto_html, (
            "Se encontró script Turnstile en contacto — verificar"
        )

    def test_no_hcaptcha_script_in_contacto(self, contacto_html):
        """No se carga script de hCaptcha en la página de contacto."""
        assert "hcaptcha.com" not in contacto_html, (
            "Se encontró script hCaptcha en contacto — verificar"
        )

    def test_no_captcha_field_in_contact_form(self, contacto_html):
        """El formulario de contacto no contiene campo CAPTCHA visible."""
        # Buscar elementos típicos de un CAPTCHA activo en el form
        assert "g-recaptcha" not in contacto_html, (
            "Se encontró clase g-recaptcha en contacto"
        )
        assert "cf-turnstile" not in contacto_html, (
            "Se encontró clase cf-turnstile en contacto"
        )
        assert "h-captcha" not in contacto_html, (
            "Se encontró clase h-captcha en contacto"
        )


# ──────────────────────────────────────────────
# Login sin CAPTCHA
# ──────────────────────────────────────────────
class TestLoginCaptchaAbsent:
    """VULN-13c: wp-login.php no tiene protección CAPTCHA."""

    @pytest.fixture
    def login_html(self):
        if not file_exists("wp-login.php"):
            pytest.skip("wp-login.php no encontrado")
        return read_file("wp-login.php")

    def test_no_recaptcha_in_login(self, login_html):
        """No hay reCAPTCHA en la página de login."""
        assert "g-recaptcha" not in login_html
        assert "google.com/recaptcha" not in login_html
        assert "data-sitekey" not in login_html

    def test_no_turnstile_in_login(self, login_html):
        """No hay Turnstile en la página de login."""
        assert "cf-turnstile" not in login_html
        assert "challenges.cloudflare.com/turnstile" not in login_html

    def test_no_hcaptcha_in_login(self, login_html):
        """No hay hCaptcha en la página de login."""
        assert "h-captcha" not in login_html
        assert "hcaptcha.com" not in login_html

    def test_no_captcha_container_in_login(self, login_html):
        """No hay ningún contenedor CAPTCHA en login."""
        # Verificar ausencia de contenedores CAPTCHA específicos
        # (los scripts individuales ya se verifican en otros tests)
        assert "captcha-container" not in login_html.lower(), (
            "Se encontró 'captcha-container' en wp-login.php"
        )


# ──────────────────────────────────────────────
# Permissions-Policy — Dominios CAPTCHA permitidos
# ──────────────────────────────────────────────
class TestPermissionsPolicyCaptcha:
    """Verifica que Permissions-Policy permite dominios CAPTCHA."""

    CAPTCHA_DOMAINS = [
        ("recaptcha.net", "Google reCAPTCHA"),
        ("challenges.cloudflare.com", "Cloudflare Turnstile"),
        ("hcaptcha.com", "hCaptcha"),
    ]

    @pytest.fixture
    def index_headers(self):
        if not file_exists("index.html.headers"):
            pytest.skip("index.html.headers no encontrado")
        return parse_headers(read_file("index.html.headers"))

    def test_permissions_policy_exists(self, index_headers):
        """La cabecera Permissions-Policy está presente."""
        assert "permissions-policy" in index_headers

    @pytest.mark.parametrize("domain,name", CAPTCHA_DOMAINS)
    def test_captcha_domain_allowed(self, index_headers, domain, name):
        """El dominio de {name} ({domain}) está en Permissions-Policy."""
        pp_values = index_headers.get("permissions-policy", [])
        pp_str = " ".join(pp_values)
        assert domain in pp_str, (
            f"Dominio {domain} ({name}) no encontrado en Permissions-Policy"
        )

    def test_private_state_token_feature(self, index_headers):
        """Permissions-Policy configura private-state-token-redemption."""
        pp_values = index_headers.get("permissions-policy", [])
        pp_str = " ".join(pp_values)
        assert "private-state-token-redemption" in pp_str


# ──────────────────────────────────────────────
# Página principal — sin CAPTCHA activo
# ──────────────────────────────────────────────
class TestIndexCaptchaAbsent:
    """La página principal no carga scripts CAPTCHA."""

    @pytest.fixture
    def index_html(self):
        if not file_exists("index.html"):
            pytest.skip("index.html no encontrado")
        return read_file("index.html")

    def test_no_recaptcha_script_in_index(self, index_html):
        """No se carga script de Google reCAPTCHA en index.html."""
        assert "google.com/recaptcha/api.js" not in index_html

    def test_no_turnstile_script_in_index(self, index_html):
        """No se carga script de Cloudflare Turnstile en index.html."""
        assert "challenges.cloudflare.com/turnstile" not in index_html

    def test_no_hcaptcha_script_in_index(self, index_html):
        """No se carga script de hCaptcha en index.html."""
        assert "js.hcaptcha.com" not in index_html
