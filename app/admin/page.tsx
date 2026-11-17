import { ForbiddenView } from '@/components/ForbiddenView';

export const dynamic = 'force-dynamic';

export default function BlockedAdminRoutePage() {
  return (
    <ForbiddenView
      title="403 — Access Restricted"
      message="You do not have permission to access this endpoint."
      backHref="/"
      backLabel="Return Home"
    />
  );
}
