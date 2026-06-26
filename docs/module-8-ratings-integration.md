# Module 8 Integration Guide: Ratings and Reviews

## Purpose

This guide covers all rating and review functionality:

- creating a rating for a completed order product, finished fault, or finished service
- retrieving reviews for a specific item
- legacy per-user rating summary endpoint

Shared contract:

- [frontend-integration-shared-contract.md](./frontend-integration-shared-contract.md)

## Supported Item Types

Ratings apply to three types of items:

| `itemType` | Description |
|---|---|
| `order` | A product purchased via a delivered order |
| `fault` | A fault report that has reached `finished` status |
| `service` | A service order that has reached `finished` status |

The request body shape differs depending on `itemType` — see the endpoint contract below.

## Flow-by-Flow Implementation

### Rate a Delivered Order Product

Once an order status is `delivered`, the buyer can rate each product in that order:

1. Call `POST /api/ratings` with:
   - `itemType: "order"`
   - `orderId`: the order ID
   - `productId`: the product ID within that order
   - `ratingValue`: integer 1–5
   - `comment`: optional string

Rules enforced by the backend:

- the order must belong to the authenticated user
- the order status must be `delivered`
- the product must exist in that order
- duplicate rating for the same product/order pair is rejected

### Rate a Finished Fault

Once a fault status is `finished`, the fault owner can rate it:

1. Call `POST /api/ratings` with:
   - `itemType: "fault"`
   - `itemId`: the fault ID
   - `ratingValue`: integer 1–5
   - `comment`: optional string

### Rate a Finished Service

Once a service status is `finished`, the service owner can rate it:

1. Call `POST /api/ratings` with:
   - `itemType: "service"`
   - `itemId`: the service ID
   - `ratingValue`: integer 1–5
   - `comment`: optional string

### Retrieve Reviews for an Item

Use this to display a review list below a product, fault, or service detail view:

1. Call `GET /api/ratings/items/:itemId` with `itemType` query param.
2. Render `data.items[]`.

Authentication is optional — the endpoint uses `OptionalJwtAuthGuard`.

## Endpoint Contract

### `POST /api/ratings`

Auth: bearer token required

**For order/product ratings:**

```json
{
  "itemType": "order",
  "orderId": 101,
  "productId": 12,
  "ratingValue": 5,
  "comment": "Excellent quality!"
}
```

**For fault or service ratings:**

```json
{
  "itemType": "fault",
  "itemId": 55,
  "ratingValue": 4,
  "comment": "Resolved quickly."
}
```

Validation:

- `itemType`: required, must be `order`, `fault`, or `service`
- `itemId`: required integer, min `1` — **only when `itemType` is `fault` or `service`**
- `orderId`: required integer, min `1` — **only when `itemType` is `order`**
- `productId`: required integer, min `1` — **only when `itemType` is `order`**
- `ratingValue`: required integer, `1-5`
- `comment`: optional string, 1-2000 chars

> [!IMPORTANT]
> The required fields differ by `itemType`. Sending `itemId` when `itemType` is `order` will fail validation, and vice versa.

Success:

- `201`
- `data.rating`

Possible errors:

- `400`: invalid payload, wrong field combination for `itemType`, rating before completion, duplicate rating, product not in order
- `401`: missing or invalid bearer token
- `403`: item does not belong to the authenticated user
- `404`: order, product, fault, or service not found

### `GET /api/ratings/items/:itemId`

Auth: optional (public access allowed)

Required query param:

- `itemType`: `order`, `fault`, or `service`

Optional query params:

- `page`: integer, min `1`
- `limit`: integer, min `1`, max `100`

Success:

- `200`
- `data.items[]`

Important review fields:

- `id`
- `item_type`
- `item_id`
- `rating_value`
- `comment`
- `created_at`
- nested `user` (reviewer summary)

Possible errors:

- `400`: missing or invalid `itemType` query param

### `GET /api/ratings/summary/:userId` _(Legacy)_

> [!NOTE]
> This is a legacy endpoint. It is publicly accessible and does not require authentication. Frontend may use it for backward-compatible user rating summaries.

Path param:

- `userId`: integer, target user ID

Success:

- `200`
- `data.averageRating`
- `data.reviewCount`

Possible errors:

- `404`: user not found

## Error Handling

- `400`: invalid payload, wrong `itemType` field combination, duplicate rating, rating before item completion
- `401`: missing or invalid bearer token on create
- `403`: authenticated user does not own the rated item
- `404`: rated item not found

## QA Checklist

- Rate a delivered order product with valid `orderId` and `productId`.
- Rate a finished fault with `itemId`.
- Rate a finished service with `itemId`.
- Attempt to rate a non-delivered/non-finished item — expect `400`.
- Attempt to rate the same item twice — expect `400`.
- Attempt to rate another user's item — expect `403`.
- `GET /api/ratings/items/:itemId` returns review list with correct `itemType`.
- `GET /api/ratings/items/:itemId` without `itemType` param fails with `400`.
- `GET /api/ratings/summary/:userId` returns average and count for a known user.
- `GET /api/ratings/summary/:userId` with unknown user returns `404`.
