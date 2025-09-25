import { User } from "./user"; // Adjust the import path as needed

declare global {
  namespace Express {
    interface Request {
      user?: User; // or whatever your User type is
    }
  }
}
