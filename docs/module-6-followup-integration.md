# Module 6 Integration Guide: Follow-Up and Item Chat

## Purpose

This guide covers:

- follow-up step reads for item owners and admins
- admin follow-up step CRUD
- follow-up conversation creation
- follow-up message history and sending over REST
- item chat over Socket.io `/chat`

Shared contract:

- [frontend-integration-shared-contract.md](./frontend-integration-shared-contract.md)

## Supported Item Types

All follow-up routes use one of:

- `order`
- `fault`
- `service`

Canonical routes are only under `/api/followups/...`.

This guide intentionally does not document deprecated aliases because they are not present in the current code/openapi surface.

## Flow-by-Flow Implementation

### Load Follow-Up Steps

1. Resolve the target item type and item ID.
2. Call `GET /api/followups/:itemType/:itemId/steps`.
3. Render returned steps in backend order.

Ordering rule:

- steps are sorted by `sort_order ASC`, then `id ASC`

### Admin Create/Update/Delete Steps

1. Admin creates a step with `POST /api/admin/followups/:itemType/:itemId/steps`.
2. Admin updates a step with `PATCH /api/admin/followups/:itemType/:itemId/steps/:id`.
3. Admin deletes a step with `DELETE /api/admin/followups/:itemType/:itemId/steps/:id`.

### Create or Reuse Follow-Up Conversation

1. User or admin calls `POST /api/followups/:itemType/:itemId/chat/conversations`.
2. Backend returns a single conversation for the tuple `(itemType, itemId, userId)`.
3. Repeated calls are idempotent and may update the assigned `admin_id`.

### Load and Send REST Messages

1. Call `GET /api/followups/:itemType/:itemId/chat/conversations/:id/messages`.
2. Render `data.items[]`.
3. Send new messages with `POST /api/followups/:itemType/:itemId/chat/conversations/:id/messages`.

### Join Real-Time Chat

Recommended frontend sequence:

1. Create or fetch the follow-up conversation through REST.
2. Load REST message history for the conversation.
3. Open Socket.io connection to namespace `/chat` with bearer token.
4. Emit `conversation.join` with `conversationId`.
5. Listen for `conversation.joined`.
6. When user sends a message:
   - emit `message.send`
   - optimistically wait for ack or the broadcasted `message.received`
7. When marking a message as read:
   - emit `message.read`
   - update local state from ack or broadcast event

## REST Endpoint Contract

### `GET /api/followups/:itemType/:itemId/steps`

Auth: bearer token required

Access:

- regular user: only for own order/fault/service
- admin: any existing target item

Success:

- `200`
- `data.items[]`

Step fields:

- `id`
- `item_type`
- `item_id`
- `title`
- `step_image_file_id`
- `sort_order`
- `created_at`

Possible errors:

- `403`: authenticated user does not own the item
- `404`: target item not found

### `POST /api/admin/followups/:itemType/:itemId/steps`

Auth: admin bearer token required

Request:

```json
{
  "title": "Technician assigned",
  "stepImageFileId": 55,
  "sortOrder": 1
}
```

Validation:

- `title`: required non-empty string
- `stepImageFileId`: optional integer, min `1`
- `sortOrder`: optional integer, min `0`

Success:

- `201`
- `data.step`

Errors:

- `404`: target item not found

### `PATCH /api/admin/followups/:itemType/:itemId/steps/:id`

Auth: admin bearer token required

Editable fields:

- `title`
- `stepImageFileId`
- `sortOrder`

Success:

- `200`
- `data.step`

Errors:

- `404`: step not found

### `DELETE /api/admin/followups/:itemType/:itemId/steps/:id`

Auth: admin bearer token required

Success:

- `200`
- message envelope

Errors:

- `404`: step not found

### `POST /api/followups/:itemType/:itemId/chat/conversations`

Auth: bearer token required

Request:

```json
{
  "adminId": 3
}
```

`adminId` is optional.

Behavior:

- if `adminId` is omitted, the backend selects the first active admin by ascending ID
- if a conversation already exists for `(itemType, itemId, userId)`, the call is idempotent
- the returned conversation includes:
  - `id`
  - `item_type`
  - `item_id`
  - `user_id`
  - `admin_id`

Access rules:

- regular user must own the target item
- admin can access existing items

Errors:

- `400`: no admin account available or invalid `adminId`
- `403`: user does not own item
- `404`: target item not found

### `GET /api/followups/:itemType/:itemId/chat/conversations/:id/messages`

Auth: bearer token required

Access:

- only the conversation `user_id` and `admin_id`

Success:

- `200`
- `data.items[]`

Message fields:

- `id`
- `conversation_id`
- `sender_id`
- `message_text`
- `sent_at`

Errors:

- `403`: authenticated non-participant
- `404`: conversation not found or route scope does not match conversation scope

### `POST /api/followups/:itemType/:itemId/chat/conversations/:id/messages`

Auth: bearer token required

Request:

```json
{
  "messageText": "Technician is on the way."
}
```

Validation:

- `messageText`: required non-empty string

Success:

- `201`
- `data.message`

Errors:

- `403`: authenticated non-participant
- `404`: conversation not found or route scope mismatch

## WebSocket Contract

Namespace:

- `/chat`

Authentication:

- supported in `handshake.auth.token`
- supported in `Authorization` header
- token may include or omit the `Bearer ` prefix

If auth fails, the socket is disconnected.

### Outbound Client Events

#### `conversation.join`

Payload:

```json
{
  "conversationId": 44
}
```

Validation:

- `conversationId`: integer, min `1`

Ack shape:

```json
{
  "success": true,
  "room": "conversation:44"
}
```

#### `message.send`

Payload:

```json
{
  "conversationId": 44,
  "text": "ws-admin-order-171234"
}
```

Validation:

- `conversationId`: integer, min `1`
- `text`: string, length `1-4000`

Ack shape:

```json
{
  "success": true,
  "message": {
    "id": 501,
    "conversation_id": 44,
    "sender_id": 3,
    "message_text": "ws-admin-order-171234",
    "sent_at": "2026-03-28T12:00:00.000Z"
  }
}
```

#### `message.read`

Payload:

```json
{
  "messageId": 501
}
```

Validation:

- `messageId`: integer, min `1`

Ack shape:

```json
{
  "success": true,
  "message": {
    "id": 501
  }
}
```

### Inbound Server Events

#### `conversation.joined`

Broadcast to the conversation room after join.

Use it to confirm room membership and refresh conversation state.

#### `message.received`

Broadcast after a participant sends a message.

Expected payload shape mirrors the `message.send` ack:

- `success`
- `message`

#### `message.read`

Broadcast after a participant marks a message as read.

Use it to update read state for both participants.

#### `exception`

Error event used by the WebSocket exception filter.

Frontend should treat it as a structured transport error. Common causes:

- validation failure
- unauthorized socket usage
- forbidden conversation access
- conversation or message not found

## Error Handling

- REST `400`: invalid body, no admin available, invalid selected admin
- REST `403`: item ownership failure or non-participant access
- REST `404`: missing item, missing step, missing conversation, or route-scope mismatch
- WS `exception`: validation, auth, authorization, or missing-resource problems

## QA Checklist

- User can load follow-up steps for own order, fault, and service.
- Admin can create, update, and delete follow-up steps.
- Conversation creation is idempotent for the same item and user.
- Optional `adminId` works when it references an active admin.
- REST message history loads only for participants.
- REST message send succeeds only for participants.
- Socket auth works with bearer token in `handshake.auth.token`.
- `conversation.join` returns room ack and emits `conversation.joined`.
- `message.send` emits `message.received`.
- `message.read` emits `message.read`.
- Non-participants receive REST or WS authorization failures.
