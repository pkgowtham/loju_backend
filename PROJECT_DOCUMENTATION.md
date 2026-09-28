# Tandem Platform: Complete System Architecture, Operational Manual & New Project Blueprint

> **Document Version:** 1.0.0  
> **Target Audience:** Developers, Technical Leads, Product Architects, and Project Teams  
> **Source Repository:** `tandem-backend`  

---

## Table of Contents

1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Technology Stack & System Architecture](#2-technology-stack--system-architecture)
3. [Database Architecture & Entity Relationships](#3-database-architecture--entity-relationships)
4. [Authentication, Authorization & Role-Based Access Control (RBAC)](#4-authentication-authorization--role-based-access-control-rbac)
5. [Core Functional Modules & Operational Logic](#5-core-functional-modules--operational-logic)
   - [5.1 Domain-Gated Student Onboarding & Verification](#51-domain-gated-student-onboarding--verification)
   - [5.2 AI-Powered 3D Cartoon Memoji Avatar Generation](#52-ai-powered-3d-cartoon-memoji-avatar-generation)
   - [5.3 Societies, Clubs & Categorization System](#53-societies-clubs--categorization-system)
   - [5.4 Real-Time Chat & Sendbird Group Channels](#54-real-time-chat--sendbird-group-channels)
   - [5.5 Events, RSVP & Automated Push Reminder Engine](#55-events-rsvp--automated-push-reminder-engine)
   - [5.6 Company Partnerships & Student Discount Offers](#56-company-partnerships--student-discount-offers)
   - [5.7 Weighted Dynamic Social Feed Engine](#57-weighted-dynamic-social-feed-engine)
   - [5.8 Notifications & In-App Notification System](#58-notifications--in-app-notification-system)
   - [5.9 Content Moderation, Reporting & Cascade Cleanup](#59-content-moderation-reporting--cascade-cleanup)
   - [5.10 Direct-to-Memory Multipart S3 Upload & CDN System](#510-direct-to-memory-multipart-s3-upload--cdn-system)
6. [Complete API Endpoint Catalog](#6-complete-api-endpoint-catalog)
7. [Environment Configuration & Deployment Specification](#7-environment-configuration--deployment-specification)
8. [Blueprint: How to Replicate and Adapt into a New Project](#8-blueprint-how-to-replicate-and-adapt-into-a-new-project)
   - [8.1 Adapting to an Enterprise Employee Community](#81-adapting-to-an-enterprise-employee-community)
   - [8.2 Adapting to a Sports Club / Gym Community](#82-adapting-to-a-sports-club--gym-community)
   - [8.3 Step-by-Step Code Modification Checklist](#83-step-by-step-code-modification-checklist)
   - [8.4 Technical Debt & Architectural Modernization Recommendations](#84-technical-debt--architectural-modernization-recommendations)

---

## 1. Executive Summary & Product Vision

**Tandem** is a multi-tenant university student engagement and campus community backend platform built with Node.js, Express, and MongoDB. The system facilitates verified student interaction across campus societies, sports clubs, campus events, real-time messaging groups, and exclusive student commercial discount offers.

### Core Problems Solved by the Platform
1. **Verified Campus Exclusivity:** Students can only register if their email address matches an approved institutional email domain (e.g., `@kcl.ac.uk`, `@ucl.ac.uk`).
2. **Society Discovery & Management:** Multi-tier categorization (Topics and Sports) allowing students to discover societies, join clubs, and allow society leaders to manage announcements, events, and posts.
3. **Automated Event Engagement:** Automated morning push notifications reminding students of events they have RSVP'd to attend.
4. **Interactive Real-Time Communities:** Direct integration with Sendbird chat infrastructure, organizing students into synchronized group channels with member limits and message synchronization.
5. **Generative AI Profile Avatars:** Automated conversion of student profile pictures into 3D transparent cartoon avatars (memojis) via OpenAI's image editing API.
6. **Campus Offers & Commercial Perks:** Brand discounts and corporate vouchers filtered by university campus and category, with student redemption tracking.
7. **Campus Safety & Moderation:** Reporting workflows for societies and chat channels, with maintainer/admin moderation, blocking capabilities, and cascading soft-deletes.

---

## 2. Technology Stack & System Architecture

```
+-----------------------------------------------------------------------------------------+
|                                CLIENT APPLICATIONS                                      |
|                  (React Native / Expo Mobile App / Admin Web Dashboard)                 |
+-----------------------------------------------------------------------------------------+
                                             |
                                      HTTPS REST Calls
                                             v
+-----------------------------------------------------------------------------------------+
|                                     TANDEM API SERVER                                   |
|                                (Express 5.x on Node.js ES Modules)                      |
|                                                                                         |
|  +--------------------+  +----------------------+  +---------------------------------+  |
|  |     Middleware     |  |     Controllers      |  |         Utility Services        |  |
|  |--------------------|  |----------------------|  |---------------------------------|  |
|  | * JWT Authentication|  | * Auth & Onboarding  |  | * Direct Multipart S3 Streamer |  |
|  | * RBAC (Roles)     |  | * Student & Profile  |  | * SES Email Dispatcher         |  |
|  | * Error Handling   |  | * Society & Clubs    |  | * OpenAI Image Edits Client     |  |
|  | * Async Wrapper    |  | * Events & Feed      |  | * Sendbird Synchronizer         |  |
|  +--------------------+  | * Chat & Messaging   |  | * Expo Push SDK Engine          |  |
|                          | * Offers & Reports   |  | * Node-Cron Background Worker   |  |
|                          +----------------------+  +---------------------------------+  |
+-----------------------------------------------------------------------------------------+
       |               |                 |                 |                |
       v               v                 v                 v                v
+------------+  +--------------+  +--------------+  +--------------+  +---------------+
|  MongoDB   |  |   AWS S3 &   |  |   AWS SES    |  |   Sendbird   |  |     Expo      |
|  Atlas     |  |  CloudFront  |  |  (Email OTP) |  | (Real-time   |  | (Push Notif.  |
| (Mongoose) |  |  (Storage)   |  |              |  |    Chat)     |  |    Engine)    |
+------------+  +--------------+  +--------------+  +--------------+  +---------------+
```

### Technology Specification

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js (ES Modules `type: "module"`) | LTS (18+/20+) | Execution environment |
| **Web Framework** | Express | `5.1.0` | HTTP routing, request/response pipeline |
| **Database ODM** | Mongoose | `8.16.0` | Schema definition, ODM, queries, aggregation |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`) | `9.0.2` | Stateless bearer token issuance & validation |
| **Password Security** | BcryptJS (`bcryptjs`) | `3.0.2` | Salt generation and password hashing |
| **Push Notifications** | Expo Server SDK (`expo-server-sdk`) | `3.15.0` | Mobile push notifications to iOS and Android |
| **Email Delivery** | AWS SES Client (`@aws-sdk/client-ses`) | `3.839.0` | Transactional emails (signup, OTP password resets) |
| **Object Storage** | AWS S3 Client & Lib Storage | `3.839.0` | File uploads (profile photos, society banners, media) |
| **CDN** | AWS CloudFront | Custom Domain | Low-latency media delivery |
| **Generative AI** | OpenAI Image Edits API (`gpt-image-1`) | Via REST API | Automatic generation of 3D memoji avatars |
| **Chat & Messaging** | Sendbird REST API & SDK | `3.1.33` | Real-time chat channels, read receipts, announcements |
| **Scheduler / Cron** | Node-Cron | `4.2.1` | Automated 8:00 AM daily event reminder notifications |
| **Process Manager** | PM2 | Cluster Mode | Production deployment & load balancing |

---

## 3. Database Architecture & Entity Relationships

The database architecture employs **polymorphism** for account authentication: a master `User` collection handles login credentials and security tokens, pointing via `refPath` (`detailsModel`) to specialized entity collections (`Student`, `Admin`, or `Maintainer`).

### Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    UNIVERSITY ||--o{ STUDENT : "enrolled in"
    UNIVERSITY ||--o{ SOCIETY : "hosts"
    UNIVERSITY ||--o{ MAINTAINER : "managed by"
    UNIVERSITY ||--o{ COMPANY : "partners with"
    UNIVERSITY ||--o{ OFFER : "scoped to"

    USER ||--|| STUDENT : "auth for (polymorphic)"
    USER ||--|| ADMIN : "auth for (polymorphic)"
    USER ||--|| MAINTAINER : "auth for (polymorphic)"

    STUDENT ||--o{ NOTIFICATION_SETTING : "configures"
    STUDENT ||--o{ NOTIFICATION : "receives"
    STUDENT ||--o{ STUDENT_WITH_SOCIETY : "joins"
    SOCIETY ||--o{ STUDENT_WITH_SOCIETY : "has members"

    STUDENT ||--o{ STUDENT_WITH_SUBCATEGORY : "has interest"
    SUBCATEGORY ||--o{ STUDENT_WITH_SUBCATEGORY : "selected in"
    CATEGORY ||--o{ SUBCATEGORY : "contains"
    CATEGORY ||--o{ SOCIETY : "classifies"
    SUBCATEGORY ||--o{ SOCIETY : "classifies"

    SOCIETY ||--o{ EVENT : "organizes"
    SOCIETY ||--o{ POST : "publishes"
    SOCIETY ||--o{ CHAT_GROUPS : "creates"
    STUDENT ||--o{ STUDENT_WITH_EVENT : "attends / RSVPs"
    EVENT ||--o{ STUDENT_WITH_EVENT : "has attendees"

    COMPANY ||--o{ OFFER : "provides"
    STUDENT ||--o{ STUDENT_WITH_OFFER : "redeems"
    OFFER ||--o{ STUDENT_WITH_OFFER : "redeemed by"

    STUDENT ||--o{ REPORT : "files"
    STUDENT ||--o{ FEEDBACK : "submits"
```

### Detailed Schema Specifications

#### 1. `User` (Authentication Core)
- `email` (String, Required, Unique): User's primary login identifier.
- `password` (String, Required): Bcrypt salted hash.
- `role` (String, Enum: `["ADMIN", "MAINTAINER", "STUDENT"]`): System role.
- `details` (ObjectId, refPath: `detailsModel`): Reference to `Student`, `Admin`, or `Maintainer`.
- `detailsModel` (String, Enum: `["Admin", "Maintainer", "Student"]`): Polymorphic target schema.
- `notificationToken` (String): Expo push notification token.
- `resetOtp` (String): 6-digit numeric OTP for password reset.
- `resetOtpExpiry` (Date): Expiration timestamp (30 minutes).

#### 2. `Student` (End-User Profile)
- `firstName`, `lastName` (String, Required).
- `year` (String, Enum: `["FIRST_YEAR", "SECOND_YEAR", "THIRD_YEAR", "FOURTH_YEAR", "FOUNDATION_YEAR", "OTHER"]`).
- `university` (ObjectId, Ref: `University`, Required).
- `dp` (String): S3/CloudFront URL for raw uploaded profile photo.
- `avatar` (String): S3/CloudFront URL for AI-generated 3D memoji.
- `avatarBg` (String): Selected background color hex for memoji display.
- `avatarDisplay` (Boolean, Default: false): Toggles whether memoji or raw DP is shown.
- `isBlocked` (Boolean, Default: false): Account restriction flag.
- `socialHandles`: Subdocument containing `instagram`, `tiktok`, `snapchat`.
- `societyAdmin` (Array of ObjectId, Ref: `Society`): Societies this student administers.
- `chats` (Array of ObjectId, Ref: `ChatGroups`): Chat groups the student is enrolled in.

#### 3. `Maintainer` (Campus / University Manager)
- `firstName`, `lastName` (String, Required).
- `dp` (String): Profile image URL.
- `universityId` (ObjectId, Ref: `University`, Required): Campus this maintainer supervises.
- `active` (Boolean, Default: true): Status indicator.

#### 4. `Admin` (Superuser Platform Operator)
- `firstName`, `lastName` (String, Required).
- `dp` (String): Image URL.

#### 5. `University` (Campus Tenant Entity)
- `name` (String, Required): Full institution name (e.g. "King's College London").
- `shortName` (String, Required): Abbreviation (e.g. "KCL").
- `website` (String, Required): Official website URL.
- `emailDomain` (String, Required): Unique domain constraint (e.g. `kcl.ac.uk`).
- `logo` (Array of Strings): University branding asset URLs.

#### 6. `Society` (Student Clubs & Organizations)
- `name` (String, Required): Society name.
- `description` (String, Required).
- `universityId` (ObjectId, Ref: `University`, Required).
- `category` (ObjectId, Ref: `Category`, Required).
- `subcategory` (ObjectId, Ref: `Subcategory`, Required).
- `type` (String, Enum: `["TOPICS", "SPORTS"]`, Required).
- `logo`, `banner` (String, Required): Asset URLs.
- `display` (Boolean, Default: true): Visibility flag.
- `follower` (Number, Default: 0): Member counter.
- `adminId` (ObjectId, Ref: `Student`): Primary student lead.
- `activityAdminId` (Array of ObjectId, Ref: `Student`): Secondary operational admins.

#### 7. `Event` (Campus & Society Events)
- `name` (String, Required).
- `description` (String).
- `location` (String, Required): Physical venue or hall.
- `locationUrl` (String): Google Maps or venue link.
- `society` (ObjectId, Ref: `Society`, Required).
- `startingTime`, `endingTime` (Date, Required).
- `bannerUrl` (String, Required).
- `multimediaUrl` (Array of Strings).
- `display` (Boolean, Default: true).
- `sharable` (Boolean, Default: true).

#### 8. `StudentWithEvent` (Event Attendance / RSVP)
- `studentId` (ObjectId, Ref: `Student`, Required).
- `eventId` (ObjectId, Ref: `Event`, Required).
- `allow` (Boolean, Default: true).
- `going` (Boolean, Default: true): Attendance state toggle.

#### 9. `ChatGroups` (Sendbird Channel Bridge)
- `name` (String, Required): e.g. "Chess Club Chat 1".
- `societyId` (ObjectId, Ref: `Society`).
- `studentsId` (Array of ObjectId, Ref: `Student`): Enrolled students.
- `channels` (String): Sendbird group channel URL (regex: `/^sendbird_group_channel_/`).
- `memberLimit` (Number, Default: 5): Maximum capacity per chat channel instance.

#### 10. `Offer` & `Company` (Commercial Student Perks)
- `Company`: `name`, `dpUrl`, `category` (e.g. `FOOD & BEVERAGE`, `TECH`, `FASHION`), `universityId`, `contactEmail`.
- `Offer`: `name`, `company` (Ref: `Company`), `universityId`, `description`, `location`, `terms`, `procedure`, `startingDate`, `expiryDate`, `code`, `availLink`, `dpUrl`.
- `StudentWithOffer`: `studentId`, `offerId`, `redeemedOn` (Date).

#### 11. `Notification` & `NotificationSetting`
- `Notification`: `studentId`, `senderId`, `type` (`["MESSAGE", "EVENT", "SOCIETY", "OFFER", "POST"]`), `messageContent`, `messageUrl`, references to `eventId`, `societyId`, `offerId`, `postId`, `isRead` (Boolean).
- `NotificationSetting`: `studentId`, boolean toggles for `message`, `event`, `society`, `offer`, `post`.

---

## 4. Authentication, Authorization & Role-Based Access Control (RBAC)

The security layer is centralized in [middleware/authentication.js](file:///c:/Users/ragul/Downloads/tandem-master%20%281%29/tandem-master/middleware/authentication.js).

### Authentication Pipeline
1. **Header Extraction:** Extracts `Authorization: Bearer <JWT>` from incoming request headers.
2. **Token Verification:** Validates the signature using `process.env.TOKEN_SECRET`.
3. **User Record Lookup:** Loads `User` from the database using the decoded token `id`.
4. **Polymorphic Details Resolution:** Based on `user.role`, dynamically populates the linked record from `Student`, `Admin`, or `Maintainer`.
5. **Account Status Check:** If `user.role === 'STUDENT'`, verifies `details.isBlocked === false`. If blocked, immediately aborts with `HTTP 403 Forbidden`.
6. **Context Injection:** Attaches the authenticated profile to `req.auth`:
   ```javascript
   req.auth = {
     _id: user._id,
     role: user.role,
     email: user.email,
     details: detailsRecord
   };
   ```

### Role-Based Access Control (`authorizeRole`)
Endpoints are guarded by the `authorizeRole` higher-order middleware:
- `ADMIN`: Platform superusers who manage universities, system admins, maintainers, global categories, and review system feedback.
- `MAINTAINER`: Campus officials scoped to a specific `universityId` who manage campus societies, bulk CSV society uploads, company partnerships, and student moderation.
- `STUDENT`: Verified university students who participate in societies, attend events, chat, generate avatars, and redeem offers.

---

## 5. Core Functional Modules & Operational Logic

### 5.1 Domain-Gated Student Onboarding & Verification

```mermaid
sequenceDiagram
    autonumber
    actor S as Student (Client)
    participant API as Tandem API Server
    participant DB as MongoDB
    participant SES as AWS SES

    S->>API: POST /v1/student/checkEmail { email: "student@kcl.ac.uk" }
    API->>DB: Check if email already exists in User
    API->>DB: Extract domain "kcl.ac.uk", find University
    alt Domain Not Registered
        API-->>S: 400 Bad Request ("Email domain not allowed")
    else Domain Valid
        API-->>S: 200 OK { universityId, universityName }
    end

    S->>API: POST /v1/student/signup { firstName, lastName, year, email, password }
    API->>API: Validate password complexity & hash with Bcrypt
    API->>DB: Create Student document & User document (role: STUDENT)
    API->>DB: Generate 6-digit OTP, store with 30-min expiry
    API->>SES: Render reset.html template & send OTP email
    API-->>S: 200 OK ("OTP sent to email")

    S->>API: POST /v1/student/verifyOtp { email, otp }
    API->>DB: Verify OTP & expiry
    API->>DB: Auto-initialize NotificationSetting (all true, offer false)
    API->>API: Generate JWT Token
    API-->>S: 200 OK { token, studentProfile }
```

### 5.2 AI-Powered 3D Cartoon Memoji Avatar Generation

Located in [controller/student.js](file:///c:/Users/ragul/Downloads/tandem-master%20%281%29/tandem-master/controller/student.js#L290-L343):

1. **Photo Upload:** The student uploads a profile photo (`dp`) via multipart form-data.
2. **Buffer Stream:** The file is streamed into memory, uploaded to AWS S3, and assigned an accessible CloudFront CDN URL.
3. **OpenAI Edits Request:**
   - The image buffer is fetched and sent to `https://api.openai.com/v1/images/edits`.
   - **Model:** `gpt-image-1` (or OpenAI image edit endpoint).
   - **Prompt:** *"A 3D digital illustration of the uploaded student profile picture, rendered as a cartoon-style memoji avatar. Include only the head/face, removing shoulders, hands, or any body parts. The background must be completely removed and fully transparent."*
   - **Response Format:** Base64 JSON (`b64_json`).
4. **Permanent Storage:** The resulting base64 image is converted to a Buffer and uploaded to AWS S3 under `student-avatars/{studentId}-memoji.png`.
5. **Database Update:** The student's `avatar` property is updated with the S3 URL.
6. **Client Selection:** The student can toggle between showing their real photo or AI avatar via `avatarDisplay: true/false` and select a background color `avatarBg`.

### 5.3 Societies, Clubs & Categorization System

Societies are categorized into **Topics** (academic, arts, cultural) or **Sports** (football, rugby, badminton).

- **Maintainer Creation:** Maintainers create societies scoped to their university. They can upload via single multipart request or bulk upload using CSV format via `csv-parse`.
- **Auto-Sync to Sendbird:** Creating a society automatically initiates a Sendbird group channel for community discussions.
- **Activity Admins:** Primary student leaders and secondary activity admins are granted administrative rights over the society (`societyAdmin` array in `Student`).
- **Joining & Follower Metrics:** Joining a society increments the society's `follower` count, creates a `StudentWithSociety` relation, and auto-adds the student to the society's Sendbird chat channel.

### 5.4 Real-Time Chat & Sendbird Group Channels

Chat functionality combines local MongoDB metadata with Sendbird's REST API:

- **Channel Partitioning & Member Limits:** Each `ChatGroups` record maintains a `memberLimit` (default: 5 members per group instance or configurable). When a channel fills up, new channels can be dynamically spun up (e.g., `Society Chat 1`, `Society Chat 2`).
- **User Synchronization:** When students join a chat, the API verifies or creates their profile in Sendbird using their student ID, display name, and avatar URL.
- **Attachment Support:** Sending a message (`/v1/message/send`) accepts multipart files, uploads them to AWS S3, and injects the resulting CloudFront URLs into the Sendbird message payload metadata.
- **Read Receipts:** Marking messages read calls `/v1/message/students/:studentId/channels/:channelUrl/mark-read`, updating Sendbird's unread tracking.

### 5.5 Events, RSVP & Automated Push Reminder Engine

```mermaid
sequenceDiagram
    autonumber
    actor Lead as Society Admin (Student)
    participant API as Tandem API Server
    participant DB as MongoDB
    participant Expo as Expo Push Service
    participant Cron as Node-Cron Worker

    Note over Lead,API: Event Creation & Instant Notification
    Lead->>API: POST /v1/event (name, date, time, venue, banner)
    API->>DB: Save Event document
    API->>DB: Find all active members of the Society
    API->>DB: Check NotificationSetting (event === true)
    API->>Expo: Send Expo push notifications to all valid push tokens
    API->>DB: Insert Notification documents into DB

    Note over Cron,Expo: Automated 8:00 AM Event Reminder
    Cron->>DB: Runs daily at 08:00 (Europe/London)
    Cron->>DB: Query events starting today (startingTime >= startOfToday)
    loop For each event today
        Cron->>DB: Find StudentWithEvent where going == true and allow == true
        Cron->>DB: Load student Expo push tokens
        Cron->>Expo: Dispatch push notification: "Your event starts at [Time] at [Venue]"
    end
```

### 5.6 Company Partnerships & Student Discount Offers

- **Campus-Restricted Perks:** Companies partner with universities. Maintainers publish discount offers tied to specific categories (e.g., `FOOD & BEVERAGE`, `ENTERTAINMENT`, `TRAVEL`).
- **Redemption Enforcement:** Students can view active offers and click redeem (`/v1/offer/redeem`).
- **One-Time Redemption Tracking:** `StudentWithOffer` ensures that each student can only claim a specific discount code or voucher once, preventing duplicate claims.

### 5.7 Weighted Dynamic Social Feed Engine

The feed controller [controller/feed.js](file:///c:/Users/ragul/Downloads/tandem-master%20%281%29/tandem-master/controller/feed.js) implements a balanced aggregation algorithm:

1. **Student Scoping:** Identifies all societies joined by the requesting student via `StudentWithSociety`.
2. **Dynamic Weight Calculation:** Rather than a simple chronological query, it determines the ratio between available `Post` documents and `Event` documents:
   $$\text{postRatio} = \frac{\text{postCount}}{\text{postCount} + \text{eventCount}}$$
   $$\text{eventRatio} = \frac{\text{eventCount}}{\text{postCount} + \text{eventCount}}$$
3. **Proportional Pagination:** For a page size of $N$ (e.g., 10 items), it retrieves $\text{round}(N \times \text{postRatio})$ posts and the remainder in events.
4. **Attendance Enrichment:** Cross-references the fetched events with `StudentWithEvent` to append `joined: true/false` and `going: true/false` flags for the specific student.
5. **Combined Sorting:** Combines posts and events into a single timeline sorted chronologically by `createdAt: -1`.

### 5.8 Notifications & In-App Notification System

1. **User Preference Matrix:** Every student has a `NotificationSetting` document with boolean flags: `message`, `event`, `society`, `offer`, `post`.
2. **Dual-Channel Dispatch:**
   - **In-App Notification:** A persistent document created in the `Notification` collection.
   - **Push Notification:** Dispatched via `expo-server-sdk` using the student's stored `notificationToken`.
3. **Notification Preferences:** If a student disables a category (e.g. `offer: false`), both push notifications and in-app document creations for that category are skipped.

### 5.9 Content Moderation, Reporting & Cascade Cleanup

Campus safety is enforced through reporting, account suspension, and deep cascade deletion:

1. **Reporting:** Students can report harmful societies or toxic chat channels (`/v1/chatGroups/reportChat` or `/v1/report/`).
   - Categories: `BULLYING`, `HATE`, `INAPPROPRIATE`, `SPAM`, `UNSAFE`, `OTHERS`.
   - Status Workflow: `OPEN` $\rightarrow$ `INVESTIGATING` $\rightarrow$ `RESOLVED` $\rightarrow$ `CLOSED`.
2. **Student Account Suspension (Block/Unblock):**
   - Admin or Maintainer triggers `/v1/student/block`.
   - Sets `Student.isBlocked = true`.
   - The authentication middleware rejects subsequent requests with a `403 Forbidden` response.
3. **Cascade Soft-Delete / Hard Cleanup:**
   - When a student profile is deleted (`/v1/student/delete/:studentId`):
     - The profile is masked to `"Deleted User"` with a generic avatar.
     - Sendbird user nickname is updated to `"Deleted User"`.
     - Student ID is pulled from all `ChatGroups`.
     - All related junction records (`studentWithSubcategory`, `StudentWithSociety`, `StudentWithEvent`, `StudentWithOffer`, `Notification`, `NotificationSetting`, `Report`, and `User`) are cleaned up.

### 5.10 Direct-to-Memory Multipart S3 Upload & CDN System

Defined in [utils/s3Upload.js](file:///c:/Users/ragul/Downloads/tandem-master%20%281%29/tandem-master/utils/s3Upload.js):

- **Zero-Disk Streaming:** Rather than writing temporary files to server disk (which poses security risks and container storage limits), the server streams multipart buffers directly into memory and passes chunks to AWS S3 using `@aws-sdk/lib-storage`'s `Upload` stream.
- **Constraints Enforcement:**
  - `maxFileSize` validation (default: 20MB or environment configured).
  - `maxFileCount` enforcement (e.g., maximum 5 event photos, 1 profile avatar).
- **CDN Formatting:** Keys are assigned UUIDs (`uploads/{uuid}.ext`) and returned as direct CloudFront CDN URLs (`https://${process.env.AWS_CDN}/${key}`).

---

## 6. Complete API Endpoint Catalog

### Authentication (`/v1/auth`)
| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/login` | No | Public | Authenticates user credentials and returns JWT token |
| `POST` | `/v1/auth/validateResetEmail` | No | Public | Validates if email exists before sending reset OTP |
| `POST` | `/v1/auth/sendResetOtp` | No | Public | Dispatches 6-digit OTP to user email via AWS SES |
| `POST` | `/v1/auth/verifyOtpAndResetPassword`| No | Public | Verifies OTP and updates account password |
| `PATCH`| `/v1/auth/editExpoTokenPush` | Yes | All | Registers or updates device Expo push token |
| `GET`  | `/v1/auth/checkStudentBlockStatus` | Yes | `STUDENT` | Checks if the student account has been blocked |

### Student Management (`/v1/student`)
| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/student/checkEmail` | No | Public | Verifies if email domain matches an active university |
| `POST` | `/v1/student/signup` | No | Public | Registers a new student and sends email OTP |
| `POST` | `/v1/student/verifyOtp` | No | Public | Confirms OTP, activates account, and issues JWT |
| `PATCH`| `/v1/student/:studentId/dp` | No | Public | Uploads photo & triggers OpenAI 3D memoji generation |
| `PATCH`| `/v1/student/:studentId/avatar` | No | Public | Selects active avatar URL |
| `PATCH`| `/v1/student/:studentId/bg` | No | Public | Sets avatar background color |
| `PATCH`| `/v1/student/:studentId/social`| Yes | `STUDENT` | Updates Instagram, TikTok, and Snapchat handles |
| `POST` | `/v1/student/resetPassword` | Yes | `STUDENT` | Resets password for authenticated session |
| `PATCH`| `/v1/student/update/:studentId`| Yes | `STUDENT` | Updates student profile information |
| `DELETE`| `/v1/student/delete/:studentId`| Yes| `STUDENT` | Initiates account deletion & data cleanup |
| `GET`  | `/v1/student/getById` | Yes | All | Gets student profile by authenticated context |
| `GET`  | `/v1/student/getByStudentSocietyId`| Yes | All | Retrieves societies where student is admin |
| `GET`  | `/v1/student/getByUniversityId`| Yes| `MAINTAINER` | Retrieves all students in maintainer's university |
| `PATCH`| `/v1/student/block` | Yes | `ADMIN`, `MAINTAINER` | Blocks student from accessing the platform |
| `PATCH`| `/v1/student/unblock` | Yes | `ADMIN`, `MAINTAINER` | Unblocks student account |
| `GET`  | `/v1/student/` | Yes | `ADMIN`, `MAINTAINER` | Lists students with pagination |

### Society & Clubs (`/v1/society`)
| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/society/` | Yes | `MAINTAINER` | Creates a new society and initializes Sendbird chat |
| `POST` | `/v1/society/societyCsv` | Yes | `MAINTAINER` | Bulk imports societies via CSV upload |
| `PATCH`| `/v1/society/:id` | Yes | `MAINTAINER` | Updates society profile and banners |
| `DELETE`| `/v1/society/:id` | Yes | `MAINTAINER` | Deletes society |
| `GET`  | `/v1/society/getAll` | Yes | All | Lists all visible societies |
| `GET`  | `/v1/society/getByStudentInterest`| Yes| `STUDENT` | Returns societies matching student's subcategories |
| `GET`  | `/v1/society/getByStudentJoined`| Yes | `STUDENT` | Returns societies joined by student |
| `GET`  | `/v1/society/getByStudentNotInterest`| Yes| `STUDENT`| Explores undiscovered societies |
| `GET`  | `/v1/society/getByCategory/:categoryId`| Yes| All | Filters societies by primary category |
| `POST` | `/v1/society/getBySubcategories`| Yes| All | Filters societies by subcategory list |
| `GET`  | `/v1/society/getByType` | Yes | All | Filters societies by type (`TOPICS` or `SPORTS`) |
| `GET`  | `/v1/society/getBySocietyId/:societyId`| Yes| All| Returns full society detail |
| `GET`  | `/v1/society/getByUniversityId`| Yes| `MAINTAINER` | Gets societies belonging to university |
| `POST` | `/v1/society/joinSocieties` | Yes | `STUDENT` | Joins a society and syncs student into chat |
| `POST` | `/v1/society/leaveSociety` | Yes | `STUDENT` | Leaves society and removes student from chat |

### Events (`/v1/event`)
| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/event/` | Yes | `STUDENT` (Society Admin)| Creates new society event and triggers push alerts |
| `PATCH`| `/v1/event/:id` | Yes | `STUDENT` (Society Admin)| Updates event details and assets |
| `GET`  | `/v1/event/getByUniversityId`| Yes| `MAINTAINER` | Lists events for university maintainer |
| `GET`  | `/v1/event/getByUpcoming` | Yes | `STUDENT` | Gets upcoming events for student |
| `GET`  | `/v1/event/getById/:id` | Yes | `STUDENT` | Gets specific event details and RSVP state |
| `GET`  | `/v1/event/:societyId` | Yes | `STUDENT` | Lists events organized by a specific society |
| `DELETE`| `/v1/event/:id` | Yes | `STUDENT`, `MAINTAINER`| Deletes event |
| `POST` | `/v1/event/joinEvent` | Yes | `STUDENT` | Adds event to student calendar |
| `POST` | `/v1/event/toggleGoingStatus`| Yes| `STUDENT` | Toggles RSVP state (`going: true / false`) |

### Feed (`/v1/feed`)
| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET`  | `/v1/feed/all` | Yes | `STUDENT` | Combined weighted feed of posts and events |
| `GET`  | `/v1/feed/event` | Yes | `STUDENT` | Filtered feed of events from joined societies |
| `GET`  | `/v1/feed/post` | Yes | `STUDENT` | Filtered feed of posts from joined societies |

### Chat & Messaging (`/v1/chatGroups`, `/v1/message`, `/v1/societyAnnouncement`)
| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET`  | `/v1/chatGroups/chatGroupsList/:studentsId`| Yes| All | Lists all chat groups student belongs to |
| `POST` | `/v1/chatGroups/reportChat` | Yes | All | Files a report on inappropriate chat behavior |
| `POST` | `/v1/message/send` | No | Public (Token Header)| Sends message with attachments to Sendbird |
| `GET`  | `/v1/message/studentChannels/:studentId`| No| Public | Retrieves active group channels and unread counts |
| `GET`  | `/v1/message/studentMessages/:studentId/:channels`| No| Public| Retrieves message history from Sendbird channel |
| `PATCH`| `/v1/message/students/:studentId/channels/:channelUrl/mark-read`| No| Public| Marks all channel messages as read |
| `POST` | `/v1/societyAnnouncement/announcement`| No| Public| Broadcasts admin announcement across channels |

### Commercial Offers (`/v1/company`, `/v1/offer`)
| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/company/` | Yes | `ADMIN`, `MAINTAINER` | Creates partner company record |
| `GET`  | `/v1/company/` | Yes | `ADMIN`, `STUDENT` | Lists partner companies |
| `POST` | `/v1/offer/` | Yes | `ADMIN`, `MAINTAINER` | Creates new discount offer with vouchers |
| `GET`  | `/v1/offer/` | Yes | `ADMIN`, `STUDENT` | Lists available offers with category filters |
| `GET`  | `/v1/offer/:offerId` | No | Public | Returns offer details and redemption counts |
| `POST` | `/v1/offer/redeem` | Yes | `STUDENT` | Redeems discount voucher (one-time use) |

### Notifications & Reminders (`/v1/notification`, `/v1/notificationSetting`, `/v1/reminderEvent`)
| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET`  | `/v1/notification/remainder/:studentId`| Yes| All | Lists in-app notifications for student |
| `DELETE`| `/v1/notification/:id` | No | Public | Deletes single notification |
| `DELETE`| `/v1/notification/clearUpNoification/:studentId`| No| Public| Deletes all notifications for student |
| `GET`  | `/v1/notificationSetting/:studentId`| No| Public | Gets notification preference toggles |
| `PATCH`| `/v1/notificationSetting/update/:id`| No| Public | Updates category notification toggles |
| `POST` | `/v1/reminderEvent/` | No | Dev Only | Manually triggers the 8:00 AM reminder cron job |

### Administration, Reports & Health (`/v1/admin`, `/v1/university`, `/v1/maintainer`, `/v1/report`, `/v1/feedBack`, `/v1/health`)
| Method | Endpoint | Auth Required | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/admin/` | Yes | `ADMIN` | Creates new platform administrator |
| `POST` | `/v1/university/` | Yes | `ADMIN` | Provisions new university tenant with email domain |
| `GET`  | `/v1/university/` | Yes | `ADMIN` | Lists all university tenants |
| `POST` | `/v1/maintainer/` | Yes | `ADMIN` | Creates campus maintainer for university |
| `GET`  | `/v1/report/` | Yes | `ADMIN`, `MAINTAINER` | Lists filed safety and content reports |
| `PATCH`| `/v1/report/:reportId` | Yes | `ADMIN`, `MAINTAINER` | Updates report status (`OPEN`, `INVESTIGATING`, etc.) |
| `POST` | `/v1/feedBack/` | Yes | `STUDENT` | Submits bug report or feature feedback |
| `GET`  | `/v1/health/` | No | Public | Health check route (`{ status: "ok" }`) |

---

## 7. Environment Configuration & Deployment Specification

### Complete `.env` Variable Reference

```env
# ==============================================================================
# SERVER & INFRASTRUCTURE
# ==============================================================================
PORT=8000
NODE_ENV=production

# ==============================================================================
# DATABASE CONFIGURATION
# ==============================================================================
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/tandem?retryWrites=true&w=majority

# ==============================================================================
# AUTHENTICATION & SECURITY
# ==============================================================================
TOKEN_SECRET=your_super_secret_jwt_key_here_minimum_32_characters

# ==============================================================================
# AWS CLOUD SERVICES (S3, CLOUDFRONT, SES)
# ==============================================================================
AWS_REGION=eu-west-2
AWS_KEY=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_BUCKET=tandem-media-storage
AWS_CDN=d3hgroojph8hh.cloudfront.net
SES_EMAIL_FROM=noreply@tandemapp.com
DEFAULT_MAX_FILE_SIZE=20971520
DEFAULT_MAX_FILE_COUNT=5

# ==============================================================================
# REAL-TIME CHAT (SENDBIRD)
# ==============================================================================
SENDBIRD_APP_ID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
SENDBIRD_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ==============================================================================
# GENERATIVE AI (OPENAI MEMOJI GENERATION)
# ==============================================================================
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> [!TIP]
> A complete ready-to-copy template is provided in the repository root as [`.env.example`](file:///c:/Users/ragul/Downloads/tandem-master%20%281%29/tandem-master/.env.example). Copy it to `.env` using:
> ```bash
> cp .env.example .env
> ```

---

### 7.2 Developer Guide: How to Add New Environment Keys for Your New Project

When you modify this project or build a new application, you will frequently need to add new API keys, secrets, or configuration switches (e.g., Stripe, Twilio, Redis, Firebase, Webhooks). Follow this standard procedure:

#### Step 1: Define the Key in `.env` and `.env.example`
Always add the key to both your local `.env` (with real/sandbox credentials) and `.env.example` (with placeholder documentation):
```env
# Example: Adding Stripe Payment Keys
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYMENT_CURRENCY=gbp
```

#### Step 2: How Environment Variables are Loaded in Tandem
In this codebase:
1. `index.js` loads environment variables via:
   ```javascript
   import dotenv from "dotenv";
   dotenv.config();
   ```
2. The `npm run dev` script loads it via:
   ```json
   "dev": "nodemon --require dotenv/config ./index.js"
   ```
3. In production, `ecosystem.config.cjs` (PM2) executes:
   ```javascript
   node_args: '--require dotenv/config'
   ```

Because ES modules hoist `import` statements, any file that accesses `process.env.MY_KEY` at top-level evaluation should import `dotenv` or be called after `index.js` bootstraps.

#### Step 3: Best Practice — Centralized Configuration Module (`utils/config.js`)
Instead of referencing `process.env.YOUR_KEY` in dozens of controllers, create a centralized `utils/config.js` file. This validates that all required keys are present when the server boots, failing fast if any required key is missing:

```javascript
// utils/config.js
import dotenv from "dotenv";
dotenv.config();

const requiredKeys = [
  "PORT",
  "MONGO_URI",
  "TOKEN_SECRET",
  "AWS_REGION",
  "AWS_KEY",
  "AWS_SECRET",
  "AWS_BUCKET",
  "AWS_CDN",
  "SES_EMAIL_FROM",
  "SENDBIRD_APP_ID",
  "SENDBIRD_API_TOKEN",
  "OPENAI_API_KEY"
];

// Validate presence of required keys on startup
for (const key of requiredKeys) {
  if (!process.env[key]) {
    console.error(`❌ CRITICAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 8000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.TOKEN_SECRET,
  aws: {
    region: process.env.AWS_REGION,
    key: process.env.AWS_KEY,
    secret: process.env.AWS_SECRET,
    bucket: process.env.AWS_BUCKET,
    cdn: process.env.AWS_CDN,
    sesFrom: process.env.SES_EMAIL_FROM,
    maxFileSize: parseInt(process.env.DEFAULT_MAX_FILE_SIZE, 10) || 20971520,
    maxFileCount: parseInt(process.env.DEFAULT_MAX_FILE_COUNT, 10) || 5,
  },
  sendbird: {
    appId: process.env.SENDBIRD_APP_ID,
    apiToken: process.env.SENDBIRD_API_TOKEN,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  // Add your new project services here:
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  }
};
```

#### Step 4: Accessing New Keys in Your Controllers / Services
Once defined, simply import `config` or read `process.env`:
```javascript
// Example in a new controller:
import { config } from "../utils/config.js";

export const processPayment = async (req, res) => {
  const stripe = new Stripe(config.stripe.secretKey);
  // ...
};
```

---

### 7.3 Production PM2 Configuration (`ecosystem.config.cjs`)

The application is configured to run in cluster mode across multiple worker processes for high availability:

```javascript
module.exports = {
  apps: [
    {
      name: 'tandem',
      script: './index.js',
      cwd: '/home/ubuntu/tandem',
      exec_mode: 'cluster',
      instances: 2,
      node_args: '--require dotenv/config',
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

---

## 8. Blueprint: How to Replicate and Adapt into a New Project

When taking this codebase to build a **new related product**, use the domain adaptation mappings below.

### 8.1 Adapting to an Enterprise Employee Community

| Tandem Concept (Current) | Enterprise Project Concept (New) | Code Modifications Required |
| :--- | :--- | :--- |
| `University` | `Organization` / `CompanyBranch` | Rename model; domain check validates `@company.com` emails |
| `Student` | `Employee` / `Staff` | Replace `year` with `department` (`"ENGINEERING"`, `"SALES"`, `"HR"`) |
| `Maintainer` | `HRManager` / `OfficeLead` | Scoped to manage branches, corporate benefits, and committees |
| `Society` | `EmployeeResourceGroup` (ERG) / `Club`| Groups like "Women in Tech", "Company Football", "Book Club" |
| `Event` | `CompanyEvent` / `TownHall` | Calendar of team outings, lunch & learns, and all-hands meetings |
| `Offer` | `CorporatePerk` / `EmployeeBenefit` | Gym memberships, hardware discounts, wellness vouchers |
| `Sendbird Chat` | Internal Team Channels | Integrates with existing Sendbird or internal Slack/Teams bridge |

### 8.2 Adapting to a Sports Club / Gym Community

| Tandem Concept (Current) | Sports Club Concept (New) | Code Modifications Required |
| :--- | :--- | :--- |
| `University` | `ClubFacility` / `FranchiseLocation`| Validates membership ID or branch domain |
| `Student` | `Athlete` / `GymMember` | Replace `year` with `skillLevel` (`"BEGINNER"`, `"ADVANCED"`) |
| `Maintainer` | `Coach` / `BranchManager` | Coordinates schedules, facilities, and trainer appointments |
| `Society` | `SportsTeam` / `TrainingClass` | "CrossFit Squad", "Morning Yoga", "BJJ Club" |
| `Event` | `Tournament` / `ClassSession` | Automated 8:00 AM class reminders via Expo push |
| `Offer` | `SupplementDiscount` / `GearDeal`| Supplement discounts, protein bars, apparel deals |

---

### 8.3 Step-by-Step Code Modification Checklist

Follow this systematic roadmap to transform this codebase into your new project:

```
[ ] 1. ENVIRONMENT & BRANDING
    [ ] Duplicate repository and initialize a fresh Git history
    [ ] Update package.json name, author, and description
    [ ] Update email templates in /template/email/ (replace Tandem logo and colors)
    [ ] Update AWS S3 bucket, CloudFront domain, and SES sender email

[ ] 2. SCHEMA TRANSFORMATION (/model)
    [ ] Rename or refactor model/university.js to your tenant model (e.g. organization.js)
    [ ] Update model/student.js -> model/member.js (modify fields like year, department, etc.)
    [ ] Update model/user.js polymorphic detailsModel enum to match new entity names
    [ ] Update model/society.js -> model/group.js or model/club.js

[ ] 3. CONTROLLERS & LOGIC (/controller)
    [ ] Refactor controller/student.js to match new member fields and verification logic
    [ ] Refactor controller/society.js to reflect new group creation rules
    [ ] Review OpenAI memoji avatar prompt in controller/student.js:
        - If professional/corporate: customize prompt to produce professional stylized 3D avatars
        - If not needed: disable image edits API and store standard cropped photos

[ ] 4. ROUTE MAPPINGS (/route & index.js)
    [ ] Rename route files to match new domain concepts (e.g. /v1/organization/, /v1/member/)
    [ ] Mount renamed routers in index.js
    [ ] Update role authorization lists (e.g. replace "STUDENT" with "MEMBER")

[ ] 5. NOTIFICATIONS & CRON JOBS (/utils/reminderEvent.js)
    [ ] Configure cron execution timezone (default: Europe/London) to target region
    [ ] Customize push notification title and copy format

[ ] 6. CHAT & REAL-TIME MESSAGING
    [ ] Provide new SENDBIRD_APP_ID and SENDBIRD_API_TOKEN in .env
    [ ] Or substitute with alternative chat providers (Socket.io, Stream Chat, Firebase)
```

---

### 8.4 Technical Debt & Architectural Modernization Recommendations

When creating your new project based on this codebase, implement these recommended technical improvements:

1. **Enable CORS Middleware:**
   In [index.js](file:///c:/Users/ragul/Downloads/tandem-master%20%281%29/tandem-master/index.js#L5), `app.use(cors())` is currently commented out. For cross-origin client apps (web dashboards, Expo web), enable and configure CORS with allowed origins.

2. **Schema Validation Modernization (Zod / Joi):**
   The project currently uses a custom runtime validator in [utils/validation.js](file:///c:/Users/ragul/Downloads/tandem-master%20%281%29/tandem-master/utils/validation.js). Migrating to **Zod** provides TypeScript-like type safety, automatic request body parsing, and comprehensive field error messages.

3. **Database Indexing:**
   Ensure explicit compound indexes are placed on frequently queried query paths:
   ```javascript
   // Recommended indexes in your new project models:
   studentWithSocietySchema.index({ student: 1, society: 1 }, { unique: true });
   studentWithEventSchema.index({ studentId: 1, eventId: 1 }, { unique: true });
   eventSchema.index({ society: 1, startingTime: 1 });
   userSchema.index({ email: 1 }, { unique: true });
   ```

4. **Structured Logging:**
   Replace raw `console.log` and `console.error` statements with a structured JSON logger like **Pino** or **Winston** to facilitate log parsing in cloud environments (AWS CloudWatch, Datadog).

5. **Security Hardening:**
   - Add `helmet` middleware to set HTTP security headers.
   - Add `express-rate-limit` to prevent brute-force attacks on `/v1/auth/login` and `/v1/student/verifyOtp`.

---

## 9. Conclusion

This documentation encapsulates the complete technical blueprint of the Tandem platform. Every module—from domain-checked authentication, Sendbird chat synchronization, and OpenAI memoji generation to direct-to-memory S3 streaming and automated cron reminders—is modular, cleanly separated, and directly adaptable to your next application.
