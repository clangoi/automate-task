// ==============================
// FUNCIONES DE APOYO
// ==============================

// Busca el archivo base en la carpeta de tareas
function findOriginalTaskFileId(taskName) {
  const folder = DriveApp.getFolderById(TASK_FOLDER_ID);
  const files = folder.getFiles();
  const normalized = taskName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = normalized.match(/practico\s+(\d+)/);
  if (!match) return null;
  const prefix = "T" + match[1];

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (
      name.startsWith(prefix) &&
      !name.includes("test") &&
      !name.includes("solved") &&
      name.endsWith(".ipynb")
    ) {
      Logger.log("\u2705 Archivo base encontrado: " + name);
      return file.getId();
    }
  }
  return null;
}

// Extrae el ID de un enlace de Google Drive
function extractIdFromUrl(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

// Verifica si el archivo es accesible
function checkingFileAuth(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    Logger.log(`\u2705 Acceso verificado: ${file.getName()}`);
    return { accessible: true, name: file.getName() };
  } catch (e) {
    Logger.log("\ud83d\udd12 Acceso denegado: " + e.message);
    return { accessible: false, error: e.message };
  }
}

// Compara archivo del estudiante con el original
function checkFileTest(studentFileId, originalFileId) {
  const studentContent = getNotebookContent(studentFileId);
  const originalContent = getNotebookContent(originalFileId);
  if (!studentContent || !originalContent) return false;

  let studentJson, originalJson;
  try {
    studentJson = JSON.parse(studentContent);
    originalJson = JSON.parse(originalContent);
  } catch (e) {
    Logger.log("\u274C JSON inválido: " + e.message);
    return false;
  }

  const studentCells = extractCellSources(studentJson);
  const originalCells = extractCellSources(originalJson);
  const cleanedStudent = cleanCellSources(studentCells);
  const cleanedOriginal = cleanCellSources(originalCells);

  if (arraysEqual(cleanedStudent, cleanedOriginal)) {
    Logger.log("\u26a0 Entrega sin modificar (archivo idéntico).");
    return false;
  }

  const similarity = calculateTextSimilarity(cleanedOriginal, cleanedStudent);
  const hasActivity = detectStudentActivity(studentJson, cleanedOriginal);

  Logger.log(`\ud83d\udcca Similitud: ${similarity.toFixed(1)}%, Actividad detectada: ${hasActivity}`);
  return similarity >= 70 && hasActivity;
}

// Extrae el código de todas las celdas
function extractCellSources(json) {
  const sources = [];
  if (!json.cells) return sources;
  json.cells.forEach(cell => {
    if (cell.source) {
      const lines = Array.isArray(cell.source) ? cell.source : [cell.source];
      sources.push(...lines.map(line => line.trim()));
    }
  });
  return sources;
}

// Limpia líneas vacías o con placeholders
function cleanCellSources(lines) {
  return lines.filter(line => line !== "" && !isCommonPlaceholder(line));
}

// Calcula similitud textual entre entregas
function calculateTextSimilarity(original, student) {
  if (original.length === 0) return 100;
  const matches = original.filter(line => student.includes(line)).length;
  return (matches / original.length) * 100;
}

// Detecta si hubo actividad real (código ejecutado o nuevo contenido)
function detectStudentActivity(notebookJson, cleanedOriginal) {
  let hasOutputs = false;
  let newContent = false;
  if (!notebookJson.cells) return false;

  for (const cell of notebookJson.cells) {
    if (cell.cell_type === "code" && cell.outputs?.length > 0) hasOutputs = true;
    if (cell.source) {
      const sources = Array.isArray(cell.source) ? cell.source : [cell.source];
      for (const line of sources) {
        const trimmed = line.trim();
        if (trimmed && !cleanedOriginal.includes(trimmed) && !isCommonPlaceholder(trimmed)) {
          newContent = true;
        }
      }
    }
  }
  return hasOutputs || newContent;
}

// Detecta líneas que son placeholders
function isCommonPlaceholder(line) {
  const placeholders = ["pass", "# Escribe tu código aquí", "# Tu respuesta aquí", "...", "return None"];
  return placeholders.some(p => line.includes(p));
}

// Lee el contenido del notebook
function getNotebookContent(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    Logger.log(`\u2705 Archivo leído: ${file.getName()}`);
    return file.getBlob().getDataAsString();
  } catch (e) {
    Logger.log("\u274C Error leyendo archivo: " + e.message);
    return null;
  }
}

// Compara dos arreglos
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Corrige y da retroalimentación
function calculateScore(fileId) {
  const content = getNotebookContent(fileId);
  if (!content) {
    Logger.log("\u274C No se pudo leer el archivo.");
    return { score: 0, feedback: ["No se pudo leer el archivo."] };
  }

  let nb;
  try {
    nb = JSON.parse(content);
  } catch (e) {
    Logger.log("\u274C JSON inválido: " + e.message);
    return { score: 0, feedback: ["El archivo no es un notebook válido."] };
  }

  let score = 0;
  const feedback = [];

  if (!Array.isArray(nb.cells)) {
    feedback.push("El notebook no tiene celdas válidas.");
    return { score, feedback };
  }

  for (const cell of nb.cells) {
    if (!cell.source || cell.cell_type !== "code") continue;
    const sourceLines = Array.isArray(cell.source) ? cell.source : [cell.source];
    const fullSource = sourceLines.join("\n");

    const titleMatch = fullSource.match(/#\s*@title\s+(?:Actividad|Práctico)\s+(\d+)/i);
    if (!titleMatch) continue;

    const actNum = parseInt(titleMatch[1], 10);
    if (actNum < 1 || actNum > MAX_SCORE) continue;

    const key = `Actividad ${actNum}`;
    const correct = CORRECT_ANSWERS[key];

    const paramMatch = fullSource.match(/=\s*["']([^"']*)["']\s*#\s*@param/i);
    let chosen = paramMatch ? paramMatch[1].trim() : null;

    if (!chosen || chosen.toUpperCase() === "N/A") {
      feedback.push(`\u274C ${key}: sin respuesta`);
      continue;
    }

    if (actNum === 7 && Array.isArray(correct)) {
      const studentAnswers = chosen.split(",").map(s => s.trim()).filter(Boolean);
      if (studentAnswers.length !== 2) {
        feedback.push(`\u274C ${key}: se esperaban 2 respuestas, se encontraron ${studentAnswers.length}`);
      } else {
        const [a1, a2] = studentAnswers;
        const [c1, c2] = correct;
        if ((a1 === c1 && a2 === c2) || (a1 === c2 && a2 === c1)) {
          score++;
          feedback.push(`\u2705 ${key}: correcta (${chosen})`);
        } else {
          feedback.push(`\u274C ${key}: '${chosen}' → esperado: '${c1}, ${c2}' o '${c2}, ${c1}'`);
        }
      }
      continue;
    }

    if (typeof correct === "string") {
      const cleanChosen = chosen.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cleanCorrect = correct.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (cleanChosen === cleanCorrect) {
        score++;
        feedback.push(`\u2705 ${key}: correcta (${chosen})`);
      } else {
        feedback.push(`\u274C ${key}: '${chosen}' → esperado: '${correct}'`);
      }
    }
  }

  for (let i = 1; i <= MAX_SCORE; i++) {
    const key = `Actividad ${i}`;
    if (!feedback.some(f => f.includes(key))) {
      feedback.push(`\u274C ${key}: no encontrada`);
    }
  }

  feedback.sort((a, b) => a.localeCompare(b));
  Logger.log(`\ud83d\udcca Puntaje calculado: ${score}/${MAX_SCORE}`);
  return { score, feedback };
}

// Convierte puntaje a nota (1.0 a 7.0)
function scoreToGrade(score, maxScore = 8) {
  const minFor4 = maxScore * 0.5;
  let grade;
  if (score >= minFor4) {
    grade = 4.0 + (3.0 * (score - minFor4)) / (maxScore - minFor4);
  } else {
    grade = 1.0 + (3.0 * score) / minFor4;
  }
  return parseFloat(grade.toFixed(1));
}

// Envía correo al estudiante
function sendEmail(email, message, taskName, studentName) {
  const subject = `Evaluación ${taskName} - ${studentName}`;
  const htmlBody = message
    .replace(/\n/g, '<br>')
    .replace(/\u2705/g, '<span style="color: #2e7d32;">\u2705</span>')
    .replace(/\u274C/g, '<span style="color: #c62828;">\u274C</span>');

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: message,
      htmlBody: htmlBody
    });
    Logger.log("\ud83d\udce7 Email enviado a: " + email);
  } catch (e) {
    Logger.log("\u274C Fallo al enviar email: " + e.message);
  }
}

// Alerta al profesor
function sendTeacherAlert(message) {
  try {
    MailApp.sendEmail({
      to: TEACHER_EMAIL,
      subject: "\u26a0 Alerta en sistema de evaluación",
      body: message
    });
  } catch (e) {
    Logger.log("\u274C No se pudo enviar alerta al profesor: " + e.message);
  }
}

// Hace copia de respaldo
function backupStudentFile(fileId, studentName, taskName) {
  try {
    const file = DriveApp.getFileById(fileId);
    const backupFolder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
    const date = new Date().toISOString().split('T')[0];
    const copyName = `[Backup] ${taskName} - ${studentName} - ${date}`;
    file.makeCopy(copyName, backupFolder);
    Logger.log("\ud83d\udcc1 Backup creado: " + copyName);
  } catch (e) {
    Logger.log("\u26a0 No se pudo hacer backup: " + e.message);
  }
}

// ==============================
// HOJA DE CÁLCULO
// ==============================

// Asegura que el estudiante tenga fila
function ensureStudentRowExists(userEmail, studentName) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === userEmail) return; // Ya existe
  }

  const newRow = new Array(9).fill("");
  newRow[2] = studentName;
  newRow[3] = userEmail;
  sheet.appendRow(newRow);
  Logger.log(`\u2b05️ Fila creada para: ${userEmail}`);
}

// Obtiene el número de intentos
function getRevisionCount(userEmail) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === userEmail) {
      const attempt = data[i][6]; // Columna G
      return attempt ? Number(attempt) : 0;
    }
  }
  return 0;
}

// Incrementa y guarda el número de intentos
function incrementRevisionCount(userEmail) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === userEmail) {
      const current = data[i][6] || 0;
      const newValue = current + 1;
      sheet.getRange(`G${i+1}`).setValue(newValue);
      if (!sheet.getRange("G1").getValue()) sheet.getRange("G1").setValue("Intento");
      Logger.log(`\u2705 Intento actualizado: ${newValue}`);
      return newValue;
    }
  }
  return 1; // fallback
}

// Guarda puntaje
function addScoreToSpreadsheet(userEmail, score) {
  updateSheet(userEmail, "F", score, "Puntaje");
}

// Guarda nota
function addGradeToSpreadsheet(userEmail, grade) {
  updateSheet(userEmail, "H", grade, "Nota");
}

// Guarda retroalimentación
function addFeedbackToSpreadsheet(userEmail, feedback) {
  updateSheet(userEmail, "I", feedback.join("\n"), "Retroalimentación");
}

// Actualiza celda en hoja
function updateSheet(userEmail, col, value, header) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === userEmail) {
      sheet.getRange(`${col}${i + 1}`).setValue(value);
      if (!sheet.getRange(`${col}1`).getValue()) {
        sheet.getRange(`${col}1`).setValue(header);
      }
      Logger.log(`\u2705 ${header} guardado en columna ${col}`);
      return;
    }
  }
}