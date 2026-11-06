const http = require("http"); const fs = require("fs"); const path = require("path"); const { spawn } = require("child_process"); const WebSocket = require("ws");
const PORT = process.env.PORT || 3000; const BROADCAST_PASSWORD = process.env.BROADCAST_PASSWORD || ""; const SOURCE_PASSWORD = process.env.ICECAST_SOURCE_PASSWORD || "";
let ffmpeg = null; let activeSocket = null;
const server = http.createServer((req, res) => { if (req.url === "/" || req.url === "/studio") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); return fs.createReadStream(path.join(__dirname, "Studio.html")).pipe(res); }
if (req.url === "/health") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("Kulzzy Live is running"); }
if (req.url === "/kulzzy.mp3" || req.url === "/listen") { const upstream = http.request({ hostname: "127.0.0.1", port: 8000, path: "/kulzzy.mp3", method: "GET" }, upstreamResponse => { res.writeHead(upstreamResponse.statusCode || 200, upstreamResponse.headers); upstreamResponse.pipe(res); });
upstream.on("error", () => {
  if (!res.headersSent) {
    res.writeHead(503, { "Content-Type": "text/plain" });
  }
  res.end("Kulzzy Radio is currently offline.");
});

req.on("close", () => upstream.destroy());
upstream.end();
return;
}
res.writeHead(404); res.end("Not found"); });
const wss = new WebSocket.Server({ noServer: true, maxPayload: 2 * 1024 * 1024 });
server.on("upgrade", (req, socket, head) => { const url = new URL(req.url, "http://localhost");
if (url.pathname !== "/broadcast") { socket.destroy(); return; }
wss.handleUpgrade(req, socket, head, ws => { wss.emit("connection", ws, req, url); }); });
wss.on("connection", (ws, req, url) => { const suppliedPassword = url.searchParams.get("password") || "";
if (!BROADCAST_PASSWORD || suppliedPassword !== BROADCAST_PASSWORD) { ws.close(1008, "Incorrect studio password"); return; }
if (activeSocket && activeSocket.readyState === WebSocket.OPEN) { ws.close(1013, "Another presenter is already live"); return; }
if (!SOURCE_PASSWORD) { ws.close(1011, "Broadcast configuration missing"); return; }
activeSocket = ws;
const outputUrl = "icecast://source:" + encodeURIComponent(SOURCE_PASSWORD) + "@127.0.0.1:8000/kulzzy.mp3";
ffmpeg = spawn("ffmpeg", [ "-hide_banner", "-loglevel", "error", "-f", "webm", "-i", "pipe:0", "-vn", "-ac", "2", "-ar", "44100", "-b:a", "128k", "-content_type", "audio/mpeg", "-f", "mp3", outputUrl ], { stdio: ["pipe", "ignore", "pipe"] });
ffmpeg.stderr.on("data", data => { console.error("FFmpeg:", data.toString()); });
ffmpeg.on("error", error => { console.error("FFmpeg error:", error.message); if (ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ type: "error", message: "Audio encoder could not start." })); } ws.close(); });
ffmpeg.on("close", () => { if (activeSocket === ws) activeSocket = null; ffmpeg = null; });
ws.send(JSON.stringify({ type: "connected" }));
ws.on("message", (data, isBinary) => { if (isBinary && ffmpeg && ffmpeg.stdin.writable) { ffmpeg.stdin.write(data); } });
const stopBroadcast = () => { if (ffmpeg) { const process = ffmpeg; ffmpeg = null;
  try {
    process.stdin.end();
  } catch (error) {}

  setTimeout(() => {
    if (!process.killed) process.kill("SIGTERM");
  }, 3000).unref();
}

if (activeSocket === ws) activeSocket = null;
};
ws.on("close", stopBroadcast); ws.on("error", stopBroadcast); });
server.listen(PORT, "0.0.0.0", () => { console.log("Kulzzy Live running on port " + PORT); });
