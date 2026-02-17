import { createServer } from "http";
import next from "next";
import { getIO } from "./src/lib/realtime/socket-server";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = getIO(httpServer);

  // Socket.IO must handle WebSocket upgrades BEFORE Next.js consumes them
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/api/socketio")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      io.engine.handleUpgrade(req as any, socket, head);
    }
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
