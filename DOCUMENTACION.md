# Documentación del Sistema AquaSafe

Esta documentación describe las funciones y herramientas disponibles en la plataforma AquaSafe, separadas por el rol de cada perfil en el sistema.

## 💧 Estructura General de la Plataforma
Todos los usuarios, sin importar su rol, interactúan primero con el **Módulo de Autenticación**. En este módulo, el sistema permite:
* **Página de Inicio (Landing View):** Pantalla de bienvenida.
* **Selección de Perfil:** Personal Operativo (Usuario) o Admin Sistema.
* **Acceso:** Iniciar sesión o registrar una nueva cuenta proporcionando datos como Nombre, Correo, Teléfono y Dirección.

---

## 👤 1. Funciones del Usuario (Personal Operativo)

El sistema para el usuario operativo está enfocado en el monitoreo directo y personal de su equipo de medición de agua en tiempo real.

### A. Dashboard Principal (Panel de Control)
* **Estado General:** Indicadores rápidos para ver el estado de la conexión y un resumen general.
* **Monitoreo en Tiempo Real (Medidores Visuales):**
  * **Nivel de pH:** Medidor gráfico del nivel actual de pH del agua.
  * **TDS (Sólidos Disueltos Totales):** Medidor que muestra el nivel en unidades *ppm* (Partes Por Millón).
  * **Turbidez:** Medidor gráfico en unidades *NTU* (Unidades Nefelométricas de Turbidez).
* **Gráficos de Historial:** Tres gráficas independientes para visualizar el comportamiento de las métricas (pH, TDS y Turbidez) a lo largo del tiempo, facilitando el análisis de tendencias.

### B. Configuración y Gestión (Settings)
* **Perfil:** Visualización de sus datos personales y rol actual.
* **Vinculación de Dispositivo:** Permite ingresar la dirección MAC del dispositivo físico (como por ejemplo, un sensor ESP32) para emparejarlo con su cuenta y recibir sus mediciones de forma directa.
* **Simulador IoT (Desarrollo/Pruebas):** Una herramienta muy útil que le permite inyectar o simular manualmente mediciones de pH, TDS y turbidez en el sistema hacia su dispositivo virtualmente vinculado.

---

## 🛡️ 2. Funciones del Administrador (Admin Sistema)

El sistema para el administrador se enfoca en la supervisión global, gestión de los límites de las alertas y visualización del ecosistema de dispositivos.

### A. Dashboard Principal (Modo Administrador)
* A diferencia del usuario regular, el módulo de Dashboard del Admin no muestra indicadores de un dispositivo individual, ya que su objetivo es la visión empresarial. En su lugar, se le proporciona un atajo rápido hacia el panel macro administrativo.

### B. Configuración Avanzada (Settings Admin)
* **Ajuste de Umbrales Globales (Global Thresholds):**
  * Puede definir a qué niveles el agua se considera fuera o dentro de los límites saludables.
  * Permite cambiar parámetros críticos como el **pH Mínimo**, el **pH Máximo** aceptado y configurar el tope del **TDS Máximo**.
  * Estos límites se aplican de manera global a todo el ecosistema AquaSafe.
* **Gestión y Monitoreo de Usuarios:**
  * Visualiza una tabla con un resumen de todos los usuarios (clientes) registrados y activos en el sistema.
  * Le permite monitorear quién es el cliente, su contacto, qué **ID de Dispositivo (MAC)** tiene asignado, el registro de la **última lectura recibida** y el **estado** actual de su medición.
  * Incluye botón para actualizar en tiempo real la información de todos los usuarios supervisados.

---

## 🗄️ 3. Arquitectura y Gestión de Base de Datos (Supabase)

Parte fundamental de AquaSafe se encuentra en el backend, gestionado por **Supabase** (PostgreSQL). A continuación, se detalla la estructura implementada.

### A. Tablas Principales
* **`profiles`**: Almacena información personalizada del usuario vinculada a la autenticación de Supabase (`auth.users`).
  * Campos clave: `id`, `email`, `role` (operator|admin), `full_name`, `phone`, `address`.
* **`devices`**: Registra los dispositivos físicos IoT asignados a cada usuario.
  * Campos clave: `mac_address` (PK), `name`, `user_id` (vinculado a profiles).
* **`mediciones`**: Almacena el histórico de datos enviados por cada sensor IoT en tiempo real.
  * Campos clave: `id`, `device_id` (vinculado a devices), `ph`, `turbidez`, `tds`, `temperatura`, `created_at`.

### B. Funcionalidades Automatizadas (Triggers)
* **`handle_new_user()`**: Un *Trigger* crítico de base de datos que escucha eventos en Supabase Auth (`AFTER INSERT ON auth.users`). Cuando un nuevo usuario se registra desde la aplicación, este trigger crea automáticamente y de forma silenciosa la fila correspondiente en la tabla `profiles` con el rol por defecto de operador (`operator`).

### C. Vistas Analíticas (Views)
* **`admin_device_monitor`**: Es una "Vista Maestra" creada en SQL diseñada específicamente para facilitar el dashboard del administrador.
  * Cruza datos relacionando Dispositivos (`devices`), Información de su Dueño (`profiles`) y la **última medición registrada** (`mediciones`) en una sola consulta plana y eficiente.
  * Facilita al administrador la lectura de información de contacto (nombre, teléfono, dirección) junto con los datos de telemetría (pH, TDS, Turbidez).

### D. Procedimientos Almacenados (RPC / Funciones de Base de Datos)
El administrador del sistema puede ejecutar desde el Dashboard consultas protegidas que corren directamente en la base de datos a nivel de administrador (`SECURITY DEFINER`):
* **`admin_delete_device(p_mac_address TEXT)`**: Elimina de manera limpiada todas las mediciones de un sensor y posteriormente el propio dispositivo en sí.
* **`admin_delete_user(p_user_id UUID)`**: Borra absolutamente todo el rastro de un cliente de forma segura: sus mediciones asociadas, sus dispositivos, su perfil (`public.profiles`) e internamente lo da de baja del sistema de contraseñas de Supabase (`auth.users`).

### E. Seguridad de Datos (Políticas RLS)
* Las tablas cuentan con **Row Level Security (RLS)** habilitado.
* **Lectura Segura**: Los operarios de los sensores *solo* pueden ver (SELECT) y alimentar datos sobre *sus propios* dispositivos asociados. Nunca los de otros usuarios.
* Los administradores poseen reglas exclusivas interconectadas que les permite visualizar el espectro completo (Global Selects).

### F. Scripts de Mantenimiento y Realtime
Para asegurar el funcionamiento, el proyecto cuenta con varios scripts en SQL que se ejecutaron en el entorno:
* `enable_realtime.sql`: Habilita la publicación ("broadcast") de cambios para que la métrica o los gráficos de los dashboard cambien momentáneamente y sin recargar la página (`ALTER PUBLICATION supabase_realtime ADD TABLE mediciones;`).
* `clean_data.sql`: Comandos de truncado (`TRUNCATE TABLE ... CASCADE`) para reiniciar en limpio toda la información si fuese necesario y comenzar desde cero durante las implementaciones piloto.
