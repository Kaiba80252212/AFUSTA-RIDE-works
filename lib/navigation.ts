import type { RideType } from './campus-transit';

export type PortalUserRole = 'STUDENT' | 'DRIVER' | null;

export function buildStudentBookPath(
  fromStopId: string,
  toStopId: string,
  rideType: RideType | string
): string {
  const qs = new URLSearchParams();
  if (fromStopId) qs.set('from', fromStopId);
  if (toStopId) qs.set('to', toStopId);
  if (rideType) qs.set('type', rideType);
  qs.set('tab', 'book');
  return `/student?${qs.toString()}`;
}

export function resolveBookingCtaHref(params: {
  authenticatedRole: PortalUserRole;
  fromStopId: string;
  toStopId: string;
  rideType: RideType | string;
}): string {
  const studentBookPath = buildStudentBookPath(
    params.fromStopId,
    params.toStopId,
    params.rideType
  );
  if (!params.authenticatedRole) {
    return `/login?next=${encodeURIComponent(studentBookPath)}`;
  }
  return studentBookPath;
}

export function resolvePortalHref(
  authenticatedRole: PortalUserRole,
  targetPortal: 'STUDENT' | 'DRIVER'
): string {
  const portalPath = targetPortal === 'DRIVER' ? '/driver' : '/student';
  if (authenticatedRole === targetPortal) {
    return portalPath;
  }
  if (authenticatedRole && authenticatedRole !== targetPortal) {
    return portalPath;
  }
  return `/login?next=${encodeURIComponent(portalPath)}`;
}
