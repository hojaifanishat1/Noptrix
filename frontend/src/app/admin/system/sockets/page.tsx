import SystemMonitoringPage from "@/features/system-monitoring/system-monitoring-page";

export default function Page() {
  return (
    <SystemMonitoringPage
      title="Socket Connections"
      description="Realtime socket server and connection status."
      endpoint="sockets"
    />
  );
}
