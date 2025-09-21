// ==============================
// onFormSubmit - PUNTO DE ENTRADA
// ==============================
function onFormSubmit(e) {
  try {
    const responses = e.response.getItemResponses();
    const userEmail = e.response.getRespondentEmail();
    let studentName = "";
    let uploadedFileId = null;

    Logger.log("\ud83d\udce7 Nueva entrega recibida de: " + userEmail);

    // === Extracción de datos del formulario ===
    for (let i = 0; i < responses.length; i++) {
      const item = responses[i].getItem();
      const title = item.getTitle();
      const type = item.getType();
      const response = responses[i].getResponse();

      Logger.log(`Campo: "${title}" | Tipo: ${type} | Respuesta: ${response}`);

      // Extraer nombre
      if ((type === FormApp.ItemType.TEXT || type === FormApp.ItemType.LIST) &&
          title.toLowerCase().includes("nombre")) {
        studentName = response?.trim() || "";
        if (studentName) {
          Logger.log(`\u2705 Nombre detectado: ${studentName}`);
        } else {
          Logger.log("\u26a0 Nombre vacío o inválido.");
        }
      }

      // Extraer archivo
      if (type === FormApp.ItemType.FILE_UPLOAD) {
        if (response && Array.isArray(response) && response.length > 0) {
          uploadedFileId = extractIdFromUrl(response[0]);
          Logger.log(`\u2705 Archivo subido: ${uploadedFileId}`);
        } else {
          Logger.log("\u26a0 No se subió ningún archivo.");
        }
      }
    }

    // === Validaciones iniciales ===
    const errores = [];

    if (!studentName) errores.push("nombre no proporcionado");
    if (!uploadedFileId) errores.push("no se detectó el archivo subido");

    if (errores.length > 0) {
      const mensaje = `
        No pudimos procesar tu entrega porque faltan datos:
        - ${errores.map(e => "\u2022 " + e).join("\n        - ")}
        Por favor, revisa que:
        1. Hayas completado tu nombre.
        2. Hayas subido el archivo correctamente (no solo un enlace).
        Vuelve a enviar el formulario.

        Si crees que esto es un error, escribe a ${SUPPORT_EMAIL} con tu situación.
      `.trim();
      sendEmail(userEmail, mensaje, CURRENT_TASK_NAME, studentName || "Estudiante");
      return;
    }

    // Asegurar que el estudiante tenga fila
    ensureStudentRowExists(userEmail, studentName);

    const revisionCount = getRevisionCount(userEmail);
    Logger.log(`\ud83d\udd01 Intento actual: ${revisionCount + 1} (máx. 2)`);

    if (revisionCount >= 2) {
      sendEmail(userEmail, `
        Ya has enviado esta tarea dos veces. No se aceptarán más entregas.
        Si necesitas ayuda, contacta al profesor.

        Si crees que esto es un error, escribe a ${SUPPORT_EMAIL} con tu situación.
      `.trim(), CURRENT_TASK_NAME, studentName);
      return;
    }

    // === Validar acceso al archivo ===
    const authResult = checkingFileAuth(uploadedFileId);
    if (!authResult.accessible) {
      sendEmail(userEmail, `
        No pudimos acceder a tu archivo. Por favor:
        1. Ve a tu archivo en Google Drive.
        2. Haz clic en "Compartir".
        3. Asegúrate de que diga: "Cualquiera con el enlace puede ver".
        4. Vuelve a enviar el formulario.

        Si crees que esto es un error, escribe a ${SUPPORT_EMAIL} con tu situación.
      `.trim(), CURRENT_TASK_NAME, studentName);
      return;
    }

    // === Buscar archivo base ===
    const originalTaskFileId = findOriginalTaskFileId(CURRENT_TASK_NAME);
    if (!originalTaskFileId) {
      const msg = `No se encontró el archivo base para: ${CURRENT_TASK_NAME}. Contacta al profesor.`;
      Logger.log("\u274C " + msg);
      sendEmail(userEmail, `
        ${msg}

        Si crees que esto es un error, escribe a ${SUPPORT_EMAIL} con tu situación.
      `.trim(), CURRENT_TASK_NAME, studentName);
      sendTeacherAlert(msg);
      return;
    }

    // === Validar que el archivo fue modificado ===
    if (!checkFileTest(uploadedFileId, originalTaskFileId)) {
      sendEmail(userEmail, `
        El archivo que subiste no parece ser una versión modificada de la tarea.
        Asegúrate de:
        - Usar el archivo base proporcionado.
        - Hacer cambios reales (código, respuestas).
        - No subir el archivo sin modificar.
        Vuelve a intentarlo.

        Si crees que esto es un error, escribe a ${SUPPORT_EMAIL} con tu situación.
      `.trim(), CURRENT_TASK_NAME, studentName);
      return;
    }

    // === Corrección automática ===
    const { score, feedback } = calculateScore(uploadedFileId);
    const grade = scoreToGrade(score, MAX_SCORE);
    const newAttempt = incrementRevisionCount(userEmail);

    // === Registro en hoja y respaldo ===
    addScoreToSpreadsheet(userEmail, score);
    addGradeToSpreadsheet(userEmail, grade);
    addFeedbackToSpreadsheet(userEmail, feedback);
    backupStudentFile(uploadedFileId, studentName, CURRENT_TASK_NAME);

    // === Enviar retroalimentación ===
    const message = `
      Tu entrega ha sido recibida. Tienes ${score}/${MAX_SCORE} aciertos. Tu nota es: ${grade}

      Detalles por actividad:
      ${feedback.join("\n")}

      Esta es tu entrega #${newAttempt}. Puedes volver a enviar una vez más si es necesario.
      Por favor, revisa tus respuestas para mejorar.
    `.trim();

    sendEmail(userEmail, message, CURRENT_TASK_NAME, studentName);
    Logger.log(`\u2705 Entrega procesada: ${score}/${MAX_SCORE}, Nota: ${grade}, Intento: ${newAttempt}`);

  } catch (error) {
    Logger.log("\ud83d\udc15 Error crítico: " + error.message);
    Logger.log("Stack: " + error.stack);
    sendTeacherAlert("Error en onFormSubmit: " + error.message + "\n" + error.stack);

    try {
      MailApp.sendEmail({
        to: userEmail,
        subject: `Error técnico en entrega - ${CURRENT_TASK_NAME}`,
        body: `
          Ocurrió un error inesperado al procesar tu entrega.
          Por favor, inténtalo de nuevo más tarde.

          Si el problema persiste, escribe a ${SUPPORT_EMAIL} con tu nombre, correo y nombre de la tarea.
        `.trim()
      });
    } catch (e) {
      Logger.log("\u274C No se pudo enviar email de error al estudiante.");
    }
  }
}