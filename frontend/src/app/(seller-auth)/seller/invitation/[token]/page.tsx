import SellerInvitationForm from "@/features/auth/seller/seller-invitation-form";

export default async function SellerInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <SellerInvitationForm token={token} />;
}
