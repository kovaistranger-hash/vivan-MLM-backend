import "express";

declare global {
  namespace Express {
    interface UserPayload {
      id: number;
      name?: string;
      email: string;
      role: "user" | "admin" | string;
    }

    interface Request {
      id?: string;
      user?: UserPayload;
    }
  }
}

export {};
