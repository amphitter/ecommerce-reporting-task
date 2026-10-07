import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation/schemas";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, recordFailedAttempt, resetAttempts } from "@/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${Math.ceil((rl.retryAfter || 60) / 60)} minutes.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const validId = process.env.ADMIN_ID || "admin";
    const validPass = process.env.ADMIN_PASSWORD;

    if (!validPass) {
      return NextResponse.json({ error: "Server authentication not configured" }, { status: 500 });
    }

    const { adminId, password } = parsed.data;

    if (adminId !== validId || password !== validPass) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    resetAttempts(ip);
    await createSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
