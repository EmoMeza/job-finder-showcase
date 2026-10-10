# 0006. Proveedor de IA intercambiable por usuario

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

La evaluación de ofertas y la generación del perfil usan Claude. Hay dos formas de acceder: la
línea de comandos (`claude -p`), que usa una suscripción de Claude sin costo por token, y la API
de Anthropic con API key, que se paga por uso.

## Decisión

Una interfaz común de proveedor con dos implementaciones:

- `claude-cli`: ejecuta `claude -p --json-schema`. El token (`claude setup-token`) se configura a
  nivel de instancia con `CLAUDE_CODE_OAUTH_TOKEN`.
- `anthropic-api`: SDK oficial. Cada usuario ingresa su API key, que se guarda cifrada
  (AES-256-GCM con `APP_SECRET`) y nunca se devuelve completa al frontend.

Cada usuario elige su proveedor en su configuración. Todas las respuestas usan salida
estructurada (JSON schema) y cada score registra qué proveedor y modelo lo generó.

## Consecuencias

- Se puede usar sin pagar por token, o con API key cuando no hay suscripción.
- Las estadísticas pueden comparar resultados entre proveedores y modelos.
- La imagen de la API debe incluir el CLI de Claude.

## Alternativas consideradas

- **Solo API key:** costo por uso innecesario teniendo suscripción.
- **Solo CLI:** obliga a todos los usuarios de una instancia a compartir una suscripción.
