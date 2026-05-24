# Module 1 Integration Guide: Authentication and Registration

## 1. Purpose and Audience

This guide is for frontend web and mobile teams integrating Module 1 (Authentication and Registration) with the backend at a high level.

It covers:
- user-facing auth flows
- backend endpoint mapping
- client integration model and state handling
- common error handling branches

## 2. Prerequisites

- Backend base URL is reachable (example: `http://localhost:800` in local Docker dev).
- App knows where to store session tokens securely.
- For QA/dev automation only, backend may run with `OTP_DEV_MODE=true` to expose OTP in response data.
  - Production must keep `OTP_DEV_MODE=false`.

## 3. End-to-End Flows

### 3.1 Registration Flow

1. User submits: `name`, `email`, `phone`, `password` (and `ssn` where required by business rules).
2. Frontend calls `POST /auth/register`.
3. Backend sends OTP to email.
4. User enters OTP.
5. Frontend calls `POST /auth/register/verify`.
6. Backend creates account and returns `accessToken` + `refreshToken` (+ user payload).

Optional step:
- If OTP expires or is not received, call `POST /auth/register/resend-otp`.

### 3.2 Login Flow

1. User submits: `email`, `password`.
2. Frontend calls `POST /auth/login`.
3. Backend validates credentials and returns `accessToken` + `refreshToken` (+ user payload).

### 3.3 Forgot Password Flow

1. User submits email.
2. Frontend calls `POST /auth/password/request-otp`.
3. Backend sends reset OTP to email (or returns generic success message when email is unknown).
4. User submits OTP + new password + confirm password.
5. Frontend calls `POST /auth/password/reset`.
6. Backend resets password and returns new tokens.

### 3.4 Token Lifecycle Flow

- Use `POST /auth/refresh` with refresh token to rotate session tokens.
- Use `POST /auth/logout` to revoke refresh token and end session.
- On access token expiry during API calls:
  1. attempt refresh
  2. retry original request on refresh success
  3. force re-login if refresh fails

## 4. Endpoint Map (High Level)

- `POST /auth/register`: start registration and send email OTP
- `POST /auth/register/resend-otp`: resend registration OTP
- `POST /auth/register/verify`: verify OTP and create account
- `POST /auth/login`: login with email/password
- `POST /auth/password/request-otp`: request reset OTP
- `POST /auth/password/reset`: reset password with OTP
- `POST /auth/refresh`: refresh token pair
- `POST /auth/logout`: revoke refresh token

## 5. Frontend and Mobile Integration Model

### 5.1 Suggested Screens

- Login
- Register
- Verify Registration OTP
- Forgot Password (request OTP)
- Reset Password (OTP + new password)

### 5.2 Client-Side Validation (Before API Call)

- Email format validation
- Password length/pattern checks (letters + numbers)
- Confirm password match in reset flow
- Required field presence checks

### 5.3 Session Storage Strategy

- Store access token in memory where possible.
- Store refresh token in secure storage:
  - Web: secure cookie or hardened storage strategy
  - Mobile: platform secure storage (Keychain/Keystore)
- Never log raw tokens in client logs.

### 5.4 Error Handling Branches

- `400`: show inline validation/OTP error messages.
- `401`: show auth failure message or force re-login.
- `409`: show duplicate registration conflict (email/phone/SSN).
- `429`: show retry-later message and cooldown UX.

## 6. Minimal QA Integration Checklist

- Register new user and verify OTP successfully.
- Login with registered user.
- Request password reset OTP and reset password.
- Login using new password after reset.
- Refresh token flow works after access token expiry.
- Logout revokes session; refresh fails after logout.
- Duplicate registration returns conflict handling UX.
- Throttling branch (`429`) shows clear retry guidance.
