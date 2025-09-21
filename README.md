# 📚 Sistema de Corrección Automática para Tareas Académicas

Este sistema automatiza la corrección, retroalimentación y gestión de entregas de estudiantes mediante **Google Forms, Google Drive y Google Sheets**, ideal para cursos que usan notebooks de Jupyter (`.ipynb`) en Google Colab.

El script procesa cada entrega, verifica el archivo, corrige las respuestas, calcula la nota, guarda resultados y envía retroalimentación personalizada al estudiante.

---

## ✅ Funcionalidades principales

- ✅ **Corrección automática** de respuestas en notebooks.
- ✅ **Validación de entregas**: detecta si el archivo fue modificado.
- ✅ **Límite de intentos** (hasta 2 por estudiante).
- ✅ **Retroalimentación detallada** por actividad.
- ✅ **Registro en hoja de cálculo** (puntaje, nota, intentos, retroalimentación).
- ✅ **Respaldo automático** de archivos en Google Drive.
- ✅ **Soporte para estudiantes**: mensaje de contacto ante errores.
- ✅ **Alertas al profesor** en caso de fallos.
- ✅ **Mensajes claros en español**.

---

## 🧩 Arquitectura del Proyecto

El código está dividido en **tres archivos** para mejor organización:

| Archivo | Descripción |
|--------|------------|
| `const.gs` | Constantes globales y por tarea (correos, IDs, respuestas correctas). |
| `onFormSubmit.gs` | Función principal que se ejecuta al enviar el formulario. |
| `funcAuxiliar.gs` | Todas las funciones auxiliares (corrección, validación, envío de correos, etc). |

---

## ⚙️ Configuración Requerida

### 1. **Configuración Global** (`const.gs`)
Actualiza los siguientes valores:

```js
const TEACHER_EMAIL = "tu-correo@tu-universidad.cl";
const BACKUP_FOLDER_ID = "ID_CARPETA_BACKUP_ENTREGAS_ESTUDIANTES";
const SHEET_ID = "ID_DE_GOOGLE_SHEET";
const TASK_FOLDER_ID = "ID_FOLDER_CON_ENTREGAS_BASE";
const SUPPORT_EMAIL = "soporte-ayudantia@tu-universidad.cl";
```

> 🔗 Para obtener un **ID de carpeta o archivo**, abre el elemento en Drive y copia el ID del URL:  
> `https://drive.google.com/drive/folders/`**`kajsdhsljk394n23482349nasfdlkj`**

---

### 2. **Configuración por Tarea** (`const.gs`)
Cambia solo estas líneas por cada práctica:

```js
const CURRENT_TASK_NAME = "Práctico 1"; // ← Cambia solo esta línea
const CORRECT_ANSWERS = { ... }; // Respuestas correctas
const MAX_SCORE = 8; // Número de actividades
```

---

## 📝 Cómo deben entregar los estudiantes

Los estudiantes deben:
1. Descargar el archivo base (ej. `T1.ipynb`) de la carpeta de tareas.
2. Abrirlo en **Google Colab** o Jupyter.
3. Responder usando el formato:
   ```python
   # @title Actividad 1
   respuesta = "34944"  # @param
   ```
4. **Subir el archivo `.ipynb`** (no un enlace) en el formulario.
5. Asegurarse de que el archivo tenga permisos:  
   **"Cualquiera con el enlace puede ver"**.

---

## 📊 Integración con Google Sheets

El sistema guarda los resultados en una hoja de cálculo con estas columnas:

| Columna | Encabezado | Uso |
|--------|------------|-----|
| D | Correo | Identificación del estudiante |
| F | Puntaje | Número de respuestas correctas |
| G | Intento | Número de envíos (máx. 2) |
| H | Nota | Calificación final (1.0 – 7.0) |
| I | Retroalimentación | Detalles por actividad |

> ✅ La primera fila se completa automáticamente.

---

## 📁 Respaldo de Entregas

Cada archivo entregado se copia a una carpeta de respaldo con el formato:
```
[Backup] Práctico 1 - Nombre Estudiante - 2025-04-05
```

---

## 🔔 Desencadenador

El script se ejecuta automáticamente al enviar el formulario.

### Cómo configurarlo:
1. Abre el proyecto en [Google Apps Script](https://script.google.com/).
2. Haz clic en el ícono de reloj ⏱️ (**"Desencadenadores"**).
3. Crea uno nuevo:
   - Función: `onFormSubmit`
   - Evento: _Desde formulario_ → _Al enviar formulario_

---

## 🛠️ Requisitos del Formulario de Google Forms

El formulario debe tener:
- ✅ Un campo de **texto o lista** con "Nombre" en el título.
- ✅ Un campo de **subida de archivos** (permite `.ipynb`).
- ✅ Configurado para recopilar correos electrónicos (opcional, pero recomendado).

---

## 📬 Mensajes al Estudiante

El sistema envía correos automáticos con:
- ✅ Puntaje y nota.
- ✅ Retroalimentación por actividad (✅ / ❌).
- ✅ Número de intento.
- ✅ Instrucciones para corregir errores.
- ✅ Contacto de soporte si cree que hubo un error.

---

## 🚨 Manejo de Errores

| Error | Acción |
|------|-------|
| Falta archivo | Se pide volver a enviar |
| Permiso denegado | Se instruye a cambiar permisos |
| Archivo sin modificar | Se rechaza la entrega |
| Más de 2 intentos | No se aceptan más envíos |
| Error técnico | Se alerta al profesor y al estudiante |

Todos los errores incluyen:  
> _"Si crees que esto es un error, escribe a [soporte@...] con tu situación."_

---

## 📈 Escala de Notas

La nota se calcula linealmente:
- **0% – 50% del puntaje máximo** → escala de 1.0 a 4.0
- **50% – 100%** → escala de 4.0 a 7.0

Ejemplo: con `MAX_SCORE = 8`, 4 puntos = 4.0, 8 puntos = 7.0.

---

## 📁 Estructura del Proyecto

```
📦 Sistema-Correccion-Automatica
 ├─ const.gs               → Constantes
 ├─ onFormSubmit.gs        → Función principal
 ├─ funcAuxiliar.gs        → Funciones auxiliares
 └─ README.md              ← Este archivo
```

---

## 📎 Notas Finales

- Este sistema está diseñado para ----------.
- Es **fácil de reutilizar** para nuevas tareas: solo cambia `CURRENT_TASK_NAME` y `CORRECT_ANSWERS`.
- Usa **Google Workspace** sin necesidad de servidores externos.

