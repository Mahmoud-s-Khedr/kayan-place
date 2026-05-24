# Module 2 Integration Guide: Profile

## 1. Purpose and Audience

This guide is for frontend web and mobile teams integrating Module 2 (Profile) with the backend.

It covers:
- user profile retrieval
- profile updates (name, phone, contact info)
- password change flow
- expected error handling branches

## 2. Prerequisites

- User is authenticated and app has a valid bearer access token.
- Backend base URL is reachable (example: `http://localhost:3000`).
- Client stores and sends bearer tokens securely.
- For QA automation only, backend may run with `OTP_DEV_MODE=true` when profile flows bootstrap registration automatically.

## 3. End-to-End Flows

### 3.1 Show User Details

1. Client sends `GET /me` with bearer token.
2. Backend returns current user profile.
3. Client renders key fields: `id`, `email`, `phone`, `name`, `contactInfo`.

### 3.2 Edit User Details

1. User edits one or more fields: `name`, `phone`, `contactInfo`.
2. Client sends `PATCH /me` with only changed fields.
3. Backend validates payload and uniqueness constraints.
4. Backend returns updated profile.

Example request body:

```json
{
  "name": "Ahmed Ali Updated",
  "phone": "+201001234567",
  "contactInfo": "+201000000111"
}
```

### 3.3 Change Password

1. User enters current password and new password.
2. Client sends `PATCH /me/password`.
3. Backend verifies old password, validates new password rule, and updates password hash.
4. Client should prompt user to confirm success and keep normal session handling.

Example request body:

```json
{
  "oldPassword": "OldSecret123",
  "newPassword": "NewSecret456"
}
```

## 4. Endpoint Map (High Level)

- `GET /me`: get current user profile
- `PATCH /me`: update profile fields (`name`, `phone`, `contactInfo`, optional avatar fields if used)
- `PATCH /me/password`: change current user password

## 5. Client Validation and Error Handling

### 5.1 Client-Side Validation

- `name`: 2–150 chars when provided.
- `phone`: 7–32 chars when provided.
- `contactInfo`: 1–255 chars when provided.
- `newPassword`: 8–64 chars and must include letters and numbers.

### 5.2 Error Branches

- `400`:
  - invalid payload
  - empty `PATCH /me` payload (nothing to update)
  - invalid old password (current backend behavior)
- `401`:
  - missing/invalid bearer token
  - some environments may return this for old password failure depending on contract version
- `409`:
  - duplicate phone during profile update

## 6. Minimal QA Integration Checklist

- `GET /me` returns `id`, `email`, `phone`, `name`, `contactInfo`.
- `PATCH /me` updates `name` only.
- `PATCH /me` updates `phone` only.
- `PATCH /me` updates `name + phone + contactInfo` together.
- `PATCH /me` with duplicate phone returns `409`.
- `PATCH /me` with invalid phone returns `400`.
- `PATCH /me/password` succeeds with valid old/new passwords.
- `PATCH /me/password` fails with wrong old password.
