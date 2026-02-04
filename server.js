const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal"); // ← QR ASCII generáláshoz

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statikus fájlok a public mappából
app.use(express.static("public"));

// =========================
// WHATSAPP CLIENT
// =========================
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./session/session" }), // <-- gitben lévő mappa
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
});

// =========================
// SOCKET.IO & ÜZENETEK
// =========================
io.on("connection", socket => {
    console.log("🌐 Web kliens csatlakozott");

    // Frontend → WhatsApp üzenetküldés
    socket.on("sendMessage", async ({ to, text }) => {
        try {
            await client.sendMessage(to, text);
        } catch (err) {
            console.log("Send hiba:", err.message);
        }
    });
});

// =========================
// WHATSAPP ESEMÉNYEK
// =========================

// QR kód (csak ha nincs session)
client.on("qr", qr => {
    console.log("📱 QR generálva (ASCII a logban):");
    qrcode.generate(qr, { small: true }); // ASCII QR a logba
    io.emit("qr", qr); // ha van frontend, oda is küldjük
});

// Ready
client.on("ready", () => {
    console.log("✅ WhatsApp csatlakozott");
    io.emit("ready");
});

// Auth hiba
client.on("auth_failure", msg => {
    console.log("❌ Auth hiba:", msg);
});

// Disconnect
client.on("disconnected", reason => {
    console.log("⚠️ WA disconnected:", reason);
});

// Bejövő üzenetek (szöveg + képek/GIF)
client.on("message", async msg => {
    let mediaUrl = null;

    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            if (media && (media.mimetype.startsWith("image") || media.mimetype === "image/gif")) {
                mediaUrl = `data:${media.mimetype};base64,${media.data}`;
            }
        } catch (e) {
            console.log("Media hiba:", e.message);
        }
    }

    io.emit("message", {
        from: msg.from.replace("@c.us", ""),
        body: msg.body,
        media: mediaUrl,
        t: Date.now()
    });
});

// =========================
// START SERVER
// =========================
client.initialize();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
