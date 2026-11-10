"use client";

import DeliveryWorkspaceCore from "@/components/admin/delivery/DeliveryWorkspace";

type Props = {
  assignmentMode?: boolean;
};

export default function ShippingFeatureWorkspace({
  assignmentMode = false,
}: Props) {
  return (
    <DeliveryWorkspaceCore
      kind="shipping"
      title={
        assignmentMode
          ? "Shipping Assignments"
          : "Shipping Management"
      }
      description={
        assignmentMode
          ? "Manage shipping rider assignments and review shipment records."
          : "Manage shipments, shipping providers, rider assignments and shipment progress."
      }
      assignmentMode={assignmentMode}
    />
  );
}
