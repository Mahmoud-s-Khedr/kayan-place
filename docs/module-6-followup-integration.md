# Module 6 Integration: Follow-Up + Item Chat

## Endpoints

Canonical Module 6 routes use the `/v2/followups/...` family. Legacy `/v2/followup/...` routes are deprecated aliases only.

### User / Admin read

- `GET /v2/followups/{itemType}/{itemId}/steps`
  - Auth required.
  - User: allowed only for own item.
  - Admin: allowed for existing item only.
  - Returns steps ordered by `sort_order ASC, id ASC`.

### Admin step management

- `POST /v2/admin/followups/{itemType}/{itemId}/steps`
- `PATCH /v2/admin/followups/{itemType}/{itemId}/steps/{stepId}`
- `DELETE /v2/admin/followups/{itemType}/{itemId}/steps/{stepId}`
  - Admin JWT required.
  - Create validates referenced item exists.
  - Update/Delete return `404` when step does not exist.

### Follow-up item chat (REST)

- `POST /v2/followups/{itemType}/{itemId}/chat/conversations`
  - Auth required.
  - Requester must own the target item unless requester is admin.
  - One conversation per `(itemType, itemId, userId)`; repeated create is idempotent.
  - `adminId` is optional; when passed, it must reference an active admin user.
  - If no `adminId`, server selects first active admin by ascending id.

- `GET /v2/followups/{itemType}/{itemId}/chat/conversations/{conversationId}/messages`
- `POST /v2/followups/{itemType}/{itemId}/chat/conversations/{conversationId}/messages`
  - Auth required.
  - Access limited to conversation `user_id` and `admin_id` only.
  - Non-participants receive `403`.
  - Missing conversation returns `404`.

## Security Rules

- Follow-up steps are scoped to a valid item, and item ownership is enforced for non-admins.
- Follow-up REST chat access is limited to conversation participants (`user_id`, `admin_id`) only.
- Generic Socket.io chat (`/chat`) keeps independent participant checks for conversation join/send/read.

## Deprecated aliases (transition window)

- `GET /v2/followup/steps?itemType=...&itemId=...`
- `POST /v2/admin/followup-steps`
- `PATCH /v2/admin/followup-steps/:id`
- `DELETE /v2/admin/followup-steps/:id`
- `POST /v2/followup/chat/conversations`
- `GET /v2/followup/chat/conversations/:id/messages`
- `POST /v2/followup/chat/conversations/:id/messages`

Deprecated aliases emit deprecation headers and are scheduled for removal after the transition cycle (sunset date: 2026-12-31).

## Testing References

- Follow-Up service and controller tests:
  - `src/kayan/kayan.service.spec.ts`
  - `src/kayan/kayan.controller.spec.ts`
- Real-time chat tests:
  - `src/chat/chat.service.spec.ts`
  - `src/chat/chat.controller.spec.ts`
  - `src/chat/chat.gateway.spec.ts`
