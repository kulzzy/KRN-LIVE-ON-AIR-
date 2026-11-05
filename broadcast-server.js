const http = require("http");
const WebSocket = require("ws");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 8080;

const ADMIN_PASSWORD = process.env.BROADCAST_PASSWORD;
const SOURCE_PASSWORD = process.env.ICECAST_SOURCE_PASSWORD;

const ICECAST_HOST = "kulzzy-radio-server";
const ICECAST_PORT = 8000;
const ICECAST_MOUNT = "/kulzzy.mp3";

if (!ADMIN_PASSWORD || !SOURCE_PASSWORD) {
    throw new Error("Broadcast passwords are required.");
}

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
        station: "KULZZY RADIO",
        service: "Broadcast Engine",
        status: "READY"
    }));
});

const wss = new WebSocket.Server({
    noServer: true,
    maxPayload: 1024 * 1024
});

let activeBroadcaster = null;

server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/broadcast") {
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, ws => {
        wss.emit("connection", ws, req);
    });
});

wss.on("connection", ws => {

    let authenticated = false;
    let ffmpeg = null;

    function send(type, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type,
                message
            }));
        }
    }

    function stopBroadcast() {

        if (ffmpeg) {
            ffmpeg.stdin.end();
            ffmpeg.kill("SIGTERM");
            ffmpeg = null;
        }

        if (activeBroadcaster === ws) {
            activeBroadcaster = null;
        }
    }

    ws.on("message", (data, isBinary) => {

        if (!authenticated) {

            if (isBinary) {
                ws.close(1008, "Authentication required");
                return;
            }

            let login;

            try {
                login = JSON.parse(data.toString());
            } catch {
                ws.close(1008, "Invalid login");
                return;
            }

            if (
                login.type !== "authenticate" ||
                login.password !== ADMIN_PASSWORD
            ) {
                ws.close(1008, "Access denied");
                return;
            }

            if (activeBroadcaster) {
                send("error", "Another presenter is already broadcasting.");
                ws.close();
                return;
            }

            authenticated = true;
            activeBroadcaster = ws;

            const destination =
                `icecast://source:${encodeURIComponent(SOURCE_PASSWORD)}` +
                `@${ICECAST_HOST}:${ICECAST_PORT}${ICECAST_MOUNT}`;

            ffmpeg = spawn("ffmpeg", [
                "-hide_banner",
                "-loglevel", "error",

                "-f", "webm",
                "-i", "pipe:0",

                "-vn",
                "-c:a", "libmp3lame",
                "-b:a", "128k",
                "-ar", "44100",
                "-ac", "2",

                "-content_type", "audio/mpeg",
                "-f", "mp3",

                destination
            ]);

            ffmpeg.on("error", error => {
                send("error", "Audio engine could not start.");
                stopBroadcast();
            });

            ffmpeg.stderr.on("data", data => {
                console.error("FFmpeg:", data.toString());
            });

            ffmpeg.on("close", () => {
                send("stopped", "Broadcast ended.");
                stopBroadcast();
                ws.close();
            });

            send("ready", "Broadcast connection established.");
            return;
        }

        if (isBinary && ffmpeg && ffmpeg.stdin.writable) {
            ffmpeg.stdin.write(data);
        }

        if (!isBinary) {

            try {
                const command = JSON.parse(data.toString());

                if (command.type === "stop") {
                    stopBroadcast();
                    ws.close();
                }

            } catch {}
        }

    });

    ws.on("close", stopBroadcast);

    ws.on("error", stopBroadcast);

});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Kulzzy Broadcast Engine running on ${PORT}`);
});
