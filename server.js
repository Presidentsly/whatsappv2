const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./session" }), // ← itt tárolja a sessiont
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
});

let chats = {}; // ha szeretnél több chatet, ide lehet menteni

// QR kód küldése a frontendnek
client.on("qr", qr => {
    io.emit("qr", qr);
});

// Ready
client.on("ready", () => {
    io.emit("ready");
});

// Bejövő üzenetek
client.on("message", async msg => {
    let mediaUrl = null;

    if(msg.hasMedia){
        const media = await msg.downloadMedia();
        mediaUrl = `data:${media.mimetype};base64,${media.data}`;
    }

    io.emit("message", {
        from: msg.from.replace("@c.us",""),
        body: msg.body,
        media: mediaUrl
    });
});

// Frontend → WhatsApp
io.on("connection", socket => {
    socket.on("sendMessage", async ({to, text}) => {
        await client.sendMessage(to, text);
    });
});

client.initialize();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
