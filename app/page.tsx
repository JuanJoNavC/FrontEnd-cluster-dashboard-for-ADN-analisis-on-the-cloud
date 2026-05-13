import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
        <h1 className="text-2xl font-semibold">Sistema Distribuido de Comparación de ADN</h1>
        <p className="mt-2 text-sm text-zinc-300">Plano de Control y Monitoreo de Cluster</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded bg-cyan-700 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-600"
        >
          Abrir Dashboard
        </Link>
      </div>
    </main>
  );
}
