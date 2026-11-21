import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="Database Status"
      description="MongoDB connectivity and database response status."
      endpoint="database"
    />
  );
}
