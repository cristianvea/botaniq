# Seguridad

BotanIQ es una app personal para un grupo de amigos. Si encuentras un fallo de seguridad, no abras un issue público: escribe al propietario del repositorio por mensaje privado de GitHub.

## Cómo está protegida

- **Claves:** las claves secretas (servicio de Supabase, IA, notificaciones) solo viven en los secretos de GitHub Actions y de Supabase. En la app solo hay claves públicas (Supabase publishable y Pl@ntNet limitada por dominio).
- **Datos:** todas las tablas tienen RLS; cada persona solo ve las casas de las que es miembro y sus propias conversaciones.
- **IA:** la función `ai` solo responde a miembros de una casa, con un máximo diario por persona (20 preguntas y 10 diagnósticos) y solo sobre plantas y jardinería.
- **Invitaciones:** códigos de 10 caracteres, con un máximo de 10 intentos por hora y la opción de cambiarlos.
- **Navegador:** política de seguridad de contenidos (CSP) que solo permite código propio y los servicios necesarios.
- **Registro público:** el aviso diario no escribe nombres de casas ni de plantas en los registros de GitHub Actions.
