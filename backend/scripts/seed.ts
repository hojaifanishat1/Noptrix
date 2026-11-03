import { connectDatabase, disconnectDatabase } from "../src/config/database";

import { Types } from "mongoose";

import bcrypt from "bcryptjs";

import { Permission } from "../src/modules/permissions/permission.model";

import { Role } from "../src/modules/roles/role.model";

import { Owner } from "../src/modules/owners/owner.model";

import { User, type IUserDocument } from "../src/modules/users/user.model";

import { createUser } from "../src/modules/users/user.service";

import { seedNotificationTemplates } from "./seed-notification-templates";

import { Currency } from "../src/modules/currencies/currency.model";

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const PASSWORD_SALT_ROUNDS = 12;

/*
|--------------------------------------------------------------------------
| System Permissions
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Permission definitions do NOT automatically grant access.
|
| OWNER is unrestricted and does not depend on RolePermission.
|
| Every non-owner role receives permissions only when explicitly
| assigned by the OWNER.
|
|--------------------------------------------------------------------------
*/

const permissions = [
  ["users", "read", "users.read"],
  ["users", "update", "users.update"],
  ["customers", "read", "customers.read"],
  ["customers", "update", "customers.update"],

  // Collection Management
  ["collections", "read", "collections.read"],
  ["collections", "create", "collections.create"],
  ["collections", "update", "collections.update"],
  ["collections", "delete", "collections.delete"],

  // Attribute Management
  ["attributes", "read", "attributes.read"],
  ["attributes", "create", "attributes.create"],
  ["attributes", "update", "attributes.update"],
  ["attributes", "delete", "attributes.delete"],

  ["tickets", "read", "tickets.read"],
  ["tickets", "create", "tickets.create"],
  ["tickets", "update", "tickets.update"],
  ["tickets", "manage", "tickets.manage"],
  ["support", "read", "support.read"],
  ["support", "manage", "support.manage"],
  ["live-chat", "read", "live-chat.read"],
  ["live-chat", "reply", "live-chat.reply"],
  /*
    |--------------------------------------------------------------------------
    | Employee Management
    |--------------------------------------------------------------------------
    */

  ["employees", "read", "employees.read"],

  ["employees", "create", "employees.create"],

  ["employees", "update", "employees.update"],

  ["employees", "delete", "employees.delete"],

  ["employees", "manage", "employees.manage"],

  /*
    |--------------------------------------------------------------------------
    | Employee Invitation Management
    |--------------------------------------------------------------------------
    */

  ["employee_invitations", "read", "employee_invitations.read"],

  ["employee_invitations", "create", "employee_invitations.create"],

  ["employee_invitations", "revoke", "employee_invitations.revoke"],

  ["employee_invitations", "manage", "employee_invitations.manage"],

  /*
    |--------------------------------------------------------------------------
    | Job Vacancy Management
    |--------------------------------------------------------------------------
    */

  ["job_vacancies", "read", "job_vacancies.read"],

  ["job_vacancies", "create", "job_vacancies.create"],

  ["job_vacancies", "update", "job_vacancies.update"],

  ["job_vacancies", "delete", "job_vacancies.delete"],

  ["job_vacancies", "manage", "job_vacancies.manage"],

  /*
    |--------------------------------------------------------------------------
    | Job Application Management
    |--------------------------------------------------------------------------
    */

  ["job_applications", "read", "job_applications.read"],

  ["job_applications", "update", "job_applications.update"],

  ["job_applications", "approve", "job_applications.approve"],

  ["job_applications", "reject", "job_applications.reject"],

  ["job_applications", "manage", "job_applications.manage"],

  /*
    |--------------------------------------------------------------------------
    | Notification Template Management
    |--------------------------------------------------------------------------
    |
    | Owner-controlled notification template permissions.
    |
    |--------------------------------------------------------------------------
    */

  ["notification_templates", "read", "notification_templates.read"],

  ["notification_templates", "create", "notification_templates.create"],

  ["notification_templates", "update", "notification_templates.update"],

  ["notification_templates", "delete", "notification_templates.delete"],

  /*
    |--------------------------------------------------------------------------
    | System Settings
    |--------------------------------------------------------------------------
    */

  ["settings", "read", "settings.read"],

  ["settings", "update", "settings.update"],

  ["settings", "manage", "settings.manage"],

  /*
    |--------------------------------------------------------------------------
    | Currency Registry Management
    |--------------------------------------------------------------------------
    */

  ["currencies", "read", "currencies.read"],
  ["currencies", "create", "currencies.create"],
  ["currencies", "update", "currencies.update"],
  ["currencies", "manage", "currencies.manage"],

  ["abandoned_carts", "read", "abandoned_carts.read"],
  ["accounting", "read", "accounting.read"],
  ["accounting_reports", "read", "accounting_reports.read"],
  ["banners", "read", "banners.read"],
  ["brands", "read", "brands.read"],
  ["campaigns", "read", "campaigns.read"],
  ["cancellations", "read", "cancellations.read"],
  ["categories", "read", "categories.read"],
  ["checkout", "read", "checkout.read"],
  ["cod", "read", "cod.read"],
  ["coupons", "read", "coupons.read"],
  ["delivery", "read", "delivery.read"],
  ["delivery_fees", "read", "delivery_fees.read"],
  ["delivery_reports", "read", "delivery_reports.read"],
  ["delivery_zones", "read", "delivery_zones.read"],
  ["discounts", "read", "discounts.read"],
  ["email_campaigns", "read", "email_campaigns.read"],
  ["flash_sales", "read", "flash_sales.read"],
  ["gift_cards", "read", "gift_cards.read"],
  ["inventory", "read", "inventory.read"],
  ["inventory_reports", "read", "inventory_reports.read"],
  ["invoices", "read", "invoices.read"],
  ["loyalty", "read", "loyalty.read"],
  ["marketing", "read", "marketing.read"],
  ["orders", "read", "orders.read"],
  ["orders", "update", "orders.update"],
  ["payment_methods", "read", "payment_methods.read"],
  ["payment_reports", "read", "payment_reports.read"],
  ["payments", "read", "payments.read"],
  ["product_images", "read", "product_images.read"],
  ["product_tags", "read", "product_tags.read"],
  ["product_variants", "read", "product_variants.read"],
  ["products", "read", "products.read"],
  ["promotions", "read", "promotions.read"],
  ["purchase_returns", "read", "purchase_returns.read"],
  ["purchases", "read", "purchases.read"],
  ["push_campaigns", "read", "push_campaigns.read"],
  ["questions", "read", "questions.read"],
  ["ratings", "read", "ratings.read"],
  ["receipts", "read", "receipts.read"],
  ["recruitment_reports", "read", "recruitment_reports.read"],
  ["referrals", "read", "referrals.read"],
  ["refunds", "read", "refunds.read"],
  ["reports.analytics", "read", "reports.analytics.read"],
  ["reports.customers", "read", "reports.customers.read"],
  ["reports.delivery", "read", "reports.delivery.read"],
  ["reports", "export", "reports.export"],
  ["reports.inventory", "read", "reports.inventory.read"],
  ["reports.marketing", "read", "reports.marketing.read"],
  ["reports.notifications", "read", "reports.notifications.read"],
  ["reports.orders", "read", "reports.orders.read"],
  ["reports.payments", "read", "reports.payments.read"],
  ["reports.products", "read", "reports.products.read"],
  ["reports.riders", "read", "reports.riders.read"],
  ["reports.sales", "read", "reports.sales.read"],
  ["reports.sellers", "read", "reports.sellers.read"],
  ["returns", "read", "returns.read"],
  ["reviews", "read", "reviews.read"],
  ["reward_points", "read", "reward_points.read"],
  ["rewards", "read", "rewards.read"],
  ["rider_applications", "read", "rider_applications.read"],
  ["rider_earnings", "read", "rider_earnings.read"],
  ["rider_payouts", "read", "rider_payouts.read"],
  ["riders", "read", "riders.read"],
  ["riders", "verify", "riders.verify"],
  ["seller_applications", "read", "seller_applications.read"],
  ["seller_orders", "read", "seller_orders.read"],
  ["seller_payouts", "read", "seller_payouts.read"],
  ["seller_products", "read", "seller_products.read"],
  ["seller_reviews", "read", "seller_reviews.read"],
  ["sellers", "read", "sellers.read"],
  ["sellers", "suspend", "sellers.suspend"],
  ["sellers", "verify", "sellers.verify"],
  ["shipping", "read", "shipping.read"],
  ["sms_campaigns", "read", "sms_campaigns.read"],
  ["stock_movements", "read", "stock_movements.read"],
  ["stock_transfers", "read", "stock_transfers.read"],
  ["subcategories", "read", "subcategories.read"],
  ["suppliers", "read", "suppliers.read"],
  ["tracking", "read", "tracking.read"],
  ["broadcast", "read", "broadcast.read"],
  ["broadcast", "send", "broadcast.send"],
  ["transactions", "read", "transactions.read"],
] as const;

/*
|--------------------------------------------------------------------------
| System Roles
|--------------------------------------------------------------------------
|
| No role automatically receives every permission.
|
|--------------------------------------------------------------------------
*/

const roles = [
  {
    name: "Super Administrator",
    slug: "super-admin",
    hierarchyLevel: 100,
    description:
      "Highest non-owner administrative role. Access is explicitly assigned by the OWNER.",
  },

  {
    name: "Administrator",
    slug: "admin",
    hierarchyLevel: 90,
    description: "Administrative access explicitly assigned by the OWNER.",
  },

  {
    name: "Manager",
    slug: "manager",
    hierarchyLevel: 70,
    description: "Management access explicitly assigned by the OWNER.",
  },

  {
    name: "Product Manager",
    slug: "product-manager",
    hierarchyLevel: 60,
    description: "Product management access explicitly assigned by the OWNER.",
  },

  {
    name: "Order Manager",
    slug: "order-manager",
    hierarchyLevel: 60,
    description: "Order management access explicitly assigned by the OWNER.",
  },

  {
    name: "Inventory Manager",
    slug: "inventory-manager",
    hierarchyLevel: 60,
    description:
      "Inventory management access explicitly assigned by the OWNER.",
  },

  {
    name: "Delivery Manager",
    slug: "delivery-manager",
    hierarchyLevel: 60,
    description: "Delivery management access explicitly assigned by the OWNER.",
  },

  {
    name: "Support",
    slug: "support",
    hierarchyLevel: 40,
    description: "Customer support access explicitly assigned by the OWNER.",
  },

  {
    name: "Rider",
    slug: "rider",
    hierarchyLevel: 20,
    description:
      "Rider administrative access explicitly assigned by the OWNER.",
  },
] as const;

/*
|--------------------------------------------------------------------------
| Seed System Permissions
|--------------------------------------------------------------------------
*/

const seedPermissions = async (): Promise<Map<string, Types.ObjectId>> => {
  const permissionDocuments = new Map<string, Types.ObjectId>();

  for (const [resource, action, key] of permissions) {
    const permission = await Permission.findOneAndUpdate(
      {
        key,
      },
      {
        $set: {
          resource,
          action,
          key,
          description: `${resource} ${action} permission.`,
          isSystemPermission: true,
          status: "ACTIVE",
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    )
      .select("_id")
      .exec();

    if (!permission) {
      throw new Error(`Failed to seed permission: ${key}`);
    }

    permissionDocuments.set(key, permission._id);
  }

  console.log(`System permissions seeded: ${permissionDocuments.size}`);

  return permissionDocuments;
};

/*
|--------------------------------------------------------------------------
| Seed System Roles
|--------------------------------------------------------------------------
*/

const seedRoles = async (): Promise<Map<string, Types.ObjectId>> => {
  const roleDocuments = new Map<string, Types.ObjectId>();

  for (const roleInput of roles) {
    const role = await Role.findOneAndUpdate(
      {
        slug: roleInput.slug,
      },
      {
        $set: {
          ...roleInput,

          isSystemRole: true,

          status: "ACTIVE",
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    )
      .select("_id")
      .exec();

    if (!role) {
      throw new Error(`Failed to seed role: ${roleInput.slug}`);
    }

    roleDocuments.set(roleInput.slug, role._id);
  }

  console.log(`System roles seeded: ${roleDocuments.size}`);

  return roleDocuments;
};

/*
|--------------------------------------------------------------------------
| Seed Default Role Permissions
|--------------------------------------------------------------------------
|
| SECURITY RULE:
|
| There are NO automatic assignments.
|
| OWNER explicitly decides which permissions each role receives.
|
|--------------------------------------------------------------------------
*/

const seedRolePermissions = async (): Promise<void> => {
  console.log("Role permissions seeded: 0 automatic assignments.");

  console.log("All non-owner permissions remain OWNER-controlled.");
};

/*
|--------------------------------------------------------------------------
| Seed Owner
|--------------------------------------------------------------------------
*/

const seedOwner = async (): Promise<Types.ObjectId> => {
  const ownerName = process.env.OWNER_NAME?.trim();

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

  const ownerPassword = process.env.OWNER_PASSWORD;

  const ownerCode = process.env.OWNER_CODE?.trim();

  if (!ownerName || !ownerEmail || !ownerPassword || !ownerCode) {
    throw new Error(
      "OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD, and OWNER_CODE are required.",
    );
  }

  /*
    |--------------------------------------------------------------------------
    | Find Existing User
    |--------------------------------------------------------------------------
    */

  let ownerUser: IUserDocument | null = await User.findOne({
    email: ownerEmail,
  })
    .select("+password")
    .exec();

  /*
    |--------------------------------------------------------------------------
    | Create Owner User
    |--------------------------------------------------------------------------
    */

  if (!ownerUser) {
    ownerUser = await createUser({
      name: ownerName,

      email: ownerEmail,

      password: ownerPassword,
    });

    console.log(`Owner user created: ${ownerEmail}`);
  }

  if (!ownerUser) {
    throw new Error("Failed to create or retrieve owner user.");
  }

  if (ownerUser.status !== "ACTIVE") {
    ownerUser.status = "ACTIVE";
    await ownerUser.save();
  }

  /*
    |--------------------------------------------------------------------------
    | Synchronize Owner Password
    |--------------------------------------------------------------------------
    */

  const passwordMatches = await bcrypt.compare(
    ownerPassword,
    ownerUser.password,
  );

  if (!passwordMatches) {
    ownerUser.password = await bcrypt.hash(ownerPassword, PASSWORD_SALT_ROUNDS);

    ownerUser.passwordChangedAt = new Date();

    await ownerUser.save();

    console.log(`Owner password updated for ${ownerEmail}.`);
  }

  /*
    |--------------------------------------------------------------------------
    | Check Existing Owner
    |--------------------------------------------------------------------------
    */

  const existingOwner = await Owner.findOne({
    userId: ownerUser._id,
  }).exec();

  if (existingOwner) {
    const secretCodeHash = await bcrypt.hash(ownerCode, PASSWORD_SALT_ROUNDS);

    existingOwner.secretCodeHash = secretCodeHash;

    await Owner.collection.updateOne(
      { _id: existingOwner._id },
      { $set: { status: "ACTIVE" } },
    );

    console.log(
      "Owner account already exists; synchronized credentials and status.",
    );

    return ownerUser._id;
  }

  /*
    |--------------------------------------------------------------------------
    | Hash Owner Secret Code
    |--------------------------------------------------------------------------
    */

  const secretCodeHash = await bcrypt.hash(ownerCode, PASSWORD_SALT_ROUNDS);

  /*
    |--------------------------------------------------------------------------
    | Create Owner Profile
    |--------------------------------------------------------------------------
    */

  await Owner.create({
    userId: ownerUser._id,

    role: "OWNER",

    secretCodeHash,

    status: "ACTIVE",
  });

  console.log(`Owner profile created for ${ownerEmail}.`);

  return ownerUser._id;
};

/*
|--------------------------------------------------------------------------
| Main Seed
|--------------------------------------------------------------------------
*/

const seed = async (): Promise<void> => {
  await connectDatabase();

  // Ensure there is an ACTIVE default currency in the registry.
  // Keep an existing ACTIVE default; otherwise fall back to BDT.
  const activeDefaultCurrency = await Currency.exists({
    isDefault: true,
    status: "ACTIVE",
  });

  if (!activeDefaultCurrency) {
    await Currency.updateMany(
      { isDefault: true },
      { $set: { isDefault: false } },
    );

    await Currency.updateOne(
      { code: "BDT" },
      {
        $set: {
          name: "Bangladeshi Taka",
          symbol: "৳",
          decimalPlaces: 2,
          status: "ACTIVE",
          isDefault: true,
        },
        $setOnInsert: {
          code: "BDT",
        },
      },
      { upsert: true },
    );
  }

  // Synchronize currency display settings with the registry.
  // Existing monetary amounts are not converted.
  const seededDefaultCurrency = await Currency.findOne({
    isDefault: true,
    status: "ACTIVE",
  }).lean();

  if (seededDefaultCurrency) {
    const { Settings } = await import("../src/modules/settings/settings.model");

    await Settings.findOneAndUpdate(
      { category: "currency" },
      {
        $set: {
          "values.defaultCurrency": seededDefaultCurrency.code,
          "values.displaySymbol": seededDefaultCurrency.symbol,
          "values.decimalPlaces": seededDefaultCurrency.decimalPlaces,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
  }

  console.log("Starting NOPTRIX database seed...");

  /*
    |--------------------------------------------------------------------------
    | Permission Catalog
    |--------------------------------------------------------------------------
    */

  await seedPermissions();

  /*
    |--------------------------------------------------------------------------
    | System Roles
    |--------------------------------------------------------------------------
    */

  await seedRoles();

  /*
    |--------------------------------------------------------------------------
    | Explicit Role Permissions
    |--------------------------------------------------------------------------
    */

  await seedRolePermissions();

  /*
    |--------------------------------------------------------------------------
    | OWNER
    |--------------------------------------------------------------------------
    */

  const ownerUserId = await seedOwner();

  /*
    |--------------------------------------------------------------------------
    | Notification Templates
    |--------------------------------------------------------------------------
    |
    | 33 event keys × 4 channels = 132 templates.
    |
    |--------------------------------------------------------------------------
    */

  await seedNotificationTemplates(ownerUserId);

  console.log("NOPTRIX database seed completed successfully.");
};

/*
|--------------------------------------------------------------------------
| Execute Seed
|--------------------------------------------------------------------------
*/

seed()
  .catch((error: unknown) => {
    console.error("NOPTRIX seed failed.", error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
