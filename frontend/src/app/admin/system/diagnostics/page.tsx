import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="System Diagnostics"
      description="Runtime, database, Redis and queue diagnostics."
      endpoint="diagnostics"
    />
  );
}
