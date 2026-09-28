# Community & Restaurant Vendor Platform
## Complete Technical Architecture, Data Schemas & Transformation Blueprint

> **Document Version:** 1.0.0  
> **Status:** Architecture & Requirements Specification  
> **Base Codebase:** Derived & Refined from `Tandem`  
> **Target System:** Multi-Role Community Engagement & Restaurant/Vendor Marketplace  

---

## Table of Contents

1. [Project Overview & Core Transformation](#1-project-overview--core-transformation)
2. [What to Remove vs. What to Keep vs. What to Add](#2-what-to-remove-vs-what-to-keep-vs-what-to-add)
3. [User Roles & Permissions Matrix](#3-user-roles--permissions-matrix)
4. [Vendor (Restaurant) Lifecycle & Approval Workflow](#4-vendor-restaurant-lifecycle--approval-workflow)
5. [Database Architecture & Entity Relationships (ERD)](#5-database-architecture--entity-relationships-erd)
6. [Detailed Schema Models (Mongoose)](#6-detailed-schema-models-mongoose)
   - [6.1 User (Master Authentication - Polymorphic)](#61-user-master-authentication---polymorphic)
   - [6.2 Member (Community User)](#62-member-community-user)
   - [6.3 Vendor (Restaurant Profile)](#63-vendor-restaurant-profile)
   - [6.4 Product (Menu Items & Time Scheduling)](#64-product-menu-items--time-scheduling)
   - [6.5 Society (Admin-Managed Community Groups)](#65-society-admin-managed-community-groups)
   - [6.6 Post & Event (Community Social Feed)](#66-post--event-community-social-feed)
7. [System Workflow & Sequence Diagrams](#7-system-workflow--sequence-diagrams)
   - [7.1 Vendor Registration, Profile Setup & Admin Approval](#71-vendor-registration-profile-setup--admin-approval)
   - [7.2 Product Management & Member Discovery](#72-product-management--member-discovery)
   - [7.3 Community Member Onboarding & Society Participation](#73-community-member-onboarding--society-participation)
8. [Complete API Endpoint Architecture](#8-complete-api-endpoint-architecture)
9. [Step-by-Step Code Refactoring Roadmap from Tandem](#9-step-by-step-code-refactoring-roadmap-from-tandem)
10. [Environment Variables for the New Project](#10-environment-variables-for-the-new-project)

---

## 1. Project Overview & Core Transformation

This new application transforms the campus-focused Tandem system into a **hybrid Community Platform and Restaurant/Vendor Marketplace**.

The platform connects three distinct user groups:
1. **Admin (Platform Operator):** Manages community societies, moderates content, reviews vendor applications, and controls platform metrics.
2. **Community Members (Regular Users):** General public users who join interest-based societies, interact with social feeds and events, and discover approved local restaurants and their food/product menus.
3. **Vendors (Restaurants / Food Merchants):** Merchants who register, complete their business profile, await Admin verification, and list their products/dishes with customizable availability timing schedules.

---

## 2. What to Remove vs. What to Keep vs. What to Add

### ❌ What is REMOVED from the Old Tandem Project

| Feature in Tandem | Reason for Removal | Replacement in New Project |
| :--- | :--- | :--- |
| **OpenAI 3D Cartoon Memoji Avatars** | Not needed; unnecessary API cost and latency | **Standard Image Upload:** Normal profile pictures stored in S3/MongoDB. |
| **CloudFront CDN & Pinpoint Tracking** | High complexity; unnecessary for core MVP | **Direct S3 / Local Storage URLs:** Direct media links. |
| **University Entity & Domain Gating** | Platform is for the public, not restricted to students | **Open Community:** Any valid email address can register. |
| **Student Entity (`Student.js`)** | "Student" role and university years are deprecated | **`Member.js`:** General community member profile with bio, interests, and location. |
| **Maintainer Role (`Maintainer.js`)** | Campus maintainers are no longer relevant | **Consolidated Admin & Vendor Roles:** Admin controls societies; Vendors manage stores. |
| **Company & Student Discounts (`Company.js`, `Offer.js`)**| Student discount vouchers are replaced | **`Vendor.js` & `Product.js`:** Full restaurant and menu catalog with time-based scheduling. |

---

### 🔄 What is REUSED & REFINED from Tandem

- **Core MVC Architecture:** Express 5 ES Modules (`type: "module"`), modular route-controller structure.
- **Polymorphic Authentication:** Master `User` model with JWT bearer tokens and Bcrypt password hashing.
- **Societies & Clubs:** Community groups created by Admin that members can join.
- **Social Feed & Events Engine:** Posts and events tied to societies with balanced feed calculation and RSVP tracking.
- **Real-Time Messaging:** Group chats for societies (Sendbird or WebSockets).
- **Direct-to-Memory Multipart Upload:** S3 upload streamer without temporary disk files.
- **Notifications System:** In-app and push notification infrastructure.
- **Moderation & Reporting:** Safety flags for inappropriate content with Admin resolution workflows.

---

### ➕ What is NEW to Add

1. **Vendor Role (`VENDOR`):**
   - Dedicated signup and authentication route.
   - Multi-step restaurant profile setup (cuisine, address, contact, operating hours, food hygiene/licenses).
2. **Admin Vendor Approval Pipeline:**
   - Vendors start in `PENDING_SETUP`.
   - Once profile details are submitted, status changes to `PENDING_APPROVAL`.
   - Admin inspects the restaurant and either **Approves** or **Rejects** the vendor.
   - **Crucial Rule:** Vendor restaurants and their products are completely **hidden from members** until Admin explicitly marks them `APPROVED`.
3. **Product / Menu Catalog:**
   - Dishes, drinks, and food items created by approved vendors.
   - Image, description, price, allergens, category, preparation time.
   - **Time-Based Availability Scheduling:** Set active time slots for each product (e.g. Breakfast: 08:00–11:30, Lunch: 12:00–16:00, Dinner: 17:00–22:00, or daily operating hours).

---

## 3. User Roles & Permissions Matrix

The platform operates on **three distinct roles**:

```
+---------------------------------------------------------------------------------+
|                                 PLATFORM ROLES                                  |
+------------------------+-------------------------------+------------------------+
|         ADMIN          |            MEMBER             |         VENDOR         |
|  (Platform Superuser)  |       (Community User)        |     (Restaurant)       |
+------------------------+-------------------------------+------------------------+
| * Create/Manage        | * Browse & Join Societies     | * Complete Profile     |
|   Societies            | * View Feed Posts & Events    | * Manage Products      |
| * Approve/Reject       | * RSVP to Society Events      | * Set Time Schedule    |
|   Vendors              | * Chat in Society Groups      | * View Sales / Orders  |
| * Moderate Reports     | * Browse Approved Restaurants | * Update Open/Closed   |
| * Manage Member Limits | * View Menus & Products       |   Store Status         |
+------------------------+-------------------------------+------------------------+
```

### Detailed Permissions Table

| Feature / Action | `ADMIN` | `MEMBER` | `VENDOR` |
| :--- | :---: | :---: | :---: |
| **Register Account** | Seeded / Superadmin | Public Signup | Public Signup |
| **Create Societies** | ✅ | ❌ | ❌ |
| **Join / Leave Societies** | ✅ | ✅ | ❌ |
| **Publish Society Posts & Events** | ✅ | ✅ (If society lead) | ❌ |
| **Setup Restaurant Profile** | ❌ | ❌ | ✅ |
| **Review & Approve Vendor Profiles** | ✅ | ❌ | ❌ |
| **Add / Edit / Delete Products** | ❌ | ❌ | ✅ (If Approved) |
| **Configure Product Time Schedules** | ❌ | ❌ | ✅ (If Approved) |
| **View Restaurants & Menus** | ✅ | ✅ (Only Approved) | ✅ (Own store) |
| **Submit Content Reports** | ❌ | ✅ | ✅ |
| **Resolve Reports / Block Accounts** | ✅ | ❌ | ❌ |

---

## 4. Vendor (Restaurant) Lifecycle & Approval Workflow

```mermaid
stateDiagram-v2
    [*] --> Registered: Vendor Sign-up (Email & Password)
    Registered --> ProfileSetup: Logs in with role VENDOR
    
    state ProfileSetup {
        [*] --> EnteringDetails: Add Restaurant Name, Address, Contact
        EnteringDetails --> UploadingAssets: Upload Logo, Banner, Food Licenses
        UploadingAssets --> SettingHours: Configure General Operating Hours
        SettingHours --> Submitted: Click "Submit for Verification"
    }

    ProfileSetup --> PendingApproval: Status = PENDING_APPROVAL
    
    state PendingApproval {
        note right of PendingApproval
            Restaurant & Products are
            COMPLETELY HIDDEN
            from Community Members
        end note
    }

    PendingApproval --> Approved: Admin Reviews & Clicks "Accept"
    PendingApproval --> Rejected: Admin Rejects (with rejection reason)
    Rejected --> ProfileSetup: Vendor updates details and resubmits

    state Approved {
        note left of Approved
            Restaurant becomes VISIBLE to Members.
            Vendor can now publish Products/Menu.
        end note
        [*] --> ActiveStore
        ActiveStore --> ProductManagement: Create Dishes & Set Active Times
    }

    Approved --> Suspended: Admin flags for violation / complaints
    Suspended --> Approved: Admin reinstates store
```

---

## 5. Database Architecture & Entity Relationships (ERD)

```mermaid
erDiagram
    USER ||--|| MEMBER : "polymorphic details (MEMBER)"
    USER ||--|| VENDOR : "polymorphic details (VENDOR)"
    USER ||--|| ADMIN : "polymorphic details (ADMIN)"

    MEMBER ||--o{ MEMBER_WITH_SOCIETY : "joins"
    SOCIETY ||--o{ MEMBER_WITH_SOCIETY : "has members"

    MEMBER ||--o{ MEMBER_WITH_EVENT : "RSVPs to"
    EVENT ||--o{ MEMBER_WITH_EVENT : "has attendees"

    SOCIETY ||--o{ POST : "publishes"
    SOCIETY ||--o{ EVENT : "hosts"
    SOCIETY ||--o{ CHAT_GROUP : "owns"

    VENDOR ||--o{ PRODUCT : "offers"
    CATEGORY ||--o{ PRODUCT : "classifies"
    CATEGORY ||--o{ SOCIETY : "classifies"

    MEMBER ||--o{ REPORT : "submits"
    MEMBER ||--o{ NOTIFICATION : "receives"
```

---

## 6. Detailed Schema Models (Mongoose)

### 6.1 User (Master Authentication - Polymorphic)
File: `model/user.js`

```javascript
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      enum: ["ADMIN", "MEMBER", "VENDOR"],
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "detailsModel",
    },
    detailsModel: {
      type: String,
      required: true,
      enum: ["Admin", "Member", "Vendor"],
    },
    notificationToken: {
      type: String, // Expo / FCM push token
    },
    resetOtp: String,
    resetOtpExpiry: Date,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
```

---

### 6.2 Member (Community User)
File: `model/member.js` *(Replaces `student.js`)*

```javascript
import mongoose, { Schema } from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    city: { type: String },
    bio: { type: String, default: "" },
    
    // Normal Profile Picture (No AI Memoji needed)
    avatar: {
      type: String,
      default: "https://your-storage-bucket.s3.amazonaws.com/defaults/default-avatar.png",
    },
    
    isBlocked: { type: Boolean, default: false },
    
    // Societies where this member is assigned as moderator/admin
    societyAdmin: [{ type: Schema.Types.ObjectId, ref: "Society" }],
    
    // Active chat channels
    chats: [{ type: Schema.Types.ObjectId, ref: "ChatGroup" }],
  },
  { timestamps: true }
);

export default mongoose.model("Member", memberSchema);
```

---

### 6.3 Vendor (Restaurant Profile)
File: `model/vendor.js` *(Brand new model)*

```javascript
import mongoose, { Schema } from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    restaurantName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    
    // Business Details
    description: { type: String, default: "" },
    cuisineTypes: [{ type: String }], // e.g. ["Italian", "Pizza", "Vegan"]
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    
    // Media & Branding
    logo: { type: String },
    banner: { type: String },
    documentUrls: [{ type: String }], // Food hygiene certificate, business registration
    
    // Operating Hours (Store level)
    openingHours: [
      {
        day: {
          type: String,
          enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
        },
        open: String,  // e.g. "09:00"
        close: String, // e.g. "22:00"
        isClosed: { type: Boolean, default: false },
      },
    ],
    
    // Lifecycle & Approval Status
    isProfileCompleted: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ["PENDING_SETUP", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SUSPENDED"],
      default: "PENDING_SETUP",
    },
    rejectionReason: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    
    // Store Status
    isOpenNow: { type: Boolean, default: true },
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Vendor", vendorSchema);
```

---

### 6.4 Product (Menu Items & Time Scheduling)
File: `model/product.js` *(Brand new model)*

```javascript
import mongoose, { Schema } from "mongoose";

const productSchema = new mongoose.Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: null },
    
    category: { type: String, required: true }, // e.g. "Starters", "Mains", "Drinks"
    images: [{ type: String }],
    
    isVegetarian: { type: Boolean, default: false },
    isVegan: { type: Boolean, default: false },
    isGlutenFree: { type: Boolean, default: false },
    allergens: [{ type: String }],
    
    preparationTimeMinutes: { type: Number, default: 15 },
    
    // Inventory & Availability Status
    isAvailable: { type: Boolean, default: true },
    stockCount: { type: Number, default: -1 }, // -1 = Unlimited
    
    // Time-based Availability (e.g. Breakfast-only or Lunch-only)
    hasSpecificTiming: { type: Boolean, default: false },
    availableTiming: {
      startTime: { type: String, default: "00:00" }, // e.g. "08:00"
      endTime: { type: String, default: "23:59" },   // e.g. "11:30"
      availableDays: [
        {
          type: String,
          enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
        },
      ],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
```

---

### 6.5 Society (Admin-Managed Community Groups)
File: `model/society.js` *(Refined from Tandem, university removed)*

```javascript
import mongoose, { Schema } from "mongoose";

const societySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    
    type: {
      type: String,
      enum: ["INTEREST", "SPORTS", "HOBBY", "PROFESSIONAL", "FOOD_LOVERS"],
      default: "INTEREST",
    },
    
    logo: { type: String, required: true },
    banner: { type: String, required: true },
    
    display: { type: Boolean, default: true },
    followerCount: { type: Number, default: 0 },
    
    // Admin & Moderators
    creatorAdminId: { type: Schema.Types.ObjectId, ref: "Admin" },
    moderatorIds: [{ type: Schema.Types.ObjectId, ref: "Member" }],
  },
  { timestamps: true }
);

export default mongoose.model("Society", societySchema);
```

---

### 6.6 Post & Event (Community Social Feed)
File: `model/post.js` & `model/event.js`

```javascript
// model/post.js
import mongoose, { Schema } from "mongoose";

const postSchema = new mongoose.Schema(
  {
    societyId: { type: Schema.Types.ObjectId, ref: "Society", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    content: { type: String, required: true },
    images: [{ type: String }],
    likesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Post", postSchema);
```

```javascript
// model/event.js
import mongoose, { Schema } from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    societyId: { type: Schema.Types.ObjectId, ref: "Society", required: true },
    name: { type: String, required: true },
    description: { type: String },
    location: { type: String, required: true },
    locationUrl: { type: String },
    startingTime: { type: Date, required: true },
    endingTime: { type: Date, required: true },
    bannerUrl: { type: String, required: true },
    display: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);
```

---

## 7. System Workflow & Sequence Diagrams

### 7.1 Vendor Registration, Profile Setup & Admin Approval

```mermaid
sequenceDiagram
    autonumber
    actor V as Vendor (Restaurant)
    participant API as Backend Server
    participant DB as MongoDB
    actor A as Platform Admin

    V->>API: POST /v1/auth/vendor/signup { email, password, restaurantName, ownerName, phone }
    API->>DB: Create Vendor profile (approvalStatus: "PENDING_SETUP")
    API->>DB: Create User record (role: "VENDOR")
    API-->>V: 201 Created { token, vendorId, approvalStatus: "PENDING_SETUP" }

    Note over V,API: Step 2: Complete Profile Setup
    V->>API: PATCH /v1/vendor/profile/setup (Multipart: description, address, hours, logo, banner, license docs)
    API->>DB: Save details & update status to "PENDING_APPROVAL"
    API-->>V: 200 OK ("Profile submitted for admin approval")

    Note over A,API: Step 3: Admin Review
    A->>API: GET /v1/admin/vendors/pending
    API-->>A: List of vendors awaiting verification
    alt Admin Approves
        A->>API: PATCH /v1/admin/vendors/:vendorId/approve
        API->>DB: Update approvalStatus = "APPROVED", approvedAt = Date.now()
        API-->>A: 200 OK ("Vendor approved successfully")
    else Admin Rejects
        A->>API: PATCH /v1/admin/vendors/:vendorId/reject { reason: "Missing health license" }
        API->>DB: Update approvalStatus = "REJECTED", rejectionReason = "..."
        API-->>A: 200 OK ("Vendor rejected")
    end
```

---

### 7.2 Product Management & Member Discovery

```mermaid
sequenceDiagram
    autonumber
    actor V as Approved Vendor
    participant API as Backend Server
    participant DB as MongoDB
    actor M as Community Member

    Note over V,API: Product Creation (Only if APPROVED)
    V->>API: POST /v1/product { name: "Margherita Pizza", price: 12.99, timeSchedule: "12:00-22:00" }
    API->>DB: Verify Vendor.approvalStatus === "APPROVED"
    alt Not Approved
        API-->>V: 403 Forbidden ("Vendor account must be approved to create products")
    else Approved
        API->>DB: Save Product document
        API-->>V: 201 Created { product }
    end

    Note over M,API: Member Discovery
    M->>API: GET /v1/restaurant/list (Browse Restaurants)
    API->>DB: Find Vendors where approvalStatus == "APPROVED"
    API-->>M: Return only verified, approved restaurants

    M->>API: GET /v1/restaurant/:vendorId/products (View Menu)
    API->>DB: Query products belonging to approved vendor
    API-->>M: List products with active time schedules
```

---

### 7.3 Community Member Onboarding & Society Participation

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant API as Backend Server
    participant DB as MongoDB

    M->>API: POST /v1/auth/member/signup { email, password, firstName, lastName }
    API->>DB: Create Member record & User (role: "MEMBER")
    API-->>M: 201 Created { token, memberProfile }

    M->>API: GET /v1/society/list
    API->>DB: Fetch active societies created by Admin
    API-->>M: List of societies

    M->>API: POST /v1/society/:societyId/join
    API->>DB: Create MemberWithSociety link & increment followerCount
    API-->>M: 200 OK ("Joined society successfully")

    M->>API: GET /v1/feed/home
    API->>DB: Pull combined posts & events from joined societies
    API-->>M: Enriched community social feed
```

---

## 8. Complete API Endpoint Architecture

### 1. Authentication (`/v1/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/auth/login` | Public | Common login for Admin, Member, and Vendor |
| `POST` | `/v1/auth/member/signup` | Public | Regular member signup (replaces student signup) |
| `POST` | `/v1/auth/vendor/signup` | Public | Vendor (restaurant owner) initial signup |
| `POST` | `/v1/auth/forgot-password` | Public | Dispatches password reset OTP |
| `POST` | `/v1/auth/reset-password` | Public | Verifies OTP and resets password |

### 2. Vendor Management (`/v1/vendor` & `/v1/restaurant`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET`  | `/v1/vendor/profile/me` | `VENDOR` | Vendor views own profile & approval status |
| `PATCH`| `/v1/vendor/profile/setup` | `VENDOR` | Submits complete restaurant details & documents |
| `PATCH`| `/v1/vendor/profile/update`| `VENDOR` | Updates operating hours, address, phone |
| `PATCH`| `/v1/vendor/toggle-open` | `VENDOR` | Toggles store open/closed status (`isOpenNow`) |
| `GET`  | `/v1/restaurant/list` | `MEMBER`, `ADMIN` | Members browse all **Approved** restaurants |
| `GET`  | `/v1/restaurant/:id` | `MEMBER`, `ADMIN` | Members view restaurant details & hours |

### 3. Product & Menu Management (`/v1/product`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/v1/product/` | `VENDOR` (Approved) | Creates dish/product with schedule times |
| `PATCH`| `/v1/product/:id` | `VENDOR` (Approved) | Updates price, description, images, schedule |
| `DELETE`| `/v1/product/:id` | `VENDOR` (Approved) | Removes product from menu |
| `GET`  | `/v1/product/my-products` | `VENDOR` | Vendor views all their own products |
| `GET`  | `/v1/product/vendor/:vendorId`| Public / `MEMBER` | Members view available dishes for a restaurant |

### 4. Admin Operations (`/v1/admin`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET`  | `/v1/admin/vendors` | `ADMIN` | Lists vendors filtered by status (`PENDING`, `APPROVED`) |
| `PATCH`| `/v1/admin/vendors/:id/approve` | `ADMIN` | Approves vendor (makes restaurant & products visible) |
| `PATCH`| `/v1/admin/vendors/:id/reject` | `ADMIN` | Rejects vendor profile with feedback reason |
| `PATCH`| `/v1/admin/vendors/:id/suspend` | `ADMIN` | Suspends active vendor profile |
| `POST` | `/v1/admin/society` | `ADMIN` | Creates new community society |
| `PATCH`| `/v1/admin/society/:id` | `ADMIN` | Updates society details |
| `DELETE`| `/v1/admin/society/:id` | `ADMIN` | Deletes society |
| `GET`  | `/v1/admin/reports` | `ADMIN` | Reviews filed community reports |

### 5. Community Societies & Social Feed (`/v1/society`, `/v1/feed`, `/v1/post`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET`  | `/v1/society/list` | `MEMBER` | Browse all community societies |
| `POST` | `/v1/society/:id/join` | `MEMBER` | Join community society |
| `POST` | `/v1/society/:id/leave` | `MEMBER` | Leave community society |
| `GET`  | `/v1/feed/home` | `MEMBER` | Balanced feed of posts & events from joined societies |
| `POST` | `/v1/post/` | `MEMBER` (Moderator)| Create post in society |
| `POST` | `/v1/event/` | `MEMBER` (Moderator)| Create event in society |
| `POST` | `/v1/event/:id/rsvp` | `MEMBER` | Toggle event RSVP / attendance |

---

## 9. Step-by-Step Code Refactoring Roadmap from Tandem

When refining this codebase into the new project, follow this execution order:

### Phase 1: File Deletions (Removing Obsolete Modules)
```bash
# 1. Delete University module
rm route/university.js controller/university.js model/university.js

# 2. Delete Maintainer module
rm route/maintainer.js controller/maintainer.js model/maintainer.js

# 3. Delete Student Company/Offer modules (replaced by Vendor & Product)
rm route/company.js controller/company.js model/company.js
rm route/offer.js controller/offer.js model/offer.js
rm model/studentWithOffer.js

# 4. Remove unused OpenAI client
rm utils/openaiClient.js
```

### Phase 2: Refactoring Existing Models
1. **`model/user.js`:**
   - Change `role` enum to: `["ADMIN", "MEMBER", "VENDOR"]`.
   - Change `detailsModel` enum to: `["Admin", "Member", "Vendor"]`.
2. **`model/student.js` $\rightarrow$ `model/member.js`:**
   - Remove `year`, `university` reference, `avatarBg`, `avatarDisplay`.
   - Retain `avatar` as a standard image URL string.
3. **`model/society.js`:**
   - Remove `universityId`.
   - Retain `category`, `name`, `description`, `logo`, `banner`, `followerCount`.

### Phase 3: Creating New Models
1. Create `model/vendor.js` (Restaurant profile, opening hours, approval status).
2. Create `model/product.js` (Menu items, pricing, allergens, time availability).

### Phase 4: Refactoring Utilities
1. **`utils/s3Upload.js`:**
   - Remove `process.env.AWS_CDN` dependence; construct direct S3 bucket URLs or use a simple clean media domain.
2. **`controller/student.js` $\rightarrow$ `controller/member.js`:**
   - Strip out the OpenAI `gpt-image-1` / `images/edits` API calls in `updateDp`. Store the uploaded image directly as the profile picture.
   - Remove `checkEmail` domain validation against universities.

### Phase 5: Building New Controllers & Routes
1. **`controller/vendor.js` & `route/vendor.js`:**
   - Signup, profile setup, operating hours configuration, store toggle.
2. **`controller/product.js` & `route/product.js`:**
   - Product CRUD, time-schedule validator (ensuring time strings like `"12:00-16:00"` are parsed and matched against current request time).
3. **`controller/admin.js`:**
   - Add vendor review handlers: `getPendingVendors`, `approveVendor`, `rejectVendor`.

---

## 10. Environment Variables for the New Project

```env
# ==============================================================================
# SERVER CONFIGURATION
# ==============================================================================
PORT=8000
NODE_ENV=development

# ==============================================================================
# DATABASE (MONGODB)
# ==============================================================================
MONGO_URI=mongodb://localhost:27017/community_vendor_db

# ==============================================================================
# AUTHENTICATION (JWT)
# ==============================================================================
TOKEN_SECRET=replace_with_a_secure_random_string_min_32_characters

# ==============================================================================
# AWS STORAGE (S3 - DIRECT MEDIA UPLOADS)
# ==============================================================================
AWS_REGION=eu-west-2
AWS_KEY=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_BUCKET=community-vendor-storage

# ==============================================================================
# AWS SES (TRANSACTIONAL EMAILS & OTP)
# ==============================================================================
SES_EMAIL_FROM=noreply@yourcommunitydomain.com

# ==============================================================================
# REAL-TIME CHAT (SENDBIRD OR WEBSOCKET)
# ==============================================================================
SENDBIRD_APP_ID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
SENDBIRD_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 11. Conclusion & Next Steps

This document is your complete blueprint for transforming the Tandem codebase into the new **Community & Restaurant Vendor Platform**.

When you are ready to begin writing or refactoring the code, we will:
1. Delete the obsolete files (`university`, `maintainer`, `company`, `offer`, OpenAI memoji references).
2. Create the `Member`, `Vendor`, and `Product` models.
3. Implement the Vendor Setup & Admin Approval workflow.
4. Wire up the Product scheduling and Member discovery APIs.
