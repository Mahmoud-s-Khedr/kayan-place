# Module 4 Integration Guide: Faults

## 1. Purpose and Audience

This guide is for frontend web and mobile teams integrating Module 4 (Faults) with the backend.

It covers:
- fault report creation and update
- file upload handoff for fault images
- user "My Reports" filtering/sorting
- admin faults review and status management
- fault cancellation and fault rating rules

## 2. Prerequisites

- Backend base URL is reachable (example: `http://localhost:800` in local Docker setup).
- User and admin authentication flows are already integrated (Module 1).
- Authenticated requests include a valid bearer token where required.
- File upload flow endpoints are integrated for image attachment:
  - `POST /files/upload-intent`
  - `PATCH /files/:id/mark-uploaded`

## 3. End-to-End Flows

### 3.1 Create Fault Report (User)

1. User uploads fault image(s) through files flow (optional).
2. User creates report with `POST /v2/faults`.
3. Backend creates fault with initial status `received`.

Typical create payload:

```json
{
  "title": "Water leak",
  "description": "Leak from kitchen ceiling.",
  "severity": "high",
  "address": "Cairo, Nasr City",
  "imageFileIds": [101, 102]
}
```

### 3.2 File Upload Handoff for Fault Images

1. Request upload intent: `POST /files/upload-intent`.
2. Upload binary to returned storage URL.
3. Confirm upload: `PATCH /files/:id/mark-uploaded`.
4. Pass returned uploaded `file.id` values in `imageFileIds` when creating/updating fault.

Example upload-intent payload:

```json
{
  "ownerType": "product",
  "purpose": "product_image",
  "filename": "fault-1.jpg",
  "mimeType": "image/jpeg",
  "fileSizeBytes": 204800
}
```

### 3.3 Update Fault Report (User)

1. User updates own report with `PATCH /v2/faults/:id`.
2. Allowed only while report status is `received`.
3. User can update title/description/severity/address/images.

Typical update payload:

```json
{
  "description": "Leak is now affecting hallway wall.",
  "severity": "urgent",
  "address": "Cairo, New Cairo",
  "imageFileIds": [101]
}
```

### 3.4 My Reports (User)

Endpoint:
- `GET /v2/faults/me`

Query options:
- `status`
- `severity`
- `fromDate`, `toDate`
- `sortBy` (`createdAt`, `severity`)
- `sortDirection` (`asc`, `desc`)

Examples:
- `GET /v2/faults/me?status=received&sortBy=createdAt&sortDirection=desc`
- `GET /v2/faults/me?severity=urgent&sortBy=severity&sortDirection=asc`

### 3.5 Admin List and Update Fault Status

Admin endpoints:
- `GET /v2/admin/faults`
- `PATCH /v2/admin/faults/:id/status`

Supported statuses:
- `received`
- `assigned`
- `on_the_way`
- `in_progress`
- `finished`
- `cancelled`

Constrained workflow:
- `received -> assigned -> on_the_way -> in_progress -> finished`
- Cancellation is allowed before `finished`.

Typical admin status payload:

```json
{
  "status": "assigned"
}
```

### 3.6 Cancel Fault Report

User:
- `POST /v2/faults/:id/cancel`
- Allowed only while status is `received`.

Admin:
- Cancels through status endpoint by setting `status=cancelled` (within allowed transitions).

### 3.7 Fault Rating

Users can rate a fault one time only after status is `finished`.

Endpoint:
- `POST /v2/ratings`

Fault rating payload:

```json
{
  "itemType": "fault",
  "itemId": 55,
  "ratingValue": 5
}
```

Duplicate rating on the same fault by the same user is rejected.

## 4. Endpoint Map (High Level)

User:
- `POST /v2/faults`
- `PATCH /v2/faults/:id`
- `GET /v2/faults/me`
- `POST /v2/faults/:id/cancel`
- `POST /v2/ratings` (fault rating shape)

Admin:
- `GET /v2/admin/faults`
- `PATCH /v2/admin/faults/:id/status`

File flow dependency:
- `POST /files/upload-intent`
- `PATCH /files/:id/mark-uploaded`

## 5. Client Validation and Error Handling

### 5.1 Client-Side Validation

- `title`, `description`, `address`: required and non-empty.
- `severity`: one of `normal`, `high`, `urgent`, `emergent`.
- `imageFileIds`: optional array of numeric IDs.
- Fault rating:
  - `itemType` must be `fault`
  - `itemId` must be numeric
  - `ratingValue` must be between `1` and `5`

### 5.2 Error Branches

- `400`:
  - invalid payload
  - invalid status transition
  - update/cancel not allowed for current status
  - rating before fault is `finished`
  - duplicate rating
  - invalid image file reference (missing/non-uploaded/wrong purpose/non-image)
- `401`:
  - missing or invalid bearer token
- `403`:
  - trying to access/update/cancel/rate another user fault
  - non-admin access to admin faults endpoints
- `404`:
  - fault not found
  - file not found (during image references)

## 6. Minimal QA Integration Checklist

- User can create fault with valid payload and optional image IDs.
- User can update own fault while status is `received`.
- User cannot update/cancel own fault after processing starts.
- `GET /v2/faults/me` supports expected filter/sort query combinations.
- Admin can list all faults and update status through valid transitions.
- Invalid admin transitions are rejected.
- User can cancel while `received` and cancellation is blocked later.
- User can rate only after `finished`.
- Duplicate fault rating is rejected.
- Unauthorized and cross-user access branches return expected errors.
