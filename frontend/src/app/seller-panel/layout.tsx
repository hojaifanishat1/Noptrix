import type { ReactNode } from "react";
import { SellerAuthProvider } from "@/providers/SellerAuthProvider";

export default function SellerPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <SellerAuthProvider>{children}</SellerAuthProvider>;
}
