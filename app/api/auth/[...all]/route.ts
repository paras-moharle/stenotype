import { NextResponse } from "next/server";

// Stub — auth API routes require a real database (better-auth + Prisma).
// Until the DB is connected, all auth is handled client-side via lib/use-auth.
export const GET = () => NextResponse.json({ error: "auth under progress" }, { status: 501 });
export const POST = () => NextResponse.json({ error: "auth under progress" }, { status: 501 });
