# Module 3 Integration Guide: Products, Cart, and Orders

## 1. Purpose and Audience

This guide is for frontend web and mobile teams integrating Module 3 (Products, Cart, and Orders) with the backend.

It covers:
- product catalog browsing and filtering
- admin product management
- cart and checkout flows
- order tracking and order-status management
- product rating after delivery

## 2. Prerequisites

- Backend base URL is reachable (example: `http://localhost:800` in local Docker setup).
- User and admin authentication flows are already integrated (Module 1).
- Authenticated requests include a valid bearer token where required.
- Profile/session flows are working (Module 2).

## 3. End-to-End Flows

### 3.1 Product Catalog (Public/User)

1. Client loads products using `GET /api/products`.
2. Client optionally passes query/filter/sort params:
   - `query`
   - `minPrice`, `maxPrice`
   - `fromDate`, `toDate`
   - `availability` (`active`, `inactive`, `all`)
   - `sortBy` (`createdAt`, `price`)
   - `sortDirection` (`asc`, `desc`)
3. User opens a product details page using `GET /api/products/:id`.
4. Product payloads returned by list/details include assets split into:
   - `images`
   - `files`

### 3.2 Admin Product Management

1. Admin creates product with `POST /api/admin/products`.
2. Admin updates product fields with `PATCH /api/admin/products/:id`.
3. Admin soft-deletes product with `DELETE /api/admin/products/:id`.

Typical create payload:

```json
{
  "title": "Water Pump",
  "description": "1.5 HP high pressure pump",
  "amount": 25,
  "price": 3500,
  "details": {
    "brand": "Kayan",
    "warrantyMonths": 12
  },
  "imageFileIds": [],
  "fileIds": []
}
```

### 3.3 Cart and Checkout (User)

1. Add product to cart: `POST /api/cart/items`.
2. Update quantity: `PATCH /api/cart/items/:id`.
3. Remove item: `DELETE /api/cart/items/:id`.
4. List current cart: `GET /api/cart`.
5. Checkout cart: `POST /api/cart/checkout` with `deliveryAddress`.

Checkout payload:

```json
{
  "deliveryAddress": "Cairo, Nasr City, Abbas Al Akkad"
}
```

### 3.4 Orders and Follow-up

User:
- `GET /api/orders/me` for order list (supports `status`, `fromDate`, `toDate`, `sortBy=createdAt`, `sortDirection`)
- `GET /api/orders/:id` for details
- `PATCH /api/orders/:id/address` (allowed before processing starts)
- `POST /api/orders/:id/cancel` (allowed before processing starts)

Admin:
- `GET /api/admin/orders` to review all orders
- `PATCH /api/admin/orders/:id/status` to progress order

Order statuses:
- `received`
- `ready_to_ship`
- `on_the_way`
- `cancelled`
- `delivered`

### 3.5 Product Rating

Users can rate a delivered ordered product once.

Endpoint:
- `POST /api/ratings`

Payload for product rating:

```json
{
  "itemType": "order",
  "orderId": 101,
  "productId": 12,
  "ratingValue": 5
}
```

Contract nuance:
- Direct order creation (`POST /api/orders`) remains supported for compatibility alongside cart checkout (`POST /api/cart/checkout`).

## 4. Endpoint Map (High Level)

Public/User:
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:id`
- `DELETE /api/cart/items/:id`
- `POST /api/cart/checkout`
- `POST /api/orders`
- `GET /api/orders/me`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id/address`
- `POST /api/orders/:id/cancel`
- `POST /api/ratings`

Admin:
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id/status`

## 5. Client Validation and Error Handling

### 5.1 Client-Side Validation

- `amount` and `quantity` must be positive integers.
- `price` must be non-negative.
- `deliveryAddress` must be non-empty.
- Rating:
  - `ratingValue` between `1` and `5`
  - For product rating: include `itemType=order`, `orderId`, `productId`.

### 5.2 Error Branches

- `400`:
  - invalid payload
  - invalid product
  - insufficient stock
  - action blocked by order status (address update/cancel/rating constraints)
- `401`: missing/invalid bearer token
- `403`: access to another user’s order/cart resource, or policy/permission rejection in guarded flows
- `404`: product/order/cart item not found

## 6. Minimal QA Integration Checklist

- Product list loads with default and custom query/filter/sort params.
- Product details screen loads a valid `productId`.
- Admin can create/update/delete product successfully.
- User can add/update/remove cart items.
- Checkout creates order and clears cart.
- User can view own orders and order details.
- Address update works in `received` status and fails after processing starts.
- Admin can move order through `ready_to_ship -> on_the_way -> delivered`.
- Product rating works only after delivery and is blocked on duplicate submission.
