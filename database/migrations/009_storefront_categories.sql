-- Canonical storefront categories (top-level only) + deactivate legacy demo categories.
-- Run: mysql -u root -p vivan < database/migrations/009_storefront_categories.sql

USE vivan;

INSERT INTO categories (parent_id, name, slug, description, sort_order, is_active) VALUES
(NULL, 'Beauty', 'beauty', 'Skincare, makeup, and beauty essentials.', 1, 1),
(NULL, 'Fashion', 'fashion', 'Apparel and accessories for every season.', 2, 1),
(NULL, 'Electronics', 'electronics', 'Gadgets, audio, and smart everyday tech.', 3, 1),
(NULL, 'Home Care', 'home-care', 'Cleaning, fragrance, and home essentials.', 4, 1),
(NULL, 'Personal Care', 'personal-care', 'Hair, bath, and daily hygiene favorites.', 5, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  parent_id = NULL,
  is_active = 1;

UPDATE categories
SET is_active = 0
WHERE slug NOT IN ('beauty', 'fashion', 'electronics', 'home-care', 'personal-care');

UPDATE products p
LEFT JOIN categories c
  ON c.id = p.category_id
 AND c.is_active = 1
 AND c.slug IN ('beauty', 'fashion', 'electronics', 'home-care', 'personal-care')
SET p.category_id = (SELECT id FROM categories WHERE slug = 'beauty' LIMIT 1)
WHERE p.category_id IS NULL OR c.id IS NULL;
