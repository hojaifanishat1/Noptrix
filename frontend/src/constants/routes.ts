export const ROUTES = {
    /*
    |--------------------------------------------------------------------------
    | Public Store
    |--------------------------------------------------------------------------
    */

    HOME: "/",
    SHOP: "/shop",
    SEARCH: "/search",

    PRODUCTS: "/products",
    CATEGORIES: "/categories",
    SUBCATEGORIES: "/subcategories",
    BRANDS: "/brands",
    COLLECTIONS: "/collections",

    CART: "/cart",
    WISHLIST: "/wishlist",

    CHECKOUT: "/checkout",

    TRACK_ORDER: "/track-order",

    /*
    |--------------------------------------------------------------------------
    | Customer
    |--------------------------------------------------------------------------
    */

    CUSTOMER_ACCOUNT: "/account",

    CUSTOMER_PROFILE: "/account/profile",
    CUSTOMER_ORDERS: "/account/orders",
    CUSTOMER_ADDRESSES: "/account/addresses",
    CUSTOMER_WISHLIST: "/account/wishlist",
    CUSTOMER_REVIEWS: "/account/reviews",
    CUSTOMER_REWARDS: "/account/rewards",
    CUSTOMER_REFERRALS: "/account/referrals",
    CUSTOMER_COUPONS: "/account/coupons",
    CUSTOMER_NOTIFICATIONS: "/account/notifications",
    CUSTOMER_SECURITY: "/account/security",

    /*
    |--------------------------------------------------------------------------
    | Administration
    |--------------------------------------------------------------------------
    |
    | OWNER + ADMIN share the same management panel.
    |
    */

    ADMIN_PANEL: "/admin",

    ADMIN_DASHBOARD: "/admin",

    ADMIN_ADMINS: "/admin/admins",
    ADMIN_USERS: "/admin/users",
    ADMIN_ROLES: "/admin/roles",
    ADMIN_PERMISSIONS: "/admin/permissions",

    ADMIN_PRODUCTS: "/admin/products",
    ADMIN_PRODUCT_VARIANTS: "/admin/product-variants",
    ADMIN_PRODUCT_IMAGES: "/admin/product-images",
    ADMIN_PRODUCT_TAGS: "/admin/product-tags",

    ADMIN_CATEGORIES: "/admin/categories",
    ADMIN_SUBCATEGORIES: "/admin/subcategories",
    ADMIN_BRANDS: "/admin/brands",
    ADMIN_COLLECTIONS: "/admin/collections",
    ADMIN_ATTRIBUTES: "/admin/attributes",

    ADMIN_ORDERS: "/admin/orders",
    ADMIN_CANCELLATIONS: "/admin/cancellations",
    ADMIN_RETURNS: "/admin/returns",
    ADMIN_REFUNDS: "/admin/refunds",

    ADMIN_CUSTOMERS: "/admin/customers",
    ADMIN_EMPLOYEES: "/admin/employees",

    ADMIN_SELLERS: "/admin/sellers",
    ADMIN_SELLER_APPLICATIONS: "/admin/seller-applications",
    ADMIN_SELLER_ORDERS: "/admin/seller-orders",

    ADMIN_RIDERS: "/admin/riders",
    ADMIN_RIDER_INVITATIONS: "/admin/rider-invitations",

    ADMIN_INVITATIONS: "/admin/invitations",

    ADMIN_INVENTORY: "/admin/inventory",
    ADMIN_STOCK_MOVEMENTS: "/admin/stock-movements",
    ADMIN_STOCK_TRANSFERS: "/admin/stock-transfers",
    ADMIN_LOW_STOCK: "/admin/low-stock",

    ADMIN_PURCHASES: "/admin/purchases",
    ADMIN_PURCHASE_RETURNS: "/admin/purchase-returns",

    ADMIN_PAYMENTS: "/admin/payments",
    ADMIN_PAYMENT_METHODS: "/admin/payment-methods",
    ADMIN_INVOICES: "/admin/invoices",
    ADMIN_RECEIPTS: "/admin/receipts",
    ADMIN_ACCOUNTING: "/admin/accounting",

    ADMIN_DELIVERY: "/admin/delivery",
    ADMIN_DELIVERY_ASSIGNMENTS: "/admin/delivery/assignments",
    ADMIN_DELIVERY_ZONES: "/admin/delivery/zones",
    ADMIN_DELIVERY_FEES: "/admin/delivery/fees",
    ADMIN_DELIVERY_AREAS: "/admin/delivery/areas",
    ADMIN_DELIVERY_METHODS: "/admin/delivery/methods",
    ADMIN_DELIVERY_FEE_OVERRIDES: "/admin/delivery/fee-overrides",
    ADMIN_DELIVERY_ELIGIBILITY: "/admin/delivery/eligibility",

    ADMIN_SHIPPING: "/admin/shipping",
    ADMIN_SHIPPING_ASSIGNMENTS: "/admin/shipping/assignments",
    ADMIN_SHIPPING_PROVIDERS: "/admin/shipping/providers",

    ADMIN_COUPONS: "/admin/coupons",
    ADMIN_DISCOUNTS: "/admin/discounts",
    ADMIN_PROMOTIONS: "/admin/promotions",
    ADMIN_FLASH_SALES: "/admin/flash-sales",
    ADMIN_GIFT_CARDS: "/admin/gift-cards",

    ADMIN_LOYALTY: "/admin/loyalty",
    ADMIN_REWARD_POINTS: "/admin/reward-points",
    ADMIN_REFERRALS: "/admin/referrals",

    ADMIN_REVIEWS: "/admin/reviews",
    ADMIN_RATINGS: "/admin/ratings",
    ADMIN_QUESTIONS: "/admin/questions",

    ADMIN_JOB_VACANCIES: "/admin/job-vacancies",
    ADMIN_JOB_APPLICATIONS: "/admin/job-applications",

    ADMIN_REPORTS: "/admin/reports",
    ADMIN_SETTINGS: "/admin/settings",

    /*
    |--------------------------------------------------------------------------
    | Seller Panel
    |--------------------------------------------------------------------------
    */

    SELLER_PANEL: "/seller-panel",

    SELLER_PRODUCTS: "/seller-panel/products",
    SELLER_CREATE_PRODUCT: "/seller-panel/products/create",

    SELLER_INVENTORY: "/seller-panel/inventory",
    SELLER_STOCK: "/seller-panel/stock",

    SELLER_ORDERS: "/seller-panel/orders",
    SELLER_SELLER_ORDERS: "/seller-panel/seller-orders",

    SELLER_PAYMENTS: "/seller-panel/payments",
    SELLER_EARNINGS: "/seller-panel/earnings",

    SELLER_RETURNS: "/seller-panel/returns",
    SELLER_REVIEWS: "/seller-panel/reviews",

    SELLER_NOTIFICATIONS: "/seller-panel/notifications",
    SELLER_PROFILE: "/seller-panel/profile",
    SELLER_SETTINGS: "/seller-panel/settings",

    /*
    |--------------------------------------------------------------------------
    | Rider Panel
    |--------------------------------------------------------------------------
    */

    RIDER_PANEL: "/rider-panel",

    RIDER_DELIVERIES: "/rider-panel/deliveries",
    RIDER_ORDERS: "/rider-panel/orders",
    RIDER_EARNINGS: "/rider-panel/earnings",

    RIDER_NOTIFICATIONS: "/rider-panel/notifications",
    RIDER_PROFILE: "/rider-panel/profile",
    RIDER_SETTINGS: "/rider-panel/settings",
} as const;