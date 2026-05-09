import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import express from "express";
import Redis from "ioredis";
import pino from "pino";
import QRCode from "qrcode";

const port = Number(process.env.PORT || 3000);
const redisUrl = process.env.REDIS_URL || "redis://cache:6379/0";
const authDir = process.env.WHATSAPP_AUTH_DIR || "/app/auth";

const app = express();
const subscriber = new Redis(redisUrl);

let latestQr = null;
let connectionStatus = "starting";
let socket = null;
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

app.get("/wa/status", (_request, response) => {
  response.json({ status: connectionStatus });
});

app.get("/wa/qr", (_request, response) => {
  response.json({ qr: latestQr });
});

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  socket = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    logger: pino({ level: "silent" })
  });

  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      latestQr = await QRCode.toDataURL(qr);
      connectionStatus = "qr_ready";
    }
    if (connection) {
      connectionStatus = connection;
      if (connection === "open") {
        latestQr = null;
      }
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      connectionStatus = shouldReconnect ? "reconnecting" : "logged_out";
      if (shouldReconnect) {
        setTimeout(() => startSocket().catch((error) => logger.error(error)), 1500);
      }
    }
  });
}

async function sendWhatsAppMessage(phone, message) {
  if (!socket || connectionStatus !== "open") {
    throw new Error("WhatsApp socket is not connected");
  }
  const normalized = String(phone).replace(/[^\d]/g, "");
  if (!normalized) {
    throw new Error("Missing phone number");
  }
  await socket.sendMessage(`${normalized}@s.whatsapp.net`, { text: String(message) });
}

subscriber.subscribe("whatsapp_outbound", (error) => {
  if (error) {
    connectionStatus = "redis_error";
    logger.error({ error }, "Failed to subscribe to whatsapp_outbound");
  }
});

subscriber.on("message", async (_channel, payload) => {
  try {
    const parsed = JSON.parse(payload);
    await sendWhatsAppMessage(parsed.phone, parsed.message);
    logger.info({ phone: parsed.phone }, "WhatsApp message sent");
  } catch (error) {
    logger.error({ error, payload }, "Failed to process whatsapp_outbound payload");
  }
});

app.listen(port, () => {
  logger.info(`WhatsApp sidecar listening on ${port}`);
});

startSocket().catch((error) => {
  connectionStatus = "start_failed";
  logger.error({ error }, "Failed to start Baileys socket");
});
