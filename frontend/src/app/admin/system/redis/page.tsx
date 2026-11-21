import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="Redis Status"
      description="Redis connection and runtime status."
      endpoint="redis"
    />
  );
}
