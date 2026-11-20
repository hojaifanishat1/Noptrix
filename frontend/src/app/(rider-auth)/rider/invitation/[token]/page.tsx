import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function RiderInvitationRedirect({
  params,
}: PageProps) {
  const { token } = await params;

  redirect(`/rider-invitation/${encodeURIComponent(token)}`);
}
