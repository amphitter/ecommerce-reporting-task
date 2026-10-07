import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "nexusops_session";
const PROTECTED_PATHS = ["/dashboard", "/orders", "/products", "/inventory", "/reports", "/admin", "/api/dashboard", "/api/orders", "/api/products", "/api/inventory", "/api/exports", "/api/import", "/api/filter-options"];

async function isAuthed(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const secret = process.env.SESSION_SECRET || "nexusops-dev-secret-change-in-production-32bytesmin";
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));

  if (isProtected) {
    const authed = await isAuthed(request);
    if (!authed) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname === "/login") {
    const authed = await isAuthed(request);
    if (authed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname === "/") {
    const authed = await isAuthed(request);
    if (authed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
