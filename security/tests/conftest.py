"""Configuración de pytest para los tests de seguridad."""

import sys
import os

# Añadir el directorio de tests al path para importar helpers
sys.path.insert(0, os.path.dirname(__file__))
