// src/components/onboarding/trainerTour.ts
import { Tour } from "./TourContext";

const pad = (n: number) => String(n).padStart(2, "0");
const now = new Date();
// The "block a slot" step opens today's day planner.
const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export const trainerTour: Tour = {
  id: "trainer",
  steps: [
    {
      targetId: "trainer-hero",
      route: "/trainer-schedule",
      title: "Your scheduling hub",
      body: "Here's the flow: set your weekly hours, generate a month of bookable slots, then tap any day to fine-tune it.",
      dim: false,
      tooltipAt: "bottom",
    },
    {
      targetId: "trainer-template",
      route: "/trainer-schedule",
      title: "Set your weekly hours",
      body: 'Pick a weekday, set its Start and End time (HH:mm, 24h) and slot length in minutes, then Save. Toggle "Active" off for days you don\'t work. This reusable template is what slot generation is based on.',
      dim: false,
      tooltipAt: "top",
    },
    {
      targetId: "trainer-generate",
      route: "/trainer-schedule",
      title: "Generate a month of slots",
      body: "Tap this to create open, bookable slots for the visible month from your template. The calendar legend shows Available (green), Booked (blue), and Blocked (grey).",
      dim: false,
      tooltipAt: "top",
    },
    {
      targetId: "trainer-generate",
      route: "/trainer-schedule",
      title: "Regenerating keeps your bookings",
      body: 'Regenerating never touches booked sessions — only open slots are refreshed, and assigned slots are always kept. On a single day you\'ll even see a summary like "Added 3, removed 2, kept 1 assigned."',
      dim: false,
      tooltipAt: "top",
    },
    {
      targetId: "trainer-day-slots",
      route: `/trainer-schedule/${todayKey}`,
      title: "Block time off",
      body: 'Tap any open slot to remove it for that day. To block a whole day, open the ⋮ menu (top-left) → "Block this day". A day with assigned clients can\'t be blocked until you unassign them first — and unblocking later doesn\'t recreate slots, so regenerate the day afterwards.',
      dim: false,
      tooltipAt: "bottom",
    },
  ],
};
