import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { getIO } from "./src/lib/realtime/socket-server";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname: "localhost", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Let Socket.IO handle its own polling requests
    if (req.url?.startsWith("/api/socketio")) return;
    handle(req, res, parse(req.url || "/", true));
  });

  // Attach Socket.IO — handles both polling and websocket upgrade
  getIO(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
