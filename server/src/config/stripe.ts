import Stripe from "stripe";
import { getRequiredEnv } from "./env";

const STRIPE_SECRET_KEY = getRequiredEnv("STRIPE_SECRET_KEY");

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-03-25.dahlia",
});