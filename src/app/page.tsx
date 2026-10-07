import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";

export default async function HomePage() {
  const authed = await verifySession();
  if (authed) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
