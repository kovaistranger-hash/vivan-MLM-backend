import { query } from '../../db/mysql.js';
export async function dashboard(_req, res) {
    const users = await query('SELECT COUNT(*) AS totalUsers FROM users');
    const products = await query('SELECT COUNT(*) AS totalProducts FROM products');
    const orders = await query('SELECT COUNT(*) AS totalOrders, COALESCE(SUM(total_amount),0) AS totalRevenue FROM orders');
    res.json({
        success: true,
        metrics: {
            users: Number(users[0].totalUsers),
            products: Number(products[0].totalProducts),
            orders: Number(orders[0].totalOrders),
            revenue: Number(orders[0].totalRevenue)
        }
    });
}
