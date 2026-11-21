import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="System Health"
      description="Overall NOPTRIX service and dependency health."
      endpoint="overview"
    />
  );
}
