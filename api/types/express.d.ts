import type { SessionRecord } from "../db/repository.js";

declare global {
  namespace Express {
    interface Request {
      photoboothSession?: SessionRecord;
    }
  }
}

export {};
