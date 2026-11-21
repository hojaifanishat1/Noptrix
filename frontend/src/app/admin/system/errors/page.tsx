import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="Error Monitoring"
      description="Recent ERROR and FATAL system logs."
      endpoint="errors"
    />
  );
}
