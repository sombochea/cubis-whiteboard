import { NextResponse } from "next/server";

// Socket.IO is initialized via the custom server (server.ts).
// This route exists as a placeholder for the Next.js router.
export function GET() {
  return NextResponse.json({ error: "Socket.IO runs on the custom server" }, { status: 400 });
}
