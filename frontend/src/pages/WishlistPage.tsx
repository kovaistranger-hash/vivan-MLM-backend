import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useWishlist } from '../hooks/useWishlist';

export default function WishlistPage() {
  const { items } = useWishlist();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Wishlist</h1>
        <p className="mt-2 text-sm text-slate-500">Items you save on this device. Sign in for synced carts and orders.</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-600">Your wishlist is empty.</p>
          <Link to="/products" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
