import { ChunksTable } from "@/components/dashboard/ChunksTable";
import { ClusterHeader } from "@/components/dashboard/ClusterHeader";
import { ClusterTopology } from "@/components/dashboard/ClusterTopology";
import { CommandPanel } from "@/components/dashboard/CommandPanel";
import { EventLog } from "@/components/dashboard/EventLog";
import { ProgressPanel } from "@/components/dashboard/ProgressPanel";
import { RunOverviewCards } from "@/components/dashboard/RunOverviewCards";
import { mockDashboardSnapshot } from "@/features/dashboard/mockData";

// Phase 1 boundary: this page renders mock-only snapshot data.
// Future phases should fetch DashboardSnapshot via API contract.
export default function DashboardPage() {
  const snapshot = mockDashboardSnapshot;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-slate-950 to-zinc-900 px-4 py-6 text-zinc-100 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <ClusterHeader snapshot={snapshot} />
        <RunOverviewCards snapshot={snapshot} />
        <ProgressPanel snapshot={snapshot} />
        <ClusterTopology snapshot={snapshot} />
        <ChunksTable chunks={snapshot.chunks} />
        <EventLog events={snapshot.events} />
        <CommandPanel />
      </div>
    </main>
  );
}
