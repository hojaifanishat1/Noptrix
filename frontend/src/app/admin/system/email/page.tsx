import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="Email Delivery"
      description="Email provider configuration and health status."
      endpoint="email"
    />
  );
}
