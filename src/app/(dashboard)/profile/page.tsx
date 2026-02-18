import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import ProfileView from "@/components/dashboard/profile-view";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <ProfileView
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        createdAt: session.user.createdAt.toISOString(),
      }}
    />
  );
}
