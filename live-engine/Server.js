const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const BROADCAST_PASSWORD = process.env.BROADCAST_PASSWORD || "";
const SOURCE_PASSWORD = process.env.ICECAST_SOURCE_PASSWORD || "";

let ffmpeg = null;
let activeSocket = null;

const server = http.createServer((req, res) => {

    const requestPath = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    // STUDIO PAGE
    if (requestPath === "/" || requestPath === "/studio") {

        const studioFile = path.join(__dirname, "Studio.html");

        if (!fs.existsSync(studioFile)) {
            res.writeHead(404);
            return res.end("Studio page not found");
        }

        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
        });

        return fs.createReadStream(studioFile).pipe(res);
    }

    // HEALTH CHECK
    if (requestPath === "/health") {

        res.writeHead(200, {
            "Content-Type": "text/plain",
            "Cache-Control": "no-store"
        });

        return res.end("Kulzzy Live is running");
    }

    // PUBLIC LIVE AUDIO STREAM
    if (
        requestPath === "/kulzzy.mp3" ||
        requestPath === "/listen"
    ) {

        const upstream = http.request({
            hostname: "127.0.0.1",
            port: 8000,
            path: "/kulzzy.mp3",
            method: "GET",
            headers: {
                "User-Agent": "Kulzzy-Radio-Player",
                "Accept": "*/*"
            }
        }, upstreamResponse => {

            res.writeHead(
                upstreamResponse.statusCode || 200,
                upstreamResponse.headers
            );

            upstreamResponse.pipe(res);

            upstreamResponse.on("error", () => {
                if (!res.destroyed) {
                    res.destroy();
                }
            });

        });

        upstream.on("error", error => {

            console.error(
                "Icecast connection error:",
                error.message
            );

            if (!res.headersSent) {
                res.writeHead(503, {
                    "Content-Type": "text/plain",
                    "Cache-Control": "no-store"
                });

                res.end("Kulzzy Radio is currently offline.");
            } else if (!res.destroyed) {
                res.destroy();
            }

        });

        // IMPORTANT:
        // Only terminate Icecast when the LISTENER disconnects.
        res.on("close", () => {

            if (!res.writableEnded) {
                upstream.destroy();
            }

        });

        upstream.end();

        return;
    }

    res.writeHead(404);
    res.end("Not found");

});


// WEBSOCKET BROADCAST SERVER
const wss = new WebSocket.Server({
    noServer: true,
    maxPayload: 2 * 1024 * 1024
});


// WEBSOCKET UPGRADE
server.on("upgrade", (req, socket, head) => {

    const url = new URL(req.url, "http://localhost");

    if (url.pathname !== "/broadcast") {
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, ws => {
        wss.emit("connection", ws, req, url);
    });

});


// BROADCAST CONNECTION
wss.on("connection", (ws, req, url) => {

    const suppliedPassword =
        url.searchParams.get("password") || "";

    if (
        !BROADCAST_PASSWORD ||
        suppliedPassword !== BROADCAST_PASSWORD
    ) {
        ws.close(1008, "Incorrect studio password");
        return;
    }

    if (
        activeSocket &&
        activeSocket.readyState === WebSocket.OPEN
    ) {
        ws.close(1013, "Another presenter is already live");
        return;
    }

    if (!SOURCE_PASSWORD) {
        ws.close(1011, "Broadcast configuration missing");
        return;
    }

    activeSocket = ws;

    const outputUrl =
        "icecast://source:" +
        encodeURIComponent(SOURCE_PASSWORD) +
        "@127.0.0.1:8000/kulzzy.mp3";

    const encoder = spawn("ffmpeg", [
        "-hide_banner",
        "-loglevel", "error",
        "-f", "webm",
        "-i", "pipe:0",
        "-vn",
        "-ac", "2",
        "-ar", "44100",
        "-b:a", "128k",
        "-content_type", "audio/mpeg",
        "-f", "mp3",
        outputUrl
    ], {
        stdio: ["pipe", "ignore", "pipe"]
    });

    ffmpeg = encoder;

    let stopped = false;

    encoder.stderr.on("data", data => {
        console.error("FFmpeg:", data.toString());
    });

    encoder.on("error", error => {

        console.error(
            "FFmpeg error:",
            error.message
        );

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "error",
                message: "Audio encoder could not start."
            }));
        }

        ws.close();
    });

    encoder.on("close", (code) => {

        console.log("FFmpeg stopped:", code);

        if (ffmpeg === encoder) {
            ffmpeg = null;
        }

        if (activeSocket === ws) {
            activeSocket = null;
        }

    });

    ws.send(JSON.stringify({
        type: "connected"
    }));

    ws.on("message", (data, isBinary) => {

        if (
            isBinary &&
            !stopped &&
            encoder.stdin.writable &&
            !encoder.stdin.destroyed
        ) {
            encoder.stdin.write(data);
        }

    });

    const stopBroadcast = () => {

        if (stopped) return;

        stopped = true;

        if (encoder.stdin.writable) {
            encoder.stdin.end();
        }

        setTimeout(() => {

            if (!encoder.killed && encoder.exitCode === null) {
                encoder.kill("SIGTERM");
            }

        }, 3000).unref();

    };

    ws.on("close", stopBroadcast);
    ws.on("error", stopBroadcast);

});


// START SERVER
server.listen(PORT, "0.0.0.0", () => {

    console.log(
        "Kulzzy Live running on port " + PORT
    );

});
