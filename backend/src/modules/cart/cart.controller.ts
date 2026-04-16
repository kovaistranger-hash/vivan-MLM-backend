import { Request, Response } from 'express';
import { addToCart, getCart, removeCartItem, updateCartItem } from './cart.service.js';

export async function fetchCart(req: Request, res: Response) {
  const cart = await getCart(req.user!.id);
  res.json({ success: true, cart });
}

export async function createCartItem(req: Request, res: Response) {
  const cart = await addToCart(req.user!.id, Number(req.body.productId), Number(req.body.quantity || 1));
  res.status(201).json({ success: true, cart });
}

export async function patchCartItem(req: Request, res: Response) {
  const cart = await updateCartItem(req.user!.id, Number(req.params.itemId), Number(req.body.quantity));
  res.json({ success: true, cart });
}

export async function deleteCartItem(req: Request, res: Response) {
  const cart = await removeCartItem(req.user!.id, Number(req.params.itemId));
  res.json({ success: true, cart });
}
