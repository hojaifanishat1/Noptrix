import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="SMS Delivery"
      description="SMS provider configuration and health status."
      endpoint="sms"
    />
  );
}
