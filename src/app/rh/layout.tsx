import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { validateSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/ui/PageTransition";
import { db } from "@/lib/db/client";
import { userTenantMappings, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

async function getUserData(userId: string, tenantId: string) {
  const [userData] = await db
    .select({ 
      name: users.name,
      role: userTenantMappings.role 
    })
    .from(users)
    .innerJoin(userTenantMappings, eq(users.id, userTenantMappings.userId))
    .where(
      and(
        eq(users.id, userId),
        eq(userTenantMappings.tenantId, tenantId)
      )
    )
    .limit(1);

  return userData;
}

export default async function RHLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await validateSession(token);
  if (!session) {
    redirect("/login");
  }

  const userData = await getUserData(session.userId, session.tenantId);

  const rhRoles = ["rh_gestor", "rh_operator", "suporte", "admin_plataforma", "rh"];
  if (!userData || !rhRoles.includes(userData.role)) {
     if (userData?.role === "colaborador") {
       redirect("/documents");
     }
     redirect("/login");
  }

  return (
    <AppShell 
      userRole="rh" 
      userName={userData?.name || "Gestor RH"}
      hasAccessToBoth={true}
      tenantRole={userData?.role}
    >
      <PageTransition>{children}</PageTransition>
    </AppShell>
  );
}
