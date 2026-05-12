import { redirect } from "next/navigation";

export default async function RunScopedDashboardPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  redirect(`/dashboard?runId=${runId}`);
}
