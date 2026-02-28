# Informe de Seguridad — realfirmware.net

**Fecha de análisis:** 2026-02-28
**Fuente:** Crawl estático del sitio (profundidad 10)
**CMS detectado:** WordPress 6.9.1 con WooCommerce 10.4.3

---

## Resumen Ejecutivo

Se analizó el crawl completo del sitio realfirmware.net y se identificaron **13 vulnerabilidades o fallos de seguridad** clasificados por severidad. A continuación se documenta cada hallazgo con su ubicación, impacto y recomendación.

---

## Hallazgos

### 1. Cabecera HSTS Ausente (Strict-Transport-Security)
- **Severidad:** ALTA
- **Archivos afectados:** `index.html.headers`, `wp-links-opml.php.headers`, `wp-sitemap-posts-product-1.xml.headers`
- **Descripción:** No se envía la cabecera `Strict-Transport-Security` en ninguna respuesta. Esto permite ataques de downgrade HTTPS→HTTP (MITM, SSL stripping).
- **Impacto:** Un atacante en la misma red puede interceptar tráfico redirigiendo al usuario a HTTP.
- **Recomendación:** Configurar en nginx:
  ```
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
  ```

### 2. Cabecera Content-Security-Policy (CSP) Ausente en Páginas Públicas
- **Severidad:** ALTA
- **Archivos afectados:** `index.html.headers`, `wp-links-opml.php.headers`, `wp-sitemap-posts-product-1.xml.headers`
- **Descripción:** Solo la página de login (`wp-login.php`) tiene CSP (`frame-ancestors 'self'`). Las demás páginas carecen de CSP, permitiendo inyección de scripts externos.
- **Impacto:** Vulnerabilidad a ataques XSS reflejado y almacenado. Scripts maliciosos pueden ejecutarse sin restricción.
- **Recomendación:** Implementar CSP restrictiva en todas las páginas:
  ```
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.paypal.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src https://www.paypal.com;" always;
  ```

### 3. Divulgación de Versiones de Software
- **Severidad:** MEDIA
- **Archivos afectados:** `index.html`, `wp-login.php`, todos los productos en `producto/`
- **Descripción:** Se exponen las versiones exactas de:
  | Componente | Versión | Ejemplo |
  |------------|---------|---------|
  | WordPress | 6.9.1 | `?ver=6.9.1` en scripts |
  | WooCommerce | 10.4.3 | `?ver=10.4.3` |
  | Elementor | 3.35.0 | `?ver=3.35.0` |
  | Elementor Pro | 3.17.1 | `?ver=3.17.1` |
  | OceanWP | 3.5.5 | `?ver=3.5.5` |
  | jQuery | 3.7.1 | `?ver=3.7.1` |
  | Adapta RGPD | 1.3.9 | `?ver=1.3.9` |
  | WC PayPal | 3.3.2 | `?ver=3.3.2` |
  | TI Wishlist | 2.11.1 | `?ver=2.11.1` |
- **Impacto:** Permite a atacantes identificar vulnerabilidades conocidas (CVEs) para versiones específicas.
- **Recomendación:** Eliminar parámetros `ver=` con un filtro en `functions.php`:
  ```php
  add_filter('style_loader_src', 'remove_ver_css_js', 9999);
  add_filter('script_loader_src', 'remove_ver_css_js', 9999);
  function remove_ver_css_js($src) {
      if (strpos($src, 'ver=')) $src = remove_query_arg('ver', $src);
      return $src;
  }
  ```

### 4. Nonces y Tokens de Seguridad Expuestos en HTML
- **Severidad:** ALTA
- **Archivos afectados:** `index.html`, todas las páginas de productos
- **Descripción:** Se encontraron al menos 18 nonces expuestos en el código fuente:
  - `ajax_nonce: "4a378838aa"` (welcomebar)
  - `nonce: "922a58d6da"` (PayPal gateway)
  - `nonce: "d339bff5ff"` (Wishlist)
  - `nonce: "5f0786a075"` (OceanWP)
  - `wpnonce: "cabc64c34d"` (OceanWP checkout)
  - `nonce: "8dd6dfc15b"` (WC Store REST API)
  - Múltiples nonces de PayPal: `d92bdd9bd4`, `5e0e62c274`, `8c2c059bd3`, `866ad58a05`, etc.
- **Impacto:** En un crawl estático los nonces pueden estar expirados, pero si se regeneran con patrones predecibles o larga duración, un atacante podría reutilizarlos para CSRF.
- **Recomendación:** Verificar que los nonces expiran correctamente (WordPress default: 24h). Considerar reducir la duración.

### 5. Client ID de PayPal Expuesto
- **Severidad:** MEDIA
- **Archivos afectados:** `index.html`
- **Descripción:** El Client ID de PayPal está visible en el código fuente:
  ```
  client-id: "Ad3Q3xy_odQU4_o_w1_TYr0X35KPLqckIHFi48poW-tuGZxG2vY3p0JiQi-2Qc1Vh1FMTFQsMxh42D8A"
  ```
- **Impacto:** Aunque el Client ID solo no permite transacciones (se necesita también el Secret), facilita ataques de phishing personalizados y enumeración de la cuenta merchant.
- **Recomendación:** El Client ID es semi-público por diseño de PayPal, pero verificar que el modo sandbox/producción sea el correcto y que existen validaciones server-side.

### 6. API REST de WordPress Públicamente Accesible
- **Severidad:** MEDIA
- **Archivos afectados:** `wp-json/index.html`, `wp-json/wp/v2/pages.json`, `wp-json/wc/store/v1/products/categories.json`
- **Descripción:** La API REST de WordPress está completamente accesible sin autenticación:
  - `/wp-json/wp/v2/pages` — enumera todas las páginas
  - `/wp-json/wc/store/v1/products/categories` — lista categorías de productos
  - `/wp-json/oembed/1.0/embed` — endpoint oEmbed
- **Impacto:** Permite enumeración de contenido, usuarios y estructura del sitio.
- **Recomendación:** Restringir el acceso a la API REST para usuarios no autenticados:
  ```php
  add_filter('rest_authentication_errors', function($result) {
      if (!is_user_logged_in()) {
          return new WP_Error('rest_not_logged_in', 'No autenticado', ['status' => 401]);
      }
      return $result;
  });
  ```

### 7. Cabecera X-Frame-Options Ausente en Páginas Públicas
- **Severidad:** MEDIA
- **Archivos afectados:** `index.html.headers`, `wp-links-opml.php.headers`
- **Descripción:** Solo `wp-login.php` tiene `X-Frame-Options: SAMEORIGIN`. Las páginas públicas no tienen esta protección.
- **Impacto:** Susceptible a ataques de clickjacking — el sitio puede ser embebido en un iframe malicioso.
- **Recomendación:** Añadir a la configuración de nginx:
  ```
  add_header X-Frame-Options "SAMEORIGIN" always;
  ```

### 8. Divulgación del Servidor (nginx)
- **Severidad:** BAJA
- **Archivos afectados:** Todos los archivos `.headers`
- **Descripción:** La cabecera `Server: nginx` revela el software del servidor web.
- **Impacto:** Facilita la identificación de la tecnología para ataques dirigidos.
- **Recomendación:** Ocultar la versión en nginx:
  ```
  server_tokens off;
  ```

### 9. Cabecera Referrer-Policy Ausente en Páginas Públicas
- **Severidad:** BAJA
- **Archivos afectados:** `index.html.headers`, `wp-links-opml.php.headers`
- **Descripción:** Solo `wp-login.php` tiene `Referrer-Policy`. Las demás páginas no controlan qué información se envía en el header Referer.
- **Impacto:** Puede filtrar URLs con parámetros sensibles a sitios de terceros.
- **Recomendación:**
  ```
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  ```

### 10. Cookie sin Atributo SameSite
- **Severidad:** MEDIA
- **Archivos afectados:** `wp-login.php.headers`
- **Descripción:** La cookie `wordpress_test_cookie` no incluye el atributo `SameSite`, que protege contra ataques CSRF basados en cookies.
- **Impacto:** Las cookies pueden enviarse en solicitudes cross-site, facilitando CSRF.
- **Recomendación:** Configurar cookies con `SameSite=Lax` o `SameSite=Strict`.

### 11. Cabeceras de Seguridad Ausentes en wp-links-opml.php
- **Severidad:** BAJA
- **Archivos afectados:** `wp-links-opml.php.headers`
- **Descripción:** Este endpoint no tiene ninguna cabecera de seguridad (ni `X-Content-Type-Options`, ni `X-XSS-Protection`, ni ninguna otra).
- **Impacto:** Endpoint completamente desprotegido.
- **Recomendación:** Aplicar cabeceras de seguridad globalmente en nginx, no por archivo.

### 12. Endpoints AJAX y WC-AJAX Expuestos
- **Severidad:** BAJA
- **Archivos afectados:** `index.html`, páginas de productos
- **Descripción:** Se revelan múltiples endpoints de WooCommerce AJAX:
  - `/?wc-ajax=ppc-simulate-cart`
  - `/?wc-ajax=ppc-create-order`
  - `/?wc-ajax=ppc-approve-order`
  - `/?wc-ajax=ppc-vault-paypal`
  - `/?wc-ajax=ppc-validate-checkout`
  - `/wp-admin/admin-ajax.php`
- **Impacto:** Permite enumeración de endpoints y posibles ataques de fuerza bruta.
- **Recomendación:** Implementar rate limiting en endpoints AJAX.

### 13. Protección CAPTCHA Ausente o Mal Configurada
- **Severidad:** ALTA
- **Archivos afectados:** `contacto/index.html`, `wp-login.php`, páginas de productos
- **Descripción:** El sitio tiene infraestructura para CAPTCHA pero **ninguna protección activa**:

  **a) PayPal reCAPTCHA v2 — contenedor vacío (103+ productos):**
  Las páginas de producto incluyen un `<div id="ppcp-recaptcha-v2-container">` del plugin WooCommerce PayPal Payments, pero no se carga el script `google.com/recaptcha/api.js` ni se configura un `data-sitekey`. Esto indica que la protección reCAPTCHA v2 de PayPal fue habilitada en la configuración del plugin pero el script real nunca se inyecta, dejando el flujo de pago sin verificación anti-bot.

  **b) WPForms — mensajes de error CAPTCHA sin CAPTCHA activo:**
  El plugin WPForms Lite está configurado con mensajes de error para Google reCAPTCHA (`val_recaptcha_fail_msg`) y Cloudflare Turnstile (`val_turnstile_fail_msg`), y lista `"captcha"` en `readOnlyDisallowedFields`. Sin embargo, **no hay campo CAPTCHA en el formulario de contacto** ni se carga ningún script CAPTCHA. Esto deja el formulario de contacto sin protección contra spam y bots.

  **c) Login sin CAPTCHA:**
  La página `wp-login.php` no tiene ningún tipo de CAPTCHA (reCAPTCHA, Turnstile ni hCaptcha), lo que la hace vulnerable a ataques de fuerza bruta automatizados.

  **d) Cabecera Permissions-Policy permite dominios CAPTCHA sin usarlos:**
  La cabecera `Permissions-Policy` en `index.html.headers` permite tokens privados desde `recaptcha.net`, `challenges.cloudflare.com` y `hcaptcha.com`, pero ninguno de estos servicios está activo.

- **Impacto:**
  - Formularios de contacto expuestos a spam masivo
  - Login vulnerable a ataques de fuerza bruta
  - Flujo de pago sin verificación anti-bot
  - Falsa sensación de seguridad por tener infraestructura CAPTCHA sin activar

- **Recomendación:**
  1. **Activar reCAPTCHA v3 o Turnstile en WPForms:**
     - WPForms → Configuración → CAPTCHA → Activar reCAPTCHA v3
     - Configurar Site Key y Secret Key obtenidos de [Google reCAPTCHA](https://www.google.com/recaptcha/admin)

  2. **Configurar reCAPTCHA en PayPal Payments:**
     - WooCommerce → Settings → Payments → PayPal → Advanced → Activar reCAPTCHA
     - Proporcionar Site Key de reCAPTCHA v2 (checkbox) o v3 (invisible)

  3. **Proteger wp-login.php con CAPTCHA:**
     Instalar un plugin como "Login Security reCAPTCHA" o añadir manualmente:
     ```php
     // En functions.php
     function add_login_recaptcha() {
         echo '<script src="https://www.google.com/recaptcha/api.js" async defer></script>';
         echo '<div class="g-recaptcha" data-sitekey="YOUR_SITE_KEY"></div>';
     }
     add_action('login_form', 'add_login_recaptcha');
     ```

  4. **Alternativa: Cloudflare Turnstile (sin fricción):**
     ```php
     // Turnstile es gratuito y no requiere interacción del usuario
     echo '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
     echo '<div class="cf-turnstile" data-sitekey="YOUR_TURNSTILE_KEY"></div>';
     ```

---

## Tabla Resumen

| # | Vulnerabilidad | Severidad | Tipo |
|---|---------------|-----------|------|
| 1 | HSTS ausente | ALTA | Cabecera |
| 2 | CSP ausente en públicas | ALTA | Cabecera |
| 3 | Versiones de software expuestas | MEDIA | Divulgación |
| 4 | Nonces expuestos en HTML | ALTA | Token |
| 5 | Client ID PayPal visible | MEDIA | Divulgación |
| 6 | API REST pública | MEDIA | Acceso |
| 7 | X-Frame-Options ausente | MEDIA | Cabecera |
| 8 | Server: nginx revelado | BAJA | Divulgación |
| 9 | Referrer-Policy ausente | BAJA | Cabecera |
| 10 | Cookie sin SameSite | MEDIA | Cookie |
| 11 | OPML sin cabeceras | BAJA | Cabecera |
| 12 | Endpoints AJAX expuestos | BAJA | Divulgación |
| 13 | CAPTCHA ausente/mal configurado | ALTA | Autenticación |

---

## Scripts de Prueba

Los scripts de prueba se encuentran en:
- `security/tests/test_security_headers.py` — Pruebas de cabeceras HTTP
- `security/tests/test_information_disclosure.py` — Pruebas de divulgación de información
- `security/tests/test_forms_and_tokens.py` — Pruebas de formularios y tokens
- `security/tests/test_api_exposure.py` — Pruebas de exposición de API
- `security/tests/test_captcha.py` — Pruebas de configuración y ausencia de CAPTCHA

Ejecutar con: `pytest security/tests/ -v`
