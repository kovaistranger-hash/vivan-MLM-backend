import type { Request, Response } from "express";
import {
  createProductSchema,
  productListQuerySchema,
  updateProductSchema
} from "./products.validation.js";
import {
  createProduct,
  deleteProduct,
  findProductById,
  findProductBySlug,
  listProducts,
  mapProductResponse,
  updateProduct
} from "./products.service.js";

export async function getProducts(req: Request, res: Response) {
  try {
    const parsed = productListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: parsed.error.flatten()
      });
    }

    const isAdmin = req.user?.role === "admin";

    const result = await listProducts({
      page: parsed.data.page,
      limit: parsed.data.limit,
      search: parsed.data.search,
      category: parsed.data.category,
      status: isAdmin ? parsed.data.status : undefined,
      featured: parsed.data.featured,
      includeInactive: isAdmin
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products"
    });
  }
}

export async function getProductByIdOrSlug(req: Request, res: Response) {
  try {
    const raw = req.params.idOrSlug;
    const idOrSlug = Array.isArray(raw) ? raw[0] : raw;
    const id = Number(idOrSlug);

    const product =
      Number.isInteger(id) && id > 0
        ? await findProductById(id)
        : await findProductBySlug(String(idOrSlug ?? ""));

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    if (product.status !== "active" && req.user?.role !== "admin") {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    return res.status(200).json({
      success: true,
      product: mapProductResponse(product)
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product"
    });
  }
}

export async function createProductHandler(req: Request, res: Response) {
  try {
    const parsed = createProductSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    const product = await createProduct(
      {
        name: parsed.data.name,
        description: parsed.data.description ?? "",
        short_description: parsed.data.short_description ?? "",
        sku: parsed.data.sku ?? null,
        category: parsed.data.category ?? "General",
        subcategory: parsed.data.subcategory ?? "",
        brand: parsed.data.brand ?? "",
        image_url: parsed.data.image_url ?? null,
        gallery_urls: parsed.data.gallery_urls ?? [],
        price: parsed.data.price,
        mrp: parsed.data.mrp,
        stock: parsed.data.stock,
        status: parsed.data.status,
        is_featured: parsed.data.is_featured
      },
      req.user?.id
    );

    if (!product) {
      return res.status(500).json({
        success: false,
        message: "Failed to create product"
      });
    }

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create product"
    });
  }
}

export async function updateProductHandler(req: Request, res: Response) {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    const parsed = updateProductSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    const product = await updateProduct(productId, parsed.data, req.user?.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update product"
    });
  }
}

export async function deleteProductHandler(req: Request, res: Response) {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID"
      });
    }

    const deleted = await deleteProduct(productId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to delete product"
    });
  }
}
