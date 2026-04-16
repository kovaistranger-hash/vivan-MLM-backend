import { createReview } from './review.service.js';
export async function postReview(req, res) {
    await createReview({
        userId: req.user.id,
        productSlug: String(req.params.slug),
        rating: req.body.rating,
        title: req.body.title,
        body: req.body.body
    });
    res.status(201).json({ success: true });
}
