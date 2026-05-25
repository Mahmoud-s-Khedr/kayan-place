# Module 7 Integration Guide: Gallery

## 1. Purpose and Audience

This guide is for frontend web and mobile teams integrating Module 7 (Gallery) with the backend.

It covers:
- public gallery browsing
- admin gallery management (create/update/delete)
- gallery visibility behavior (`active` vs `inactive` vs soft-deleted)
- file upload handoff for gallery images

## 2. Prerequisites

- Backend base URL is reachable (example: `http://localhost:800` in local Docker setup).
- Authentication flow is integrated (Module 1) for admin-protected endpoints.
- Admin requests include a valid bearer token.
- File upload flow endpoints are integrated for image attachment:
  - `POST /files/upload-intent`
  - `PATCH /files/:id/mark-uploaded`

## 3. End-to-End Flows

### 3.1 Public Gallery Browsing

1. Client calls `GET /v2/gallery`.
2. Backend returns gallery items visible to public/users.
3. Client renders each item using:
   - `title`
   - `description`
   - `images`

Behavior:
- Public list includes active items only.
- Soft-deleted items are excluded.

### 3.2 Admin Upload + Create Gallery Item

1. Admin requests upload intent: `POST /files/upload-intent`.
2. Client uploads binary to signed storage URL from the intent response.
3. Client confirms upload: `PATCH /files/:id/mark-uploaded`.
4. Admin creates gallery item: `POST /v2/admin/gallery` with `title`, `description`, and `imageFileIds`.
5. Backend returns created item with `images` payload.

Typical create payload:

```json
{
  "title": "Kitchen Renovation",
  "description": "Before and after kitchen renewal project.",
  "imageFileIds": [101, 102]
}
```

### 3.3 Admin Visibility Update Flow

1. Admin updates item: `PATCH /v2/admin/gallery/:id`.
2. Admin can set `isActive=false` to hide from public list.
3. Admin can later set `isActive=true` to show again.

Typical update payload:

```json
{
  "title": "Kitchen Renovation - Updated",
  "description": "Updated text",
  "isActive": false,
  "imageFileIds": [101]
}
```

### 3.4 Admin Delete Flow (Soft Delete)

1. Admin deletes item via `DELETE /v2/admin/gallery/:id`.
2. Backend soft-deletes item (`deleted_at` set).
3. Item no longer appears in public or admin list endpoints.

## 4. Endpoint Map (High Level)

Public/User:
- `GET /v2/gallery`

Admin:
- `GET /v2/admin/gallery`
- `POST /v2/admin/gallery`
- `PATCH /v2/admin/gallery/:id`
- `DELETE /v2/admin/gallery/:id`

File flow dependency:
- `POST /files/upload-intent`
- `PATCH /files/:id/mark-uploaded`

## 5. Client Validation and Error Handling

### 5.1 Client-Side Validation

- `title`: required, non-empty.
- `description`: required, non-empty.
- `imageFileIds`: optional array of numeric file IDs.
- Preserve intended image order by sending `imageFileIds` in display order.

### 5.2 Error Branches

- `400`:
  - invalid payload (for example empty `title`/`description`)
  - invalid field types
- `401`:
  - missing/invalid bearer token for protected endpoints
- `403`:
  - authenticated non-admin calling admin gallery endpoints
- `404`:
  - gallery item not found on update/delete

## 6. Minimal QA Integration Checklist

- Public `GET /v2/gallery` loads items and renders `images` correctly.
- Admin `GET /v2/admin/gallery` returns both active and inactive items.
- Admin can create gallery item after upload intent + upload + mark-uploaded flow.
- Admin can update title/description/images successfully.
- Setting `isActive=false` hides item from public list and keeps it in admin list.
- Setting `isActive=true` makes item visible in public list again.
- Admin delete removes item from both public/admin list responses (soft delete behavior).
- Unauthorized admin endpoint calls return `401`.
- Non-admin admin-endpoint calls return `403`.
- Invalid payload and invalid ID branches return expected `400`/`404`.
