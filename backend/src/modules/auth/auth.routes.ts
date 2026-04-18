import { Router } from "express";
import { login, logout, me, register } from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);

export default router;
