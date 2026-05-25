# Kayan SRS

## 1. System Overview

Kayan is an application that allows users to:

- Register and manage their accounts.
- View and order products.
- Report faults and follow their status.
- Order services and follow their status.
- Track progress steps for products, faults, and services.
- View gallery items.

Admins can manage:

- Products.
- Orders.
- Fault reports.
- Service orders.
- Follow-up steps.
- Gallery items.

---

## 2. Actors

| Actor  | Description                                                  |
| ------ | ------------------------------------------------------------ |
| User   | A customer/end-user who can register, order products/services, report faults, rate completed items, and follow item progress. |
| Admin  | A system administrator who can manage products, orders, reports, service orders, progress steps, and gallery items. |
| System | The application backend/system logic that validates inputs, checks credentials, sends OTPs, and displays stored data. |
| All    | A use case available to both users and admins.               |

---

## 3. Functional Requirements

Status legend: `Completed` = implemented, `Partial` = implemented with scope/contract gaps, `Not Started` = not implemented yet.

## 3.1 Authentication and Registration

**Module Price:** 2000 EGP

| Use Case        | Main Actor | Description                                                  | Priority  | Status |
| --------------- | ---------- | ------------------------------------------------------------ | --------- | ------ |
| Login           | User       | Users enter their email and password. The system validates required fields, validates email format, verifies credentials, and returns access and refresh tokens on success. | Mandatory | Completed |
| Registration    | User       | Users enter their name, email, phone, and password. The system sends an OTP. The user verifies the OTP using email. The system creates the account. | Mandatory | Completed |
| Forgot Password | User       | Users request a reset OTP using email. The system sends OTP to email (or returns a generic success response when account does not exist). Users submit OTP, new password, and confirm password to complete reset and receive new tokens. | Mandatory | Completed |

**Implementation Notes (Current Backend Contract)**

- Registration flow endpoints:
  - `POST /auth/register`
  - `POST /auth/register/resend-otp`
  - `POST /auth/register/verify`
- Login endpoint: `POST /auth/login`
- Forgot-password endpoints:
  - `POST /auth/password/request-otp`
  - `POST /auth/password/reset`
- Session endpoints:
  - `POST /auth/refresh`
  - `POST /auth/logout`
- Key expected auth errors:
  - `400` invalid/expired OTP or invalid request payload
  - `401` invalid credentials or invalid refresh token
  - `409` duplicate email/phone/SSN on registration
  - `429` throttling on guarded endpoints

For frontend and mobile implementation guidance, see [Module 1 Auth Integration Guide](./module-1-auth-integration.md).

---
## 3.2 Profile

**Module Price:** 3000 EGP

| Use Case          | Main Actor | Description                                                  | Priority  | Status |
| ----------------- | ---------- | ------------------------------------------------------------ | --------- | ------ |
| Show User Details | System     | The system shows the user's details, including ID, email, phone, name, and contact information. | Mandatory | Completed |
| Edit User Details | User       | Users can edit their name, phone, and contact information.   | Mandatory | Completed |
| Change Password   | User       | Users enter their old password and new password. The system verifies the old password, checks the strength level of the new password, shows error messages when needed, and resets the password successfully. | Mandatory | Completed |

**Implementation Notes (Current Backend Contract)**

- Profile endpoints:
  - `GET /me`
  - `PATCH /me`
  - `PATCH /me/password`
- Key expected profile errors:
  - `400` invalid payload, empty profile update payload, or invalid old password in current implementation
  - `401` invalid/missing bearer token
  - `409` duplicate phone on profile update

For frontend and mobile implementation guidance, see [Module 2 Profile Integration Guide](./module-2-profile-integration.md).

---

## 3.3 Products

**Module Price:** 10000 EGP

| Use Case                    | Main Actor | Description                                                  | Priority  | Status |
| --------------------------- | ---------- | ------------------------------------------------------------ | --------- | ------ |
| Add Product                 | Admin      | Admins can add a product to the system. A product includes title, description, amount, price, details, images, and files. | Mandatory | Completed |
| Update Product              | Admin      | Admins can update product details.                           | Mandatory | Completed |
| Delete Product              | Admin      | Admins can delete or deactivate a product.                   | Mandatory | Completed |
| List and Search Products    | All        | Admins and users can list all products in the system, search products by query, filter products by price range, date range, and availability, and sort results by price or creation date in ascending or descending order. | Mandatory | Completed |
| Order Product               | User       | Users can order a product, insert a delivery address, and add products to the cart. | Mandatory | Completed |
| View All Orders             | Admin      | Admins can see all orders. Each order includes products, the user who ordered the product, and the delivery address. | Mandatory | Completed |
| Update Order Status         | Admin      | Admins can update the order status. Product order statuses include: received, ready to ship, on the way, cancelled, and delivered. | Mandatory | Completed |
| Cancel Order                | All        | Users can cancel an order. Admins can cancel an order by setting its status to cancelled. | Mandatory | Completed |
| My Orders                   | User       | Users can see their orders. Orders can be sorted and filtered like products. | Mandatory | Completed |
| Order Details and Follow-Up | User       | Users can see order details, including order date, status, products, and delivery address. Users can update the delivery address. | Mandatory | Completed |
| Rate Product                | User       | Users can rate a delivered product one time only.            | Mandatory | Completed |

**Implementation Notes (Current Backend Contract)**

- Product endpoints:
  - `GET /v2/products`
  - `GET /v2/products/:id`
  - `POST /v2/admin/products`
  - `PATCH /v2/admin/products/:id`
  - `DELETE /v2/admin/products/:id`
- Cart endpoints:
  - `GET /v2/cart`
  - `POST /v2/cart/items`
  - `PATCH /v2/cart/items/:id`
  - `DELETE /v2/cart/items/:id`
  - `POST /v2/cart/checkout`
- Order endpoints:
  - `POST /v2/orders` (direct order creation)
  - `GET /v2/orders/me`
  - `GET /v2/orders/:id`
  - `PATCH /v2/orders/:id/address`
  - `POST /v2/orders/:id/cancel`
  - `GET /v2/admin/orders`
  - `PATCH /v2/admin/orders/:id/status`
- Product rating endpoint:
  - `POST /v2/ratings`
  - Product rating uses: `itemType=order`, `orderId`, `productId`, `ratingValue`
- Product response contract:
  - `GET /v2/products` and `GET /v2/products/:id` include product assets split into `images` and `files`.
- `GET /v2/orders/me` query shape:
  - `status`
  - `fromDate`, `toDate`
  - `sortBy` (currently `createdAt`)
  - `sortDirection` (`asc`, `desc`)
- Supported order statuses:
  - `received`, `ready_to_ship`, `on_the_way`, `cancelled`, `delivered`
- Key expected errors in module flows:
  - `400` invalid payload, invalid product, insufficient stock, or business-rule validation failure
  - `401` invalid/missing bearer token
  - `403` trying to access/update resources outside current user scope, or policy/permission rejection in guarded flows
  - `404` product/order/cart item not found

For frontend and mobile implementation guidance, see [Module 3 Products Integration Guide](./module-3-products-integration.md).

---

## 3.4 Faults

**Module Price:** 5000 EGP

| Use Case            | Main Actor | Description                                                  | Priority  | Status |
| ------------------- | ---------- | ------------------------------------------------------------ | --------- | ------ |
| Report a Fault      | User       | Users can send a fault report. A fault report includes title, description, images, severity, and address. Severity values include: normal, high, urgent, and emergent. | Mandatory | Completed |
| Update Report       | User       | Users can update fault report details.                       | Mandatory | Completed |
| List All Faults     | Admin      | Admins can see all fault reports in the system. Each report includes details and the related user. | Mandatory | Completed |
| Update Fault Status | Admin      | Admins can set the fault status. Status values include: received, assigned, on the way, in progress, finished, and cancelled. | Mandatory | Completed |
| My Reports          | User       | Users can see their reports. Reports can be filtered and sorted by date and severity. | Mandatory | Partial |
| Cancel Report       | All        | Users can cancel a report. Admins can cancel a report using its status. | Mandatory | Completed |
| Rate Fault Report   | User       | Users can rate a finished report one time only.              | Mandatory | Completed |

---

## 3.5 Services

**Module Price:** 5000 EGP

| Use Case                    | Main Actor | Description                                                  | Priority  | Status |
| --------------------------- | ---------- | ------------------------------------------------------------ | --------- | ------ |
| Order a Service             | User       | Users can order a service. A service includes type, description, and address. Service types include: designing, maintenance, and renewal. | Mandatory | Completed |
| List All Service Orders     | Admin      | Admins can see all service orders and the users who ordered them. Service orders can be filtered by type and creation date range. Service orders can be sorted by date in ascending or descending order. | Mandatory | Partial |
| My Service Orders           | User       | Users can list their ordered services. Service orders can be filtered by type and creation date range. Service orders can be sorted by date in ascending or descending order. | Mandatory | Partial |
| Cancel Service              | All        | Users can cancel a service order.                            | Mandatory | Completed |
| Update Service Order        | User       | Users can update the service order description.              | Mandatory | Completed |
| Update Service Order Status | Admin      | Admins can cancel a service order or mark it as complete/incomplete. Service statuses include: not started, in progress, cancelled, and finished. | Mandatory | Completed |
| Rate Service                | User       | Users can rate a service one time only after it is marked as finished. | Mandatory | Completed |

---

## 3.6 Follow-Up

**Module Price:** 5000 + 10000 EGP

| Use Case       | Main Actor | Description                                                  | Priority  | Status |
| -------------- | ---------- | ------------------------------------------------------------ | --------- | ------ |
| Item Follow-Up | User       | Users can follow up the progress steps of their items. Items include products, faults, and services. | Mandatory | Completed |
| List Steps     | All        | Users and admins can see all item steps.                     | Mandatory | Partial |
| Add Step       | Admin      | Admins can add a new step to an item. A step includes title and image. | Mandatory | Completed |
| Delete Step    | Admin      | Admins can delete a step.                                    | Mandatory | Completed |
| Update Step    | Admin      | Admins can update a step title and image.                    | Mandatory | Completed |
| Item Chat      | All        | Users can chat with admins inside the item follow-up page.   | Optional  | Completed |

---

## 3.7 Gallery

**Module Price:** 5000 EGP

| Use Case    | Main Actor | Description                                                  | Priority  | Status |
| ----------- | ---------- | ------------------------------------------------------------ | --------- | ------ |
| List Items  | All        | Users and admins can list all gallery items. A gallery item includes title, description, and images. | Desirable | Completed |
| Add Item    | Admin      | Admins can add a new gallery item.                           | Desirable | Completed |
| Delete Item | Admin      | Admins can delete a gallery item.                            | Desirable | Completed |
| Update Item | Admin      | Admins can update gallery item details.                      | Desirable | Completed |

Implementation notes:
- Public gallery listing endpoint:
  - `GET /v2/gallery`
  - Returns active items only (`is_active=true`) and excludes soft-deleted items.
- Admin gallery listing endpoint:
  - `GET /v2/admin/gallery`
  - Returns active and inactive items, excluding soft-deleted items.
- Admin gallery management endpoints:
  - `POST /v2/admin/gallery`
  - `PATCH /v2/admin/gallery/:id`
  - `DELETE /v2/admin/gallery/:id` (soft delete via `deleted_at`)
- Gallery item response contract includes:
  - `title`
  - `description`
  - `images`
- Gallery `images` payload uses rich file metadata objects (not only file IDs), to support direct client rendering.

For frontend and mobile implementation guidance, see [Module 7 Gallery Integration Guide](./module-7-gallery-integration.md).

---

## 4. Priority Summary

| Priority  | Meaning                                                      |
| --------- | ------------------------------------------------------------ |
| Mandatory | Required for the first version.                              |
| Optional  | Useful, but can be delayed if budget or time is limited.     |
| Desirable | Nice-to-have feature that can be added after the mandatory scope. |

---

## 5. Price Summary

| Module                          |            Price |
| ------------------------------- | ---------------: |
| Authentication and Registration |         2000 EGP |
| Profile                         |         3000 EGP |
| Products                        |        10000 EGP |
| Faults                          |         5000 EGP |
| Services                        |         5000 EGP |
| Follow-Up                       | 5000 + 10000 EGP |
| Gallery                         |         5000 EGP |

---

## 6. Suggested Development Phases

| Phase   | Scope                                                        |
| ------- | ------------------------------------------------------------ |
| Phase 1 | Authentication, registration, profile management, and role setup. |
| Phase 2 | Product management, product listing/search, cart, ordering, and order management. |
| Phase 3 | Fault reporting, fault management, status updates, and fault rating. |
| Phase 4 | Service ordering, service management, status updates, and service rating. |
| Phase 5 | Follow-up steps for products, faults, and services.          |
| Phase 6 | Optional chat inside item follow-up.                         |
| Phase 7 | Gallery management.                                          |

---

## 7. Recommended Next SRS Additions

### 7.1 User Roles and Permissions

Define what each role can access.

| Feature                    | User | Admin |
| -------------------------- | ---: | ----: |
| Register/Login             |  Yes |   Yes |
| Manage Profile             |  Yes |   Yes |
| Add/Update/Delete Products |   No |   Yes |
| List/Search Products       |  Yes |   Yes |
| Order Products             |  Yes |    No |
| View All Orders            |   No |   Yes |
| Report Faults              |  Yes |    No |
| View All Fault Reports     |   No |   Yes |
| Order Services             |  Yes |    No |
| View All Service Orders    |   No |   Yes |
| Manage Follow-Up Steps     |   No |   Yes |
| View Follow-Up Steps       |  Yes |   Yes |
| Use Item Chat              |  Yes |   Yes |
| Manage Gallery             |   No |   Yes |
| View Gallery               |  Yes |   Yes |

### 7.2 Common Validation Rules

- Email must use a valid email format.
- Password must meet a defined minimum strength policy.
- Phone number must follow the accepted country/region format.
- Required fields must not be empty.
- Uploaded images/files must have defined size and type limits.
- Status values must only use the allowed values listed in the SRS.
- Rating should be allowed only once per completed/delivered item.

### 7.3 Suggested Entities

- User
- Admin/Role
- OTP
- Password Reset Token
- Product
- Product Image
- Product File
- Cart
- Cart Item
- Order
- Order Item
- Fault Report
- Fault Report Image
- Service
- Service Order
- Follow-Up Item
- Follow-Up Step
- Item Chat Message
- Rating
- Gallery Item
- Gallery Image

### 7.4 Suggested Non-Functional Requirements

| Category        | Requirement                                                  |
| --------------- | ------------------------------------------------------------ |
| Security        | Passwords must be hashed securely.                           |
| Security        | OTPs and reset tokens must expire after a short period.      |
| Security        | Admin APIs must require admin authorization.                 |
| Security        | Users must only access their own orders, reports, and service requests. |
| Performance     | Product listing and search should support pagination.        |
| Performance     | Admin order/report/service lists should support pagination, filtering, and sorting. |
| Reliability     | The system should keep logs for important admin actions.     |
| Backup          | The database should be backed up regularly.                  |
| Usability       | Error messages should be clear and user-friendly.            |
| Maintainability | Status values should be represented as enums/constants in the backend. |

---

## 8. Open Questions

1. Will the system support online payment, cash on delivery, or no payment integration? not at this stage
2. Should users verify both email and phone number, or only one of them? Only email OTP verification is currently implemented.
3. What OTP provider will be used? we will use resend to send emails
4. What file types and maximum file sizes are allowed for product files, report images, step images, and gallery images? leave it open
5. Can users edit a product order after placing it, or only the delivery address? none of these 
6. Can users cancel orders/reports/services at any status, or only before processing starts? before processing starts
7. Should admins be able to assign fault reports/service orders to workers or technicians? no
8. Should the system send notifications when status changes? 
9. Should item chat support images/files, or text only?
10. Should the gallery be public, user-only, or admin-only?
11. What does `5000 + 10000 EGP` mean for the Follow-Up module? 5k for the Mandatory and 10k for the optional
12. Should ratings include only stars, or stars plus written review? it will be a number in the backend the frontend is not my concern
13. Should deleted products/gallery items be permanently deleted or only deactivated? we will use soft delete 
14. Is there a super-admin role for managing other admins? not yet
15. What languages should the application support? the localization is done by the frontend team but the main languages are arabic and english

---

## 9. Recommended Acceptance Criteria Examples

### Login

- The user cannot submit empty email or password fields.
- The system rejects invalid email format.
- The system rejects incorrect credentials.
- The system logs in the user when credentials are valid.

### Registration

- The user cannot register with missing required fields.
- The system sends OTP after valid registration input.
- The account is created only after successful OTP verification.
- Duplicate email values are rejected (and SSN uniqueness is also enforced in registration flows).

### Product Ordering

- The user can add one or more products to the cart.
- The user can place an order with a delivery address.
- The order appears in the user's order list.
- The order appears in the admin order list.
- The user can view order details and status.

### Fault Reporting

- The user can submit title, description, severity, address, and images.
- The report appears in the user's report list.
- The report appears in the admin fault report list.
- The admin can update the report status.
- The user can rate the report only after it is finished.

### Service Ordering

- The user can choose a service type.
- The user can enter description and address.
- The service order appears in the user's service order list.
- The service order appears in the admin service order list.
- The admin can update the service order status.
- The user can rate the service only after it is finished.

### Follow-Up Steps

- Admins can add, update, and delete steps for products, faults, and services.
- Users can view the steps for their own items.
- Users cannot manage steps unless they are admins.

### Gallery

- Users and admins can list gallery items.
- Admins can add, update, and delete gallery items.
- Gallery items include title, description, and images.
