import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import AdsEvalClient from "./components/AdsEvalClient";

export default async function AdsEvalPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");
  return <AdsEvalClient />;
}
