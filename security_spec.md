# AFUSTA Ride — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny**: Any unmatched path under `/databases/{database}/documents` is denied for both reads and writes.
2. **Verified Identity**: Every authenticated read/write requires `request.auth != null` and `request.auth.token.email_verified == true`.
3. **No Self-Assigned Admin Privileges**: Clients can only create `/users/{userId}` with `role in ['STUDENT', 'DRIVER']`. Clients cannot write to `/admins/{adminId}` or escalate `role`.
4. **PII Isolation**: Sensitive fields (`email`, `phone`, `matricNo`, `licenseNo`, `walletBalance`) live strictly in `/users/{userId}/private/info`, gated by parent existence (`/users/{userId}`) and owner/admin identity.
5. **Immutable Identity & Timestamps**: `uid`, `studentId`, and `createdAt` cannot change after creation; `createdAt` and `updatedAt` must equal `request.time`.
6. **Terminal Ride Locking**: Rides in `Completed`, `Cancelled`, or `Declined` state cannot be modified by students or drivers.
7. **Strict Key Allowlists & Size Bounds**: Every create and update enforces `hasAll` / `hasOnly` / `affectedKeys().hasOnly(...)`, ID regex `^[a-zA-Z0-9_\-]+$`, and `.size()` caps on every string.
8. **Query Enforcement**: `allow list` rules evaluate `resource.data` directly against `request.auth.uid` without `get()` or `exists()` lookups.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unverified Email Spoof**: `{ "uid": "u1", "email": "abubakarmubarak141@gmail.com" }` with `email_verified: false` -> `PERMISSION_DENIED`.
2. **Self-Assigned Admin Role**: `POST /users/u1` with `{ "role": "ADMIN" }` -> `PERMISSION_DENIED`.
3. **Direct Admin Collection Write**: `POST /admins/u1` with `{ "uid": "u1", "role": "ADMIN" }` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Profile**: `POST /users/u1` with extra `{ "isSuperAdmin": true }` -> `PERMISSION_DENIED`.
5. **Wallet Balance Tampering**: `PATCH /users/u1/private/info` updating `walletBalance: 999999` -> `PERMISSION_DENIED`.
6. **Cross-User PII Read**: User `u2` attempting `GET /users/u1/private/info` -> `PERMISSION_DENIED`.
7. **Orphaned Private Info Write**: `POST /users/u1/private/info` when `/users/u1` does not exist -> `PERMISSION_DENIED`.
8. **ID Poisoning**: Document write at `/rides/../../evil` or 500-char ID -> `PERMISSION_DENIED`.
9. **Spoofed Student Ride Creation**: User `u2` creating `/rides/r1` with `studentId: "u1"` -> `PERMISSION_DENIED`.
10. **Client Timestamp Forgery**: Creating `/rides/r1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
11. **Terminal State Mutation**: Student or Driver updating `/rides/r1` when existing `status == "Completed"` -> `PERMISSION_DENIED`.
12. **Unfiltered Collection Scraping**: `LIST /rides` without matching `studentId == request.auth.uid` or `driverId == request.auth.uid` -> `PERMISSION_DENIED`.
