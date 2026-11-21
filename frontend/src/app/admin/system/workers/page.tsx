import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="Worker Monitoring"
      description="Background worker runtime status."
      endpoint="workers"
    />
  );
}
