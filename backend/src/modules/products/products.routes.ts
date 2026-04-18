import { Router } from "express";
import {
  createProductHandler,
  deleteProductHandler,
  getProductByIdOrSlug,
  getProducts,
  updateProductHandler
} from "./products.controller.js";
import { productAutocomplete } from "./product.controller.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/autocomplete", productAutocomplete);

router.get("/", getProducts);
router.get("/:idOrSlug", getProductByIdOrSlug);

router.post("/", requireAuth, requireAdmin, createProductHandler);
router.put("/:id", requireAuth, requireAdmin, updateProductHandler);
router.delete("/:id", requireAuth, requireAdmin, deleteProductHandler);

export default router;
