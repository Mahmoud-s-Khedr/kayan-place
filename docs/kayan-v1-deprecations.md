# V1 Deprecation Notes (Marketplace -> Kayan V2)

## Deprecated business endpoints

These v1 flows are now legacy and should be replaced by `/v2` Kayan flows:

- User listing lifecycle as primary business model:
  - `POST /products`, `PATCH /products/:id`, `PATCH /products/:id/status`, `GET /my/products`
- User-to-user moderation social flows:
  - `/favorites/*`
  - `/blocks/*`
  - `/reports/*` (user abuse reports)
  - `/ratings/*` (user-to-user rating)
- Legacy chat tied to peer marketplace browsing:
  - `/chat/*` for non-followup item communication

## V2 replacements

- Catalog + ordering: `/v2/products`, `/v2/orders`, `/v2/admin/orders`
- Faults: `/v2/faults`, `/v2/admin/faults`
- Services: `/v2/services`, `/v2/admin/services`
- Follow-up steps: `/v2/followups/:itemType/:itemId/steps`, `/v2/admin/followups/:itemType/:itemId/steps*`
- Item chat: `/v2/followups/:itemType/:itemId/chat/*`
- Gallery: `/v2/gallery`, `/v2/admin/gallery`
- Completion-based item ratings: `/v2/ratings`

## Migration behavior

- Old endpoints are not removed in this commit to avoid immediate client breakage.
- New development must use `/v2` endpoints only.
- Old endpoint removal can be done in a dedicated cleanup release after frontend migration.
