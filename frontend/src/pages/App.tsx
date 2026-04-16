import { Suspense, lazy, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import RequireAdmin from '../admin/RequireAdmin';

const Layout = lazy(() => import('../components/Layout'));
const AdminLayout = lazy(() => import('../admin/AdminLayout'));

const HomePage = lazy(() => import('./HomePage'));
const ProductsPage = lazy(() => import('./ProductsPage'));
const ProductDetailPage = lazy(() => import('./ProductDetailPage'));
const LoginPage = lazy(() => import('./LoginPage'));
const RegisterPage = lazy(() => import('./RegisterPage'));
const CartPage = lazy(() => import('./CartPage'));
const CheckoutPage = lazy(() => import('./CheckoutPage'));
const OrdersPage = lazy(() => import('./OrdersPage'));
const TrackOrderLookupPage = lazy(() => import('./TrackOrderLookupPage'));
const TrackOrderPage = lazy(() => import('./TrackOrderPage'));
const WishlistPage = lazy(() => import('./WishlistPage'));
const WalletPage = lazy(() => import('./WalletPage'));
const WalletHistoryPage = lazy(() => import('./WalletHistoryPage'));
const WalletWithdrawPage = lazy(() => import('./WalletWithdrawPage'));
const WalletBankAccountsPage = lazy(() => import('./WalletBankAccountsPage'));
const ReferralPage = lazy(() => import('./ReferralPage'));
const DashboardPage = lazy(() => import('./Dashboard/Dashboard'));
const BinaryCalculatorPage = lazy(() => import('./BinaryCalculator'));
const KycPage = lazy(() => import('./KycPage'));

const AdminLoginPage = lazy(() => import('../admin/pages/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('../admin/pages/AdminDashboardPage'));
const AdminProductsPage = lazy(() => import('../admin/pages/AdminProductsPage'));
const AdminProductFormPage = lazy(() => import('../admin/pages/AdminProductFormPage'));
const AdminCategoriesPage = lazy(() => import('../admin/pages/AdminCategoriesPage'));
const AdminOrdersPage = lazy(() => import('../admin/pages/AdminOrdersPage'));
const AdminOrderDetailPage = lazy(() => import('../admin/pages/AdminOrderDetailPage'));
const AdminBannersPage = lazy(() => import('../admin/pages/AdminBannersPage'));
const AdminPincodesPage = lazy(() => import('../admin/pages/AdminPincodesPage'));
const AdminWalletsPage = lazy(() => import('../admin/pages/AdminWalletsPage'));
const AdminWalletDetailPage = lazy(() => import('../admin/pages/AdminWalletDetailPage'));
const AdminWithdrawalsPage = lazy(() => import('../admin/pages/AdminWithdrawalsPage'));
const AdminWithdrawalDetailPage = lazy(() => import('../admin/pages/AdminWithdrawalDetailPage'));
const AdminWithdrawalSettingsPage = lazy(() => import('../admin/pages/AdminWithdrawalSettingsPage'));
const AdminReferralsPage = lazy(() => import('../admin/pages/AdminReferralsPage'));
const AdminReferralUserPage = lazy(() => import('../admin/pages/AdminReferralUserPage'));
const AdminCommissionsPage = lazy(() => import('../admin/pages/AdminCommissionsPage'));
const AdminBinaryDailyPage = lazy(() => import('../admin/pages/AdminBinaryDailyPage'));
const AdminCompensationSettingsPage = lazy(() => import('../admin/pages/AdminCompensationSettingsPage'));
const AdminManualAdjustmentPage = lazy(() => import('../admin/pages/AdminManualAdjustmentPage'));
const AdminBinaryCarryPage = lazy(() => import('../admin/pages/AdminBinaryCarryPage'));
const AdminFraudPage = lazy(() => import('../admin/pages/AdminFraudPage'));
const AdminKycPage = lazy(() => import('../admin/pages/AdminKycPage'));

const AboutPage = lazy(async () => {
  const mod = await import('./InfoPages');
  return { default: mod.AboutPage };
});
const ContactPage = lazy(async () => {
  const mod = await import('./InfoPages');
  return { default: mod.ContactPage };
});
const PrivacyPage = lazy(async () => {
  const mod = await import('./InfoPages');
  return { default: mod.PrivacyPage };
});
const TermsPage = lazy(async () => {
  const mod = await import('./InfoPages');
  return { default: mod.TermsPage };
});
const RefundPolicyPage = lazy(async () => {
  const mod = await import('./InfoPages');
  return { default: mod.RefundPolicyPage };
});
const ShippingPolicyPage = lazy(async () => {
  const mod = await import('./InfoPages');
  return { default: mod.ShippingPolicyPage };
});
const IncomeDisclaimerPage = lazy(async () => {
  const mod = await import('./InfoPages');
  return { default: mod.IncomeDisclaimerPage };
});
const KycPolicyPage = lazy(async () => {
  const mod = await import('./InfoPages');
  return { default: mod.KycPolicyPage };
});
const GrievancePage = lazy(async () => {
  const mod = await import('./InfoPages');
  return { default: mod.GrievancePage };
});

function RouteLoading() {
  return <p className="mx-auto max-w-5xl p-6 text-sm text-slate-500">Loading...</p>;
}

function loadable(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={loadable(<AdminLoginPage />)} />
      <Route path="/admin" element={<RequireAdmin />}>
        <Route element={loadable(<AdminLayout />)}>
          <Route index element={loadable(<AdminDashboardPage />)} />
          <Route path="products" element={loadable(<AdminProductsPage />)} />
          <Route path="products/new" element={loadable(<AdminProductFormPage />)} />
          <Route path="products/:id/edit" element={loadable(<AdminProductFormPage />)} />
          <Route path="categories" element={loadable(<AdminCategoriesPage />)} />
          <Route path="orders" element={loadable(<AdminOrdersPage />)} />
          <Route path="orders/:id" element={loadable(<AdminOrderDetailPage />)} />
          <Route path="banners" element={loadable(<AdminBannersPage />)} />
          <Route path="pincodes" element={loadable(<AdminPincodesPage />)} />
          <Route path="wallets" element={loadable(<AdminWalletsPage />)} />
          <Route path="wallets/:userId" element={loadable(<AdminWalletDetailPage />)} />
          <Route path="withdrawals" element={loadable(<AdminWithdrawalsPage />)} />
          <Route path="withdrawals/:id" element={loadable(<AdminWithdrawalDetailPage />)} />
          <Route path="withdrawal-settings" element={loadable(<AdminWithdrawalSettingsPage />)} />
          <Route path="referrals" element={loadable(<AdminReferralsPage />)} />
          <Route path="referrals/:userId" element={loadable(<AdminReferralUserPage />)} />
          <Route path="commissions" element={loadable(<AdminCommissionsPage />)} />
          <Route path="binary-daily" element={loadable(<AdminBinaryDailyPage />)} />
          <Route path="compensation-settings" element={loadable(<AdminCompensationSettingsPage />)} />
          <Route path="commissions/manual-adjustment" element={loadable(<AdminManualAdjustmentPage />)} />
          <Route path="binary-carry" element={loadable(<AdminBinaryCarryPage />)} />
          <Route path="fraud" element={loadable(<AdminFraudPage />)} />
          <Route path="kyc" element={loadable(<AdminKycPage />)} />
        </Route>
      </Route>

      <Route element={loadable(<Layout />)}>
        <Route path="/" element={loadable(<HomePage />)} />
        <Route path="/products" element={loadable(<ProductsPage />)} />
        <Route path="/products/:slug" element={loadable(<ProductDetailPage />)} />
        <Route path="/login" element={loadable(<LoginPage />)} />
        <Route path="/register" element={loadable(<RegisterPage />)} />
        <Route path="/cart" element={loadable(<CartPage />)} />
        <Route path="/checkout" element={loadable(<CheckoutPage />)} />
        <Route path="/orders" element={loadable(<OrdersPage />)} />
        <Route path="/track-order" element={loadable(<TrackOrderLookupPage />)} />
        <Route path="/orders/track/:orderNumber" element={loadable(<TrackOrderPage />)} />
        <Route path="/wishlist" element={loadable(<WishlistPage />)} />
        <Route path="/about" element={loadable(<AboutPage />)} />
        <Route path="/contact" element={loadable(<ContactPage />)} />
        <Route path="/privacy" element={loadable(<PrivacyPage />)} />
        <Route path="/terms" element={loadable(<TermsPage />)} />
        <Route path="/refund-policy" element={loadable(<RefundPolicyPage />)} />
        <Route path="/shipping-policy" element={loadable(<ShippingPolicyPage />)} />
        <Route path="/income-disclaimer" element={loadable(<IncomeDisclaimerPage />)} />
        <Route path="/kyc-policy" element={loadable(<KycPolicyPage />)} />
        <Route path="/grievance" element={loadable(<GrievancePage />)} />
        <Route path="/wallet" element={loadable(<WalletPage />)} />
        <Route path="/wallet/history" element={loadable(<WalletHistoryPage />)} />
        <Route path="/wallet/withdraw" element={loadable(<WalletWithdrawPage />)} />
        <Route path="/wallet/bank-accounts" element={loadable(<WalletBankAccountsPage />)} />
        <Route path="/dashboard" element={loadable(<DashboardPage />)} />
        <Route path="/referral" element={loadable(<ReferralPage />)} />
        <Route path="/referral/binary-calculator" element={loadable(<BinaryCalculatorPage />)} />
        <Route path="/kyc" element={loadable(<KycPage />)} />
      </Route>
    </Routes>
  );
}
