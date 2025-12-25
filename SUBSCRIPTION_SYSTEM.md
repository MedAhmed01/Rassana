# Subscription System

## Overview
Students can now subscribe to different subjects (Math, Physics, Science, or any combination). Cards can specify which subscriptions are required to access them.

## Features

### Student Subscriptions
- Students can have multiple subscriptions: `math`, `physics`, `science`
- Admins don't need subscriptions (they have full access)
- Subscriptions are managed through the admin dashboard

### Card Access Control
- Each card can specify required subscriptions
- If a card has required subscriptions, students must have at least ONE of them to access the card
- If a card has no required subscriptions, all students can access it
- Admins can always access all cards

## Database Changes

### Migration: `007_subscriptions.sql`
- Added `subscriptions` column to `user_profiles` table (TEXT[] array)
- Added `required_subscriptions` column to `cards` table (TEXT[] array)
- Updated existing cards to migrate `subject` field to `required_subscriptions`

## Admin Dashboard Changes

### User Management
- Create User form now includes subscription selection for students
- User table displays subscriptions for each student
- Edit User modal allows updating subscriptions

### Card Management
- Create Card form includes required subscription selection
- Card display shows required subscriptions as badges
- Edit Card modal allows updating required subscriptions
- Subject field is now a free-text field (optional)

## API Changes

### User APIs
- `POST /api/admin/users` - Now accepts `subscriptions` array
- `PATCH /api/admin/users/[userId]` - Now accepts `subscriptions` array

### Card APIs
- `POST /api/admin/cards` - Now accepts `required_subscriptions` array
- `PATCH /api/admin/cards/[cardId]` - Now accepts `required_subscriptions` array

## Access Control Logic

When a student tries to access a card:
1. If the card has no `required_subscriptions`, access is granted
2. If the card has `required_subscriptions`, check if the student has at least one matching subscription
3. If the student has a matching subscription, access is granted
4. Otherwise, access is denied

## Usage Examples

### Creating a Student with Subscriptions
```typescript
{
  username: "john_doe",
  password: "password123",
  role: "student",
  subscriptions: ["math", "physics"],
  expires_at: "2025-12-31"
}
```

### Creating a Card with Required Subscriptions
```typescript
{
  card_id: "PHY-001",
  video_url: "https://youtube.com/watch?v=...",
  title: "Introduction to Mechanics",
  required_subscriptions: ["physics", "science"]
}
```

This card can be accessed by students who have either "physics" OR "science" subscription.

### Creating a Card Accessible to All
```typescript
{
  card_id: "GEN-001",
  video_url: "https://youtube.com/watch?v=...",
  title: "Welcome Video",
  required_subscriptions: []
}
```

This card can be accessed by all students regardless of their subscriptions.
