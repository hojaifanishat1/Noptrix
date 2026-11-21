import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="Queue Monitoring"
      description="Background job queue counts and processing status."
      endpoint="queues"
    />
  );
}
