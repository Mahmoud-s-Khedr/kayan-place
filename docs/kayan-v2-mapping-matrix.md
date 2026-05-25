# Kayan SRS -> V2 Mapping Matrix

| Kayan SRS Use Case | Endpoint(s) | Table(s) | Status |
|---|---|---|---|
| List/Search Products | `GET /v2/products`, `GET /v2/products/:id` | `catalog_products`, `product_assets` | Implemented |
| Admin Add/Update/Delete Product | `POST/PATCH/DELETE /v2/admin/products*` | `catalog_products`, `product_assets` | Implemented |
| Order Product | `POST /v2/orders`, `GET/POST/PATCH/DELETE /v2/cart*`, `POST /v2/cart/checkout` | `product_orders`, `order_items`, `order_status_history`, `cart_items` | Implemented |
| My Orders / Details | `GET /v2/orders/me`, `GET /v2/orders/:id` | `product_orders`, `order_items` | Implemented |
| Cancel Order (before processing) | `POST /v2/orders/:id/cancel` | `product_orders`, `order_status_history` | Implemented |
| Update Order Address (before processing) | `PATCH /v2/orders/:id/address` | `product_orders` | Implemented |
| Admin View/Update Orders | `GET /v2/admin/orders`, `PATCH /v2/admin/orders/:id/status` | `product_orders`, `order_status_history` | Implemented |
| Report Fault | `POST /v2/faults` | `fault_reports`, `fault_assets`, `fault_status_history` | Implemented |
| Update Fault / Cancel Fault | `PATCH /v2/faults/:id`, `POST /v2/faults/:id/cancel` | `fault_reports`, `fault_assets`, `fault_status_history` | Implemented |
| My Faults | `GET /v2/faults/me` | `fault_reports` | Implemented |
| Admin List/Update Faults | `GET /v2/admin/faults`, `PATCH /v2/admin/faults/:id/status` | `fault_reports`, `fault_status_history` | Implemented |
| Order Service | `POST /v2/services` | `service_orders`, `service_status_history` | Implemented |
| Update/Cancel Service | `PATCH /v2/services/:id`, `POST /v2/services/:id/cancel` | `service_orders`, `service_status_history` | Implemented |
| My Services | `GET /v2/services/me` | `service_orders` | Implemented |
| Admin List/Update Services | `GET /v2/admin/services`, `PATCH /v2/admin/services/:id/status` | `service_orders`, `service_status_history` | Implemented |
| Follow-up Steps (read) | `GET /v2/followups/:itemType/:itemId/steps` | `followup_steps` | Implemented |
| Follow-up Steps Admin CRUD | `POST/PATCH/DELETE /v2/admin/followups/:itemType/:itemId/steps*` | `followup_steps` | Implemented |
| Item Chat (optional) | `POST /v2/followups/:itemType/:itemId/chat/conversations`, `GET/POST /v2/followups/:itemType/:itemId/chat/conversations/:id/messages` | `followup_conversations`, `followup_messages` | Implemented |
| Gallery List | `GET /v2/gallery` | `gallery_items`, `gallery_assets` | Implemented |
| Gallery Admin CRUD | `POST/PATCH/DELETE /v2/admin/gallery*` | `gallery_items`, `gallery_assets` | Implemented |
| Rating after completion | `POST /v2/ratings` | `item_ratings`, `product_ratings` | Implemented |

## Notes
- Source of truth for module completion status is `docs/kayan-srs.md` (status column). This matrix maps endpoints/tables and should stay implementation-oriented.
- Legacy follow-up aliases under `/v2/followup/*` and `/v2/admin/followup-steps*` are deprecated and scheduled for cleanup after transition.
- Auth/Profile remains under existing modules and was not broken by this migration.
- `users.email` was introduced for v2 identity alignment.
- `/v1` endpoints are still available and should be treated as deprecated during migration.
