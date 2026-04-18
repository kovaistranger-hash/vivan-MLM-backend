import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Valid email is required").max(150),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  phone: z.string().min(10, "Phone must be at least 10 digits").max(20).optional()
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});
