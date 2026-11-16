import {
    ROUTES,
} from "./routes";

export interface NavigationItem {
    label: string;
    href: string;
    icon?: string;
    permission?: string;
    roles?: readonly string[];
    children?: readonly NavigationItem[];
}

export const ADMIN_NAVIGATION: readonly NavigationItem[] = [
    {
        label: "Dashboard",
        href: ROUTES.ADMIN_DASHBOARD,
        icon: "LayoutDashboard",
    },

    {
        label: "Products",
        href: ROUTES.ADMIN_PRODUCTS,
        icon: "Package",
    },

    {
        label: "Categories",
        href: ROUTES.ADMIN_CATEGORIES,
        icon: "Tags",
    },

    {
        label: "Orders",
        href: ROUTES.ADMIN_ORDERS,
        icon: "ShoppingCart",
    },

    {
        label: "Customers",
        href: ROUTES.ADMIN_CUSTOMERS,
        icon: "Users",
    },

    {
        label: "Sellers",
        href: ROUTES.ADMIN_SELLERS,
        icon: "Store",
    },

    {
        label: "Riders",
        href: ROUTES.ADMIN_RIDERS,
        icon: "Bike",
    },

    {
        label: "Inventory",
        href: ROUTES.ADMIN_INVENTORY,
        icon: "Boxes",
    },

    {
        label: "Payments",
        href: ROUTES.ADMIN_PAYMENTS,
        icon: "CreditCard",
    },

    {
        label: "Reports",
        href: ROUTES.ADMIN_REPORTS,
        icon: "BarChart3",
    },

    {
        label: "Employees",
        href: ROUTES.ADMIN_EMPLOYEES,
        icon: "UserRoundCog",
    },

    {
        label: "Invitations",
        href: ROUTES.ADMIN_INVITATIONS,
        icon: "MailPlus",
    },

    {
        label: "Settings",
        href: ROUTES.ADMIN_SETTINGS,
        icon: "Settings",
    },
];

export const SELLER_NAVIGATION: readonly NavigationItem[] = [
    {
        label: "Dashboard",
        href: ROUTES.SELLER_PANEL,
        icon: "LayoutDashboard",
    },

    {
        label: "Products",
        href: ROUTES.SELLER_PRODUCTS,
        icon: "Package",
    },

    {
        label: "Inventory",
        href: ROUTES.SELLER_INVENTORY,
        icon: "Boxes",
    },

    {
        label: "Orders",
        href: ROUTES.SELLER_ORDERS,
        icon: "ShoppingCart",
    },

    {
        label: "Payments",
        href: ROUTES.SELLER_PAYMENTS,
        icon: "CreditCard",
    },

    {
        label: "Earnings",
        href: ROUTES.SELLER_EARNINGS,
        icon: "Wallet",
    },

    {
        label: "Returns",
        href: ROUTES.SELLER_RETURNS,
        icon: "RotateCcw",
    },

    {
        label: "Reviews",
        href: ROUTES.SELLER_REVIEWS,
        icon: "Star",
    },

    {
        label: "Notifications",
        href: ROUTES.SELLER_NOTIFICATIONS,
        icon: "Bell",
    },

    {
        label: "Profile",
        href: ROUTES.SELLER_PROFILE,
        icon: "User",
    },

    {
        label: "Settings",
        href: ROUTES.SELLER_SETTINGS,
        icon: "Settings",
    },
];

export const RIDER_NAVIGATION: readonly NavigationItem[] = [
    {
        label: "Dashboard",
        href: ROUTES.RIDER_PANEL,
        icon: "LayoutDashboard",
    },

    {
        label: "Deliveries",
        href: ROUTES.RIDER_DELIVERIES,
        icon: "Truck",
    },


    {
        label: "Verification",
        href: "/rider-panel/verification",
        icon: "ShieldCheck",
    },


    {
        label: "Orders",
        href: ROUTES.RIDER_ORDERS,
        icon: "Package",
    },

    {
        label: "Earnings",
        href: ROUTES.RIDER_EARNINGS,
        icon: "Wallet",
    },

    {
        label: "Notifications",
        href: ROUTES.RIDER_NOTIFICATIONS,
        icon: "Bell",
    },

    {
        label: "Profile",
        href: ROUTES.RIDER_PROFILE,
        icon: "User",
    },

    {
        label: "Settings",
        href: ROUTES.RIDER_SETTINGS,
        icon: "Settings",
    },
];