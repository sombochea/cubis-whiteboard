import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import DashboardView from "@/components/dashboard/dashboard-view";

export default async function WhiteboardsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <DashboardView
      userId={session.user.id}
      userName={session.user.name}
      userEmail={session.user.email}
      userImage={session.user.image}
    />
  );
}
