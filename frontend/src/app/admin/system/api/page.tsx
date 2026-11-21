import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="API Health"
      description="API runtime, uptime, memory and environment status."
      endpoint="api"
    />
  );
}
