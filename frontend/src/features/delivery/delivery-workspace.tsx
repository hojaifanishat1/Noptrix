"use client";

import DeliveryWorkspaceCore from "@/components/admin/delivery/DeliveryWorkspace";

type Props = {
  assignmentMode?: boolean;
};

export default function DeliveryFeatureWorkspace({
  assignmentMode = false,
}: Props) {
  return (
    <DeliveryWorkspaceCore
      kind="deliveries"
      title={
        assignmentMode
          ? "Delivery Assignments"
          : "Delivery Management"
      }
      description={
        assignmentMode
          ? "Manage delivery rider assignments and review delivery records."
          : "Manage deliveries, update delivery progress, assign riders and handle cancellations."
      }
      assignmentMode={assignmentMode}
    />
  );
}
