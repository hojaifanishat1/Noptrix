import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="Push Delivery"
      description="Push notification provider health status."
      endpoint="push"
    />
  );
}
