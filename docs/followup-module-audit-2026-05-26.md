# Follow-Up Module Audit (2026-05-26)

## Trace Matrix (SRS 3.6)

| Use Case | API/Code Path | DB Tables | Result |
| --- | --- | --- | --- |
| Item Follow-Up | `GET /v2/followups/:itemType/:itemId/steps` -> `KayanService.listFollowupSteps` | `followup_steps`, ownership tables (`product_orders`, `fault_reports`, `service_orders`) | Implemented and verified |
| List Steps | same as above | same | Implemented and verified |
| Add Step | `POST /v2/admin/followups/:itemType/:itemId/steps` -> `KayanService.adminCreateFollowupStep` | `followup_steps` | Implemented and verified |
| Delete Step | `DELETE /v2/admin/followups/:itemType/:itemId/steps/:id` -> `KayanService.adminDeleteFollowupStep` | `followup_steps` | Implemented and verified |
| Update Step | `PATCH /v2/admin/followups/:itemType/:itemId/steps/:id` -> `KayanService.adminUpdateFollowupStep` | `followup_steps` | Implemented and verified |
| Item Chat | `POST /v2/followups/:itemType/:itemId/chat/conversations`, `GET/POST /v2/followups/:itemType/:itemId/chat/conversations/:id/messages` | `followup_conversations`, `followup_messages` | Implemented and verified |

## Gap Classification

| Classification | Items |
| --- | --- |
| Missing | None identified for SRS 3.6 scope |
| Partially compliant | Previously: item existence validation in privileged paths and admin target validation in follow-up chat creation. Resolved in this change set. |
| Implemented but untested | Previously: Follow-Up steps/chat service and controller paths. Resolved via new unit coverage. |
| Implemented and verified | Follow-Up steps CRUD/read, Follow-Up chat access controls, chat room emission behavior in Socket.io gateway. |

## Security/Behavior Decisions Verified

- Follow-Up step reads now require a valid target item for both users and admins.
- Follow-Up step create now requires a valid target item.
- Follow-Up conversation creation validates chosen `adminId` is an active admin user.
- Follow-Up messages remain restricted to conversation participants only.
- Socket.io chat join/send/read paths emit only to the conversation room and maintain participant checks.

## Linked Test Evidence

- `src/kayan/kayan.service.spec.ts`
- `src/kayan/kayan.controller.spec.ts`
- `src/chat/chat.service.spec.ts`
- `src/chat/chat.controller.spec.ts`
- `src/chat/chat.gateway.spec.ts`
