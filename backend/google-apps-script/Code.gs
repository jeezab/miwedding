/**
 * Wedding RSVP intake for Google Sheets + Telegram.
 * Deploy as Web App:
 * - Execute as: Me
 * - Who has access: Anyone
 */

function doGet() {
  return jsonResponse({ ok: true, service: "wedding-rsvp", status: "ready" });
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const props = PropertiesService.getScriptProperties();
    const required = readRequiredProperties(props);

    if (!isApiKeyValid(e, payload, required.rsvpApiKey)) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    if (!isPayloadValid(payload)) {
      return jsonResponse({ ok: false, error: "Invalid RSVP payload" });
    }

    if (isRateLimited(payload.guestName)) {
      return jsonResponse({ ok: false, error: "Too many requests. Try again in a minute." });
    }

    const sheet = getResponsesSheet(required.sheetId);
    const createdAt = new Date().toISOString();
    const row = [
      createdAt,
      normalize(payload.guestName),
      normalize(payload.attendance),
      normalize(payload.plusOne || "no"),
      normalize(payload.drinkPreference),
      normalize(payload.wish),
      normalize(payload.submittedAt),
      normalize(payload.source),
      normalize(payload.userAgent),
      normalize(payload.ipHint),
      "TRUE",
      "FALSE"
    ];

    sheet.appendRow(row);
    const rowIndex = sheet.getLastRow();

    const tgText = buildTelegramMessage(payload, createdAt);
    sendTelegram(required.botToken, required.telegramChatId, tgText);
    sheet.getRange(rowIndex, 12).setValue("TRUE");

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: "Server error",
      details: String(err && err.message ? err.message : err)
    });
  }
}

function parsePayload(e) {
  const raw = e && e.postData && typeof e.postData.contents === "string" ? e.postData.contents : "{}";
  const data = JSON.parse(raw);
  return data && typeof data === "object" ? data : {};
}

function readRequiredProperties(props) {
  const sheetId = normalize(props.getProperty("SHEET_ID"));
  const botToken = normalize(props.getProperty("BOT_TOKEN"));
  const telegramChatId = normalize(props.getProperty("TG_CHAT_ID"));
  const rsvpApiKey = normalize(props.getProperty("RSVP_API_KEY"));
  if (!sheetId || !botToken || !telegramChatId) {
    throw new Error("Required Script Properties are missing: SHEET_ID, BOT_TOKEN, TG_CHAT_ID");
  }
  return { sheetId: sheetId, botToken: botToken, telegramChatId: telegramChatId, rsvpApiKey: rsvpApiKey };
}

function isApiKeyValid(e, payload, expectedKey) {
  if (!expectedKey) return true;
  const headerValue = readHeader(e, "x-api-key");
  const bodyValue = normalize(payload && payload.apiKey);
  return headerValue === expectedKey || bodyValue === expectedKey;
}

function readHeader(e, name) {
  if (!e || !e.parameter) return "";
  const key = "header_" + String(name || "").toLowerCase();
  return normalize(e.parameter[key]);
}

function isPayloadValid(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (normalize(payload.company)) return false;
  if (!normalize(payload.guestName)) return false;
  if (!normalize(payload.attendance)) return false;
  return true;
}

function isRateLimited(guestName) {
  const cache = CacheService.getScriptCache();
  const minuteBucket = Utilities.formatDate(new Date(), "UTC", "yyyyMMddHHmm");
  const key = "rsvp:" + normalize(guestName).toLowerCase() + ":" + minuteBucket;
  if (cache.get(key)) return true;
  cache.put(key, "1", 60);
  return false;
}

function getResponsesSheet(sheetId) {
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const sheetName = "Responses";
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  ensureHeader(sheet);
  return sheet;
}

function ensureHeader(sheet) {
  const expected = [
    "createdAt",
    "guestName",
    "attendance",
    "plusOne",
    "drinkPreference",
    "wish",
    "submittedAt",
    "source",
    "userAgent",
    "ipHint",
    "deliverySheets",
    "deliveryTelegram"
  ];
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
    return;
  }
  const current = sheet.getRange(1, 1, 1, expected.length).getValues()[0].map(function (cell) {
    return normalize(cell);
  });
  const mismatch = expected.some(function (name, index) {
    return current[index] !== name;
  });
  if (mismatch) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
  }
}

function buildTelegramMessage(payload, createdAt) {
  const attendance = formatAttendance(payload.attendance);
  const lines = [
    "Новая анкета гостя",
    "",
    "Имя: " + normalize(payload.guestName),
    "Присутствие: " + attendance,
    "Напитки: " + normalize(payload.drinkPreference || "-"),
    "Пожелание: " + normalize(payload.wish),
  ];
  return lines.join("\n");
}

function formatAttendance(value) {
  const normalized = normalize(value).toLowerCase();
  if (normalized === "yes") return "Да";
  if (normalized === "no") return "Нет";
  return normalize(value);
}

function sendTelegram(botToken, chatId, text) {
  const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  const body = {
    chat_id: chatId,
    text: text,
    disable_web_page_preview: true
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(body)
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("Telegram send failed with status " + code);
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function normalize(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
