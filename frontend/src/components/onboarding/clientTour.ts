// src/components/onboarding/clientTour.ts
import { Tour } from "./TourContext";

export const clientTour: Tour = {
  id: "client",
  steps: [
    {
      // Start on the home screen and make the user tap the real button.
      targetId: "home-find-trainers",
      route: "/",
      title: "Start here",
      body: 'Tap "Find Trainers" to start browsing.',
      interactive: true,
      advanceWhenRoute: "/search",
      hint: "Tap the button →",
    },
    {
      targetId: "client-search-bar",
      route: "/search",
      title: "Find your trainer",
      body: "Type a trainer's name or a keyword here. Results update as you type.",
    },
    {
      targetId: "client-filters",
      route: "/search",
      title: "Filter and sort",
      body: "Open filters to narrow by city, state, price range, and specializations, then sort by Top Rated, Most Reviewed, Price, Most Experienced, or Newest.",
    },
    {
      // No anchor + no dimming → the map stays fully visible and interactive.
      route: "/map",
      title: "Explore gyms on the map",
      body: "Pinch and drag to move around. Green markers are gyms; a numbered circle is a cluster — tap it to zoom in. Tap a gym to see its trainers.",
      dim: false,
      interactive: true,
      advanceOnEvent: "gym-pressed",
      hint: "Tap a gym →",
    },
    {
      route: "/map",
      title: "See who trains there",
      body: "These are the trainers available at this gym, with their ratings and rates. Tap one to open their full profile.",
      dim: false,
      interactive: true,
      advanceWhenRoute: "/trainers/",
      hint: "Tap a trainer →",
    },
    {
      targetId: "client-schedule-list",
      route: "/my-schedule",
      title: "Your sessions live here",
      body: "Every session a trainer books for you shows up here with its date, time, and status. You can cancel an upcoming booking from its card.",
      dim: false,
    },
    {
      targetId: "client-code-card",
      route: "/my-schedule",
      title: "Get booked with a code",
      body: 'Tap "Generate Check-in Code" to create a short-lived 6-digit code, then give it to your trainer. They enter it on their end and assign you to an open time slot — and the booked session then appears in this schedule.',
    },
  ],
};
