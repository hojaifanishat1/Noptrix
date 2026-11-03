import { Router } from "express";

import userRoutes from "../modules/users/user.routes";
import roleRoutes from "../modules/roles/role.routes";
import permissionRoutes from "../modules/permissions/permission.routes";
import rolepermissionRoutes from "../modules/role-permissions/role.permission.routes";
import sessionRoutes from "../modules/sessions/session.routes";
import userAuthRoutes from "../modules/user-auth/user-auth.routes";
import verificationRoutes from "../modules/verification/verification.routes";
import customerRoutes from "../modules/customers/customer.routes";
import employeeRoutes from "../modules/employees/employee.routes";
import employeeAuthRoutes from "../modules/employee-auth/employee-auth.routes";
import employeeInvitationRoutes from "../modules/employee-invitations/invitation.routes";
import adminInvitationRoutes from "../modules/admin-invitations/admin-invitation.routes";
import { ownerAuthRouter } from "../modules/owner-auth/owner-auth.routes";
import { ownerRouter } from "../modules/owners/owner.routes";
import adminAuthRouter from "../modules/admin-auth/admin-auth.routes";
import adminRoutes from "../modules/admins/admin.routes";
import vacancyRoutes from "../modules/job-vacancies/vacancy.routes";
import jobApplicationRoutes from "../modules/job-applications/application.routes";
import categoryRoutes from "../modules/categories/category.routes";
import productVariantRoutes from "../modules/product-variants/variant.routes";
import productTagRoutes from "../modules/product-tags/tag.routes";
import productImageRoutes from "../modules/product-images/image.routes";
import productRoutes from "../modules/products/product.routes";
import searchRoutes from "../modules/search/search.routes";
import subcategoryRoutes from "../modules/subcategories/subcategory.routes";
import sellerApplicationRoutes from "../modules/seller-applications/seller-application.routes";
import sellerRoutes from "../modules/sellers/seller.routes";
import sellerProductRoutes from "../modules/seller-products/seller-product.routes";
import sellerOrderRoutes from "../modules/seller-orders/seller-order.routes";
import riderRoutes from "../modules/riders/rider.routes";
import trackingRoutes from "../modules/tracking/tracking.routes";
import riderAuthRoutes from "../modules/rider-auth/rider-auth.routes";
import riderEarningRoutes from "../modules/rider-earnings/riderEarning.routes";
import sellerAuthRoutes from "../modules/seller-auth/seller-auth.routes";
import communicationRoutes from "../modules/communication/communication.routes";
import liveChatRoutes from "../modules/live-chat/live-chat.routes";
import supportRoutes from "../modules/support/support.routes";
import faqRoutes from "../modules/faq/faq.routes";
import questionRoutes from "../modules/questions/question.routes";
import ticketRoutes from "../modules/tickets/ticket.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import notificationTemplateRoutes from "../modules/notifications/notification-template.routes";
import currencyRoutes from "../modules/currencies/currency.routes";
import settingsRoutes from "../modules/settings/settings.routes";
import codRoutes from "../modules/cod/cod.routes";
import transactionRoutes from "../modules/transactions/transaction.routes";
import paymentRoutes from "../modules/payments/payment.routes";
import paymentAdminRoutes from "../modules/payments/payment.admin.routes";
import paymentMethodRoutes from "../modules/payment-methods/payment-method.routes";
import webhookRoutes from "../modules/webhooks/webhook.routes";
import { auditLogsRoutes } from "../modules/audit-logs/audit-log.routes";
import { activityLogsRoutes } from "../modules/activity-logs/activity-log.routes";
import { systemLogsRoutes } from "../modules/system-logs/system-log.routes";
import { integrationsRoutes } from "../modules/integrations/integration.routes";
import { healthRoutes } from "../modules/health/health.routes";
import { maintenanceRoutes } from "../modules/maintenance/maintenance.routes";
import attributeRoutes from "../modules/attributes/attribute.routes";
import brandRoutes from "../modules/brands/brand.routes";
import collectionRoutes from "../modules/collections/collection.routes";
import stockMovementRoutes from "../modules/stock-movements/stockMovement.routes";
import inventoryRoutes from "../modules/inventory/inventory.routes";
import warehouseRoutes from "../modules/warehouses/warehouse.routes";

import ordersRoutes from "../modules/orders/order.routes";
import orderAdminRoutes from "../modules/orders/order.admin.routes";
import cartRoutes from "../modules/cart/cart.routes";
import checkoutRoutes from "../modules/checkout/checkout.routes";
import addressesRoutes from "../modules/addresses/address.routes";
import wishlistRoutes from "../modules/wishlist/wishlist.routes";
import cancellationsRoutes from "../modules/cancellations/cancellation.routes";
import returnsRoutes from "../modules/returns/return.routes";
import refundsRoutes from "../modules/refunds/refund.routes";
import shippingRoutes from "../modules/shipping/shipping.routes";
import deliveryRoutes from "../modules/delivery/delivery.routes";
import stockTransfersRoutes from "../modules/stock-transfers/stockTransfer.routes";
import suppliersRoutes from "../modules/suppliers/supplier.routes";
import purchasesRoutes from "../modules/purchases/purchase.routes";
import purchaseReturnsRoutes from "../modules/purchase-returns/purchaseReturn.routes";
import promotionsRoutes from "../modules/promotions/promotion.routes";
import discountRoutes from "../modules/discounts/discount.routes";
import couponRoutes from "../modules/coupons/coupon.routes";
import reviewRoutes from "../modules/reviews/review.routes";
import ratingRoutes from "../modules/ratings/rating.routes";
import receiptRoutes from "../modules/receipts/receipt.routes";
import lowStockRoutes from "../modules/low-stock/low-stock.routes";
import rewardPointRoutes from "../modules/reward-points/reward-point.routes";
import loyaltyRoutes from "../modules/loyalty/loyalty.routes";
import referralRoutes from "../modules/referrals/referral.routes";
import flashSaleRoutes from "../modules/flash-sales/flash-sale.routes";
import giftCardRoutes from "../modules/gift-cards/gift-card.routes";
import invoiceRoutes from "../modules/invoices/invoice.routes";
import accountingRoutes from "../modules/accounting/accounting.routes";

import { createMarketingCampaignRouter } from "../modules/marketing/campaigns/marketing-campaign.routes";
import marketingBannersRoutes from "../modules/marketing/banners/marketing-banner.routes";
// import { ro } from "zod/v4/locales"; // Removed unused import

const router = Router();

/*
|--------------------------------------------------------------------------
| Route Registry
|--------------------------------------------------------------------------
|
| Central API route registry.
|
| All feature/module routes will be registered here
| gradually as each module is implemented.
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| System Routes
|--------------------------------------------------------------------------
*/

/**
 * API health check.
 *
 * This route is intentionally lightweight and should
 * remain available without authentication.
 */

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
|
| These routes will be connected when the corresponding
| authentication modules are implemented.
|
| Planned:
|
| - /auth
| - /admin/auth
| - /owner/auth
| - /rider/auth
| - /seller/auth
|
|--------------------------------------------------------------------------
*/
router.use("/user-auth", userAuthRoutes);

router.use("/owner-auth", ownerAuthRouter);
router.use("/owners", ownerRouter);

router.use("/verification", verificationRoutes);

router.use("/admin-auth", adminAuthRouter);

router.use("/employee-auth", employeeAuthRoutes);

router.use("/admins", adminRoutes);

router.use("/rider-auth", riderAuthRoutes);

router.use("/seller-auth", sellerAuthRoutes);

/*
|--------------------------------------------------------------------------
| User Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /users
| - /customers
|
|--------------------------------------------------------------------------
*/
router.use("/users", userRoutes);

router.use("/customers", customerRoutes);

/*
|--------------------------------------------------------------------------
| Role & Permission Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /roles
| - /permissions
|
|--------------------------------------------------------------------------
*/
router.use("/roles", roleRoutes);

router.use("/permissions", permissionRoutes);

router.use("/role-permissions", rolepermissionRoutes);
/*
|--------------------------------------------------------------------------
| Employee & Hiring Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /employees
| - /vacancies
| - /applications
| - /invitations
|
|--------------------------------------------------------------------------
*/

router.use("/employees", employeeRoutes);

router.use("/job-vacancies", vacancyRoutes);

router.use("/job-applications", jobApplicationRoutes);

router.use("/employee-invitations", employeeInvitationRoutes);

router.use("/admin-invitations", adminInvitationRoutes);

/*
|--------------------------------------------------------------------------
| Seller Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /sellers
| - /seller-applications
| - /seller-orders
| - /seller-earnings
| - /commissions
| - /payouts
|
|--------------------------------------------------------------------------
*/

router.use("/sellers", sellerRoutes);

router.use("/seller-products", sellerProductRoutes);

router.use("/seller-applications", sellerApplicationRoutes);

router.use("/seller-orders", sellerOrderRoutes);

/*
|--------------------------------------------------------------------------
| Catalog Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /brands
| - /categories
| - /subcategories
| - /attributes
| - /products
| - /product-tags
| - /product-variants
| - /product-images
| - /collections
|
|--------------------------------------------------------------------------
*/

router.use("/attributes", attributeRoutes);

router.use("/brands", brandRoutes);

router.use("/categories", categoryRoutes);

router.use("/products", productRoutes);
router.use("/search", searchRoutes);

router.use("/product-images", productImageRoutes);

router.use("/product-tags", productTagRoutes);

router.use("/product-variants", productVariantRoutes);

router.use("/collections", collectionRoutes);

router.use("/subcategories", subcategoryRoutes);

/*
|--------------------------------------------------------------------------
| Inventory Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /warehouses
| - /inventory
| - /stock-movements
| - /stock-transfers
| - /suppliers
| - /purchases
| - /purchase-returns
|
|--------------------------------------------------------------------------
*/
router.use("/warehouses", warehouseRoutes);

router.use("/inventory", inventoryRoutes);

router.use("/stock-movements", stockMovementRoutes);

router.use("/suppliers", suppliersRoutes);

router.use("/purchases", purchasesRoutes);

router.use("/purchase-returns", purchaseReturnsRoutes);

router.use("/stock-transfers", stockTransfersRoutes);

/*
|--------------------------------------------------------------------------
| Customer Commerce Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /addresses
| - /cart
| - /wishlist
| - /checkout
|
|--------------------------------------------------------------------------
*/

router.use("/addresses", addressesRoutes);

router.use("/cart", cartRoutes);

router.use("/wishlist", wishlistRoutes);

router.use("/checkout", checkoutRoutes);

/*
|--------------------------------------------------------------------------
| Order Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /orders
| - /cancellations
| - /returns
| - /refunds
|
|--------------------------------------------------------------------------
*/

router.use("/orders", orderAdminRoutes);
router.use("/orders", ordersRoutes);

router.use("/cancellations", cancellationsRoutes);

router.use("/returns", returnsRoutes);

router.use("/refunds", refundsRoutes);
/*
|--------------------------------------------------------------------------
| Payment Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /payments
| - /payment-methods
| - /transactions
| - /webhooks
|
|--------------------------------------------------------------------------
*/

router.use("/payments", paymentRoutes);
router.use("/payments", paymentAdminRoutes);

router.use("/payment-methods", paymentMethodRoutes);

router.use("/transactions", transactionRoutes);

router.use("/webhooks", webhookRoutes);

/*
|--------------------------------------------------------------------------
| Shipping & Delivery Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /shipping
| - /delivery
| - /delivery-zones
| - /riders
| - /tracking
| - /rider-earnings
| - /cod
|
|--------------------------------------------------------------------------
*/
router.use("/shipping", shippingRoutes);

router.use("/delivery", deliveryRoutes);

router.use("/delivery-zones", deliveryRoutes);

router.use("/riders", riderRoutes);

router.use("/tracking", trackingRoutes);

router.use("/rider-earnings", riderEarningRoutes);

router.use("/cod", codRoutes);
/*
|--------------------------------------------------------------------------
| Marketing Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /coupons
| - /promotions
| - /discounts
| - /flash-sales
| - /loyalty
| - /gift-cards
| - /referrals
|
|--------------------------------------------------------------------------
*/

router.use("/marketing/campaigns", createMarketingCampaignRouter("GENERAL"));

router.use(
  "/marketing/email-campaigns",
  createMarketingCampaignRouter("EMAIL"),
);

router.use("/marketing/sms-campaigns", createMarketingCampaignRouter("SMS"));

router.use("/marketing/push-campaigns", createMarketingCampaignRouter("PUSH"));

router.use("/marketing/banners", marketingBannersRoutes);

/*
|--------------------------------------------------------------------------
| Dashboard Routes
|--------------------------------------------------------------------------
|
| - /dashboard/overview
|
|--------------------------------------------------------------------------
*/

router.use("/dashboard", dashboardRoutes);

router.use("/live-chat", liveChatRoutes);

router.use("/tickets", ticketRoutes);

router.use("/support", supportRoutes);

router.use("/faq", faqRoutes);

router.use("/questions", questionRoutes);

/*
|--------------------------------------------------------------------------
| Communication Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /communication/messages
| - /communication/announcements
|
|--------------------------------------------------------------------------
*/

router.use("/communication", communicationRoutes);

router.use("/announcements", communicationRoutes);

/*
|--------------------------------------------------------------------------
| Customer Engagement Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /reviews
| - /ratings
| - /questions
| - /notifications
| - /support
| - /tickets
| - /live-chat
| - /complaints
| - /faq
|
|--------------------------------------------------------------------------
*/
router.use("/questions", questionRoutes);

router.use("/notifications", communicationRoutes);

router.use("/support", supportRoutes);

router.use("/tickets", ticketRoutes);

router.use("/live-chat", liveChatRoutes);

router.use("/complaints", communicationRoutes);

router.use("/faq", faqRoutes);

/*
|--------------------------------------------------------------------------
| Notification Template Routes
|--------------------------------------------------------------------------
|
| Admin-managed notification templates.
|
| - /notification-templates
|
|--------------------------------------------------------------------------
*/

router.use("/notification-templates", notificationTemplateRoutes);

/*
|--------------------------------------------------------------------------
| Finance & Documents Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /invoices
| - /receipts
| - /accounting
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Management & Analytics Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /dashboard
| - /analytics
| - /reports
| - /marketing
|
|--------------------------------------------------------------------------
*/

router.use("/dashboard", dashboardRoutes);

router.use("/analytics", dashboardRoutes);

router.use("/reports", dashboardRoutes);

/*
|--------------------------------------------------------------------------
| Search & File Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /search
| - /files
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| System Management Routes
|--------------------------------------------------------------------------
|
| Planned:
|
| - /settings
| - /audit-logs
| - /activity-logs
| - /system-logs
| - /integrations
| - /health
| - /maintenance
|
|--------------------------------------------------------------------------
*/
router.use("/settings", settingsRoutes);

router.use("/audit-logs", auditLogsRoutes);

router.use("/activity-logs", activityLogsRoutes);

router.use("/system-logs", systemLogsRoutes);

router.use("/integrations", integrationsRoutes);

router.use("/health", healthRoutes);

router.use("/maintenance", maintenanceRoutes);

/*
|--------------------------------------------------------------------------
| Settings Routes
|--------------------------------------------------------------------------
|
| Administrative system settings.
|
| - GET /settings
| - GET /settings/:category
| - PATCH /settings/:category
|
|--------------------------------------------------------------------------
*/

router.use("/currencies", currencyRoutes);

router.use("/settings", settingsRoutes);









/*
  sessions
*/

router.use("/sessions", sessionRoutes);

/*
|--------------------------------------------------------------------------
| Route Registry Export
|--------------------------------------------------------------------------
*/

router.use("/promotions", promotionsRoutes);

router.use("/discounts", discountRoutes);
router.use("/coupons", couponRoutes);
router.use("/reviews", reviewRoutes);
router.use("/ratings", ratingRoutes);
router.use("/receipts", receiptRoutes);
router.use("/low-stock", lowStockRoutes);
router.use("/loyalty", loyaltyRoutes);
router.use("/reward-points", rewardPointRoutes);
router.use("/referrals", referralRoutes);

router.use("/flash-sales", flashSaleRoutes);

router.use("/gift-cards", giftCardRoutes);

router.use("/invoices", invoiceRoutes);
router.use("/accounting", accountingRoutes);

export default router;
