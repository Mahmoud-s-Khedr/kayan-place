# API List

Generated from `openapi.json` (REST) and `src/**/*.gateway.ts` (WebSocket).

## REST APIs

### Admin

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| GET | /admin/admins | bearer | AdminController_listAdmins | List all admins (admin only) | - | 200:AdminAdminsListResponseDto |  |
| DELETE | /admin/admins/{id} | bearer | AdminController_demoteAdmin | Demote an admin to regular user (admin only) | - | 200:AdminUserResponseDto |  |
| POST | /admin/admins/{id} | bearer | AdminController_promoteAdmin | Promote a user to admin (admin only) | - | 200:AdminUserResponseDto |  |
| GET | /admin/users | bearer | AdminController_listUsers | List all users with optional filters (admin only) | - | 200:AdminUsersListResponseDto |  |
| DELETE | /admin/users/{id} | bearer | AdminController_deleteUser | Delete a user (soft-delete, admin only) | - | 200:SuccessResponseDto |  |
| GET | /admin/users/{id} | bearer | AdminController_getUserDetails | Get user details for moderation page (admin only) | - | 200:AdminUserDetailsResponseDto |  |
| GET | /admin/users/{id}/listings | bearer | AdminController_listUserListings | List user listings for admin view (read-only) | - | 200:AdminUserListingsResponseDto |  |
| PATCH | /admin/users/{id}/status | bearer | AdminController_updateUserStatus | Update a user's status (admin only) | UpdateUserStatusDto | 200:AdminUserResponseDto |  |
| POST | /admin/warnings | bearer | AdminController_createWarning | Issue a warning to a user (admin only) | CreateWarningDto | 201:WarningResponseDto |  |

### Auth

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| POST | /auth/login | public | AuthController_login | Login with email and password | LoginDto | 201:TokenResponseDto |  |
| POST | /auth/logout | bearer | AuthController_logout | Revoke refresh token and logout | LogoutDto | 201:LogoutResponseDto |  |
| POST | /auth/password/request-otp | public | AuthController_requestPasswordResetOtp | Request a password-reset OTP via email | RequestPasswordResetOtpDto | 201:OtpSentResponseDto |  |
| POST | /auth/password/reset | public | AuthController_resetPassword | Reset password using OTP | ResetPasswordDto | 201:TokenResponseDto |  |
| POST | /auth/refresh | bearer | AuthController_refresh | Refresh access token using a refresh token | RefreshTokenDto | 201:TokenResponseDto |  |
| POST | /auth/register | public | AuthController_requestRegistrationOtp | Register with name/email/phone/password and request a verification OTP via email | RequestRegistrationOtpDto | 201:OtpSentResponseDto |  |
| POST | /auth/register/resend-otp | public | AuthController_resendRegistrationOtp | Resend registration OTP to an existing pending registration | ResendRegistrationOtpDto | 201:OtpSentResponseDto |  |
| POST | /auth/register/verify | public | AuthController_verifyRegistrationOtp | Verify OTP and complete registration | VerifyRegistrationOtpDto | 201:TokenResponseDto |  |

### Chat

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| GET | /chat/conversations | bearer | ChatController_listConversations | List conversations for the current user | - | 200:ConversationsListResponseDto |  |
| POST | /chat/conversations | bearer | ChatController_createConversation | Get or create a conversation with another user | CreateConversationDto | 201:ConversationResponseDto |  |
| GET | /chat/conversations/{id} | bearer | ChatController_getConversation | Get a single conversation with metadata for the current user | - | 200:ConversationResponseDto |  |
| GET | /chat/conversations/{id}/messages | bearer | ChatController_listMessages | List messages in a conversation (cursor-paginated) | - | 200:MessagesListResponseDto |  |

### Files

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| GET | /files/{id} | bearer | FilesController_getFile | Get file metadata and signed download URL | - | 200:FileResponseDto |  |
| PATCH | /files/{id}/mark-uploaded | bearer | FilesController_markUploaded | Confirm a file has been uploaded to storage | MarkUploadedDto | 200:FileMarkUploadedResponseDto |  |
| POST | /files/upload-intent | bearer | FilesController_createUploadIntent | Create a signed upload URL for a file | CreateUploadIntentDto | 201:UploadIntentResponseDto |  |

### Health

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| GET | /health/live | public | HealthController_live | Liveness probe — always returns 200 | - | 200:HealthResponseDto |  |
| GET | /health/ready | public | HealthController_ready | Readiness probe — checks DB connectivity | - | 200:HealthResponseDto |  |

### Kayan V2

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| GET | /v2/cart | bearer | KayanController_listCart | KayanController_listCart | - | - |  |
| POST | /v2/cart/checkout | bearer | KayanController_checkoutCart | KayanController_checkoutCart | CheckoutCartDto | - |  |
| POST | /v2/cart/items | bearer | KayanController_addCartItem | KayanController_addCartItem | CreateCartItemDto | - |  |
| DELETE | /v2/cart/items/{id} | bearer | KayanController_deleteCartItem | KayanController_deleteCartItem | - | - |  |
| PATCH | /v2/cart/items/{id} | bearer | KayanController_updateCartItem | KayanController_updateCartItem | UpdateCartItemDto | - |  |
| POST | /v2/faults | bearer | KayanController_createFault | KayanController_createFault | CreateFaultDto | - |  |
| PATCH | /v2/faults/{id} | bearer | KayanController_updateFault | KayanController_updateFault | UpdateFaultDto | - |  |
| POST | /v2/faults/{id}/cancel | bearer | KayanController_cancelFault | KayanController_cancelFault | - | - |  |
| GET | /v2/faults/me | bearer | KayanController_listMyFaults | KayanController_listMyFaults | - | - |  |
| POST | /v2/followup/chat/conversations | bearer | KayanController_createConversationDeprecated | KayanController_createConversationDeprecated | CreateFollowupConversationDto | - |  |
| GET | /v2/followup/chat/conversations/{id}/messages | bearer | KayanController_listMessagesDeprecated | KayanController_listMessagesDeprecated | - | - |  |
| POST | /v2/followup/chat/conversations/{id}/messages | bearer | KayanController_sendMessageDeprecated | KayanController_sendMessageDeprecated | SendFollowupMessageDto | - |  |
| GET | /v2/followup/steps | bearer | KayanController_listFollowupStepsDeprecated | KayanController_listFollowupStepsDeprecated | - | - |  |
| POST | /v2/followups/{itemType}/{itemId}/chat/conversations | bearer | KayanController_createConversation | KayanController_createConversation | CreateFollowupConversationBodyDto | - |  |
| GET | /v2/followups/{itemType}/{itemId}/chat/conversations/{id}/messages | bearer | KayanController_listMessages | KayanController_listMessages | - | - |  |
| POST | /v2/followups/{itemType}/{itemId}/chat/conversations/{id}/messages | bearer | KayanController_sendMessage | KayanController_sendMessage | SendFollowupMessageDto | - |  |
| GET | /v2/followups/{itemType}/{itemId}/steps | bearer | KayanController_listFollowupSteps | KayanController_listFollowupSteps | - | - |  |
| GET | /v2/gallery | public | KayanController_listGallery | KayanController_listGallery | - | - |  |
| POST | /v2/orders | bearer | KayanController_createOrder | KayanController_createOrder | CreateOrderDto | - |  |
| GET | /v2/orders/{id} | bearer | KayanController_getOrder | KayanController_getOrder | - | - |  |
| PATCH | /v2/orders/{id}/address | bearer | KayanController_updateOrderAddress | KayanController_updateOrderAddress | UpdateOrderAddressDto | - |  |
| POST | /v2/orders/{id}/cancel | bearer | KayanController_cancelOrder | KayanController_cancelOrder | - | - |  |
| GET | /v2/orders/me | bearer | KayanController_listMyOrders | KayanController_listMyOrders | - | - |  |
| GET | /v2/products | public | KayanController_listProducts | KayanController_listProducts | - | - |  |
| GET | /v2/products/{id} | public | KayanController_getProduct | KayanController_getProduct | - | - |  |
| POST | /v2/ratings | bearer | KayanController_createItemRating | KayanController_createItemRating | CreateItemRatingDto | - |  |
| POST | /v2/services | bearer | KayanController_createService | KayanController_createService | CreateServiceOrderDto | - |  |
| PATCH | /v2/services/{id} | bearer | KayanController_updateService | KayanController_updateService | UpdateServiceOrderDto | - |  |
| POST | /v2/services/{id}/cancel | bearer | KayanController_cancelService | KayanController_cancelService | - | - |  |
| GET | /v2/services/me | bearer | KayanController_listMyServices | KayanController_listMyServices | - | - |  |

### Kayan V2 Admin

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| GET | /v2/admin/faults | bearer | KayanAdminController_listFaults | KayanAdminController_listFaults | - | - |  |
| PATCH | /v2/admin/faults/{id}/status | bearer | KayanAdminController_updateFaultStatus | KayanAdminController_updateFaultStatus | AdminUpdateFaultStatusDto | - |  |
| POST | /v2/admin/followup-steps | bearer | KayanAdminController_createStepDeprecated | KayanAdminController_createStepDeprecated | CreateFollowupStepDto | - |  |
| DELETE | /v2/admin/followup-steps/{id} | bearer | KayanAdminController_deleteStepDeprecated | KayanAdminController_deleteStepDeprecated | - | - |  |
| PATCH | /v2/admin/followup-steps/{id} | bearer | KayanAdminController_updateStepDeprecated | KayanAdminController_updateStepDeprecated | UpdateFollowupStepDto | - |  |
| POST | /v2/admin/followups/{itemType}/{itemId}/steps | bearer | KayanAdminController_createStep | KayanAdminController_createStep | CreateFollowupStepBodyDto | - |  |
| DELETE | /v2/admin/followups/{itemType}/{itemId}/steps/{id} | bearer | KayanAdminController_deleteStep | KayanAdminController_deleteStep | - | - |  |
| PATCH | /v2/admin/followups/{itemType}/{itemId}/steps/{id} | bearer | KayanAdminController_updateStep | KayanAdminController_updateStep | UpdateFollowupStepDto | - |  |
| GET | /v2/admin/gallery | bearer | KayanAdminController_listGallery | KayanAdminController_listGallery | - | - |  |
| POST | /v2/admin/gallery | bearer | KayanAdminController_createGalleryItem | KayanAdminController_createGalleryItem | CreateGalleryItemDto | - |  |
| DELETE | /v2/admin/gallery/{id} | bearer | KayanAdminController_deleteGalleryItem | KayanAdminController_deleteGalleryItem | - | - |  |
| PATCH | /v2/admin/gallery/{id} | bearer | KayanAdminController_updateGalleryItem | KayanAdminController_updateGalleryItem | UpdateGalleryItemDto | - |  |
| GET | /v2/admin/orders | bearer | KayanAdminController_listOrders | KayanAdminController_listOrders | - | - |  |
| PATCH | /v2/admin/orders/{id}/status | bearer | KayanAdminController_updateOrderStatus | KayanAdminController_updateOrderStatus | AdminUpdateOrderStatusDto | - |  |
| POST | /v2/admin/products | bearer | KayanAdminController_createProduct | KayanAdminController_createProduct | AdminCreateProductDto | - |  |
| DELETE | /v2/admin/products/{id} | bearer | KayanAdminController_deleteProduct | KayanAdminController_deleteProduct | - | - |  |
| PATCH | /v2/admin/products/{id} | bearer | KayanAdminController_updateProduct | KayanAdminController_updateProduct | AdminUpdateProductDto | - |  |
| GET | /v2/admin/services | bearer | KayanAdminController_listServices | KayanAdminController_listServices | - | - |  |
| PATCH | /v2/admin/services/{id}/status | bearer | KayanAdminController_updateServiceStatus | KayanAdminController_updateServiceStatus | AdminUpdateServiceStatusDto | - |  |

### Products

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| GET | /my/products | bearer | ProductsController_listMyProducts | List the current user's products | - | 200:ProductListResponseDto |  |
| POST | /products | bearer | ProductsController_createProduct | Create a new product listing | CreateProductDto | 201:ProductResponseDto |  |
| DELETE | /products/{id} | bearer | ProductsController_deleteProduct | Soft-delete a product listing | - | 200:ProductDeleteResponseDto |  |
| GET | /products/{id} | public | ProductsController_getProduct | Get a product by ID | - | 200:ProductResponseDto |  |
| PATCH | /products/{id} | bearer | ProductsController_updateProduct | Update a product listing | UpdateProductDto | 200:ProductResponseDto |  |
| PATCH | /products/{id}/status | bearer | ProductsController_updateProductStatus | Update product status (available/sold/archived) | UpdateProductStatusDto | 200:ProductStatusResponseDto |  |
| GET | /search/products | public | ProductsController_searchProducts | Search / filter public product listings | - | 200:ProductListResponseDto |  |

### Ratings

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| POST | /ratings | bearer | RatingsController_rateUser | Rate a user (1–5 stars) | CreateRatingDto | 201:RatingResponseDto |  |
| GET | /ratings/{userId} | public | RatingsController_getUserRatingSummary | Get rating summary for a user | - | 200:RatingSummaryResponseDto |  |

### Users

| Method | Path | Auth | Name | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| DELETE | /me | bearer | UsersController_deleteMe | Delete current user account (soft-delete) | - | 200:SuccessResponseDto |  |
| GET | /me | bearer | UsersController_getMe | Get current user profile | - | 200:UserProfileResponseDto |  |
| PATCH | /me | bearer | UsersController_updateMe | Update current user profile | UpdateProfileDto | 200:UserProfileResponseDto |  |
| PATCH | /me/password | bearer | UsersController_changePassword | Change current user password | ChangePasswordDto | 200:SuccessResponseDto |  |
| GET | /users/{id} | public | PublicUsersController_getPublicProfile | Get public profile and active listings for a user | - | 200:PublicUserProfileResponseDto |  |

## WebSocket APIs

### ChatGateway

| Event | Channel | Auth | Handler | Summary | Request | Response | Notes |
|---|---|---|---|---|---|---|---|
| conversation.join | /chat | bearer | joinConversation | Handle conversation.join | JoinConversationDto | conversation.joined | JWT required in Socket auth/header during connection. |
| message.read | /chat | bearer | markRead | Handle message.read | MarkMessageReadDto | message.read | JWT required in Socket auth/header during connection. |
| message.send | /chat | bearer | sendMessage | Handle message.send | SendMessageDto | message.received | JWT required in Socket auth/header during connection. |

