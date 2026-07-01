# Module 7 Integration Guide: Gallery

## Purpose

This guide covers:

- public gallery browsing
- admin gallery list/create/update/delete
- image upload handoff
- public visibility rules

Shared contract:

- [frontend-integration-shared-contract.md](./frontend-integration-shared-contract.md)

## Flow-by-Flow Implementation

### Public Gallery Browsing

1. Call `GET /api/gallery` with optional `page`, `limit`, `offset`, and `query`.
2. Render returned `data.items[]`.
3. Each item exposes `title`, `description`, `is_active`, `created_at`, and `images[]`.

### Admin Upload and Create

Recommended upload-intent payload, aligned with the repo harness:

```json
{
  "ownerType": "product",
  "purpose": "product_image",
  "filename": "gallery-sim.png",
  "mimeType": "image/png",
  "fileSizeBytes": 68
}
```

Sequence:

1. `POST /api/files/upload-intent`
2. upload binary to the signed target
3. `PATCH /api/files/:id/mark-uploaded`
4. `POST /api/admin/gallery`

### Admin Visibility Toggle

1. `PATCH /api/admin/gallery/:id`
2. Set `isActive=false` to hide from public list
3. Set `isActive=true` to restore to public list

### Admin Soft Delete

1. `DELETE /api/admin/gallery/:id`
2. Record is soft-deleted
3. It disappears from both public and admin list endpoints

## Visibility Matrix

| State | Public `GET /api/gallery` | Admin `GET /api/admin/gallery` |
|---|---|---|
| `is_active=true`, not deleted | visible | visible |
| `is_active=false`, not deleted | hidden | visible |
| soft-deleted | hidden | hidden |

## Endpoint Contract

### `GET /api/gallery`

Public route.

Supported query params:

- `query`
- `page`: integer, min `1`, default `1`
- `limit`: integer, min `1`, max `100`
- `offset`: integer, min `0`

Success:

- `200`
- `data.items[]`

Public behavior:

- only active, non-deleted items are returned

### `GET /api/admin/gallery`

Auth: admin bearer token required

Supported query params:

- `query`
- `page`: integer, min `1`, default `1`
- `limit`: integer, min `1`, max `100`
- `offset`: integer, min `0`

Success:

- `200`
- `data.items[]`

Admin behavior:

- returns active and inactive items
- excludes soft-deleted items

### `POST /api/admin/gallery`

Auth: admin bearer token required

Request:

```json
{
  "title": "Kitchen Renovation",
  "description": "Before and after kitchen renewal project.",
  "imageFileIds": [101, 102]
}
```

Validation:

- `title`: required non-empty string
- `description`: required non-empty string
- `imageFileIds`: optional integer array

Success:

- `201`
- `data.item`

### `PATCH /api/admin/gallery/:id`

Auth: admin bearer token required

Editable fields:

- `title`
- `description`
- `isActive`
- `imageFileIds`

Request example:

```json
{
  "title": "Kitchen Renovation - Updated",
  "description": "Updated text",
  "isActive": false,
  "imageFileIds": [101]
}
```

Success:

- `200`
- updated `data.item`

### `DELETE /api/admin/gallery/:id`

Auth: admin bearer token required

Success:

- `200`
- message envelope

Errors:

- `404`: gallery item not found

## Asset Notes

- Send `imageFileIds` in intended display order.
- Backend preserves order by storing each image with `sort_order` based on array position.
- Frontend should only attach uploaded image files even though current gallery backend logic is looser than faults and does not enforce the same file-purpose checks.

## Error Handling

- `400`: invalid payload or field types
- `401`: missing or invalid bearer token
- `403`: authenticated non-admin hitting admin routes
- `404`: gallery item not found

## QA Checklist

- Public gallery list renders returned images.
- Admin gallery list returns active and inactive items.
- Admin can create a gallery item after upload intent, upload, and mark-uploaded.
- Admin can update title, description, and image list.
- `isActive=false` hides item from public list but keeps it in admin list.
- `isActive=true` restores visibility in public list.
- Delete removes item from both public and admin list responses.
- Unauthorized admin calls fail with `401`.
- Non-admin admin calls fail with `403`.
- Invalid payload and invalid IDs fail with expected errors.
