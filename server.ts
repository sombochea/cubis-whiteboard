import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { getIO } from "./src/lib/realtime/socket-server";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

// Don't pass httpServer to next() — let Next.js manage HMR internally
const app = next({ dev, hostname: "localhost", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url || "/", true));
  });

  // Attach Socket.IO — it registers its own upgrade handler for /api/socketio
  getIO(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
