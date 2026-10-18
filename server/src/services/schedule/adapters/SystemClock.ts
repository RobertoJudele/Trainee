import { Clock } from "../ports";

/**
 * The only place in the module that reads the wall clock. Every rule that
 * depends on "now" - code expiry, the default range start - takes the instant
 * as an argument instead, so tests substitute a fixed clock rather than
 * arranging real time.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
