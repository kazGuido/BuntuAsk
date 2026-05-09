import express from "express";
import Redis from "ioredis";

const port = Number(process.env.PORT || 3000);
const redisUrl = process.env.REDIS_URL || "redis://cache:6379/0";

const app = express();
const subscriber = new Redis(redisUrl);

let latestQr = null;
let connectionStatus = "scaffold";

app.get("/wa/status", (_request, response) => {
  response.json({ status: connectionStatus });
});

app.get("/wa/qr", (_request, response) => {
  response.json({ qr: latestQr });
});

subscriber.subscribe("whatsapp_outbound", (error) => {
  if (error) {
    connectionStatus = "redis_error";
    console.error("Failed to subscribe to whatsapp_outbound", error);
  }
});

subscriber.on("message", (_channel, payload) => {
  // Phase 4 wires this scaffold to Baileys; for now the sidecar proves service topology.
  console.log("Received whatsapp_outbound payload", payload);
});

app.listen(port, () => {
  console.log(`WhatsApp sidecar scaffold listening on ${port}`);
});
