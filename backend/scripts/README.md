# Backend scripts

Run these commands from the `backend` directory.

```bash
OWNER_NAME="Store Owner" \
OWNER_EMAIL="owner@example.com" \
OWNER_PASSWORD="use-a-strong-password" \
OWNER_CODE="OWN-001" \
npm run seed
```

`seed` creates the owner account, employee permissions, and the `admin`/`owner` roles.
Admin and other staff accounts must be created through the application's invitation flow.
The settings permissions (`settings.read`, `settings.update`, and `settings.manage`) are
registered by the seed. The OWNER must explicitly assign the required permissions to
non-owner roles; `settings.manage` is required for security settings.

Do not commit owner credentials to source control.

After deploying the inventory/catalog stock synchronization change, run this
once from the `backend` directory to reconcile existing products with their
warehouse inventory totals:

```bash
npx tsx scripts/sync-product-stock.ts
```

Before deploying warehouse-level variant inventory, run the index migration
once from the `backend` directory:

```bash
npx tsx scripts/migrate-inventory-variant-index.ts
```
