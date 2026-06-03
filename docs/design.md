# Trainee App - High Level Design

## System Overview
Trainee is a full-stack application designed to connect fitness trainers with clients. The platform enables discovery, profile management, subscription-based billing, scheduling, review management, and administrative tracking.

## Core Roles & Personas

### 1. Clients
* **Goal**: Discover personal trainers matching their location, budget, and specialization.
* **Journeys**:
  * Browse and search trainers (list/map layout).
  * Book trainer sessions and view active schedules.
  * Leave reviews for trainers.
  * Subscribe to gym programs.

### 2. Trainers
* **Goal**: Manage schedule availability, interact with assigned clients, and track business statistics.
* **Journeys**:
  * Set availability hours.
  * Assign/drag-and-drop client appointments.
  * Manage specialized service offerings (Specializations).
  * Manage app subscription tiers (via RevenueCat/Stripe) to list their profile.

### 3. Admins
* **Goal**: Moderate the platform, manage system logs, and address user reports.
* **Journeys**:
  * View and resolve reported issues/tickets.

---

## Subscription Integration (RevenueCat & Stripe)
* **Mobile Platforms (iOS/Android)**: Integrates RevenueCat (`react-native-purchases`) to handle App Store and Google Play transactions.
* **Web/Fallback**: Uses Stripe sessions for web-based or fallback checkouts.
* **Security lock**: Restore behavior is set to **Keep with original App User ID** to ensure subscriptions are locked to a single email/auth profile (`robi@gmail.com` case), preventing receipt reuse/sharing across multiple accounts.
