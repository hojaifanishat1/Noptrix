"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { deliveryAdminApi } from "@/services/api/delivery-admin.api";
import type { DeliveryZone } from "@/features/delivery-zones/delivery-zone.types";
import LeafletZoneMap from "./leaflet-zone-map";

type Point = { lat: number; lng: number };
type DrawMode = "polygon" | "radius";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  country: "BD",
  state: "",
  city: "",
  postalCodes: "",
  deliveryFee: 0,
  freeDeliveryThreshold: "",
  minimumOrderAmount: 0,
  estimatedDeliveryMinDays: 1,
  estimatedDeliveryMaxDays: 3,
  supportsCOD: true,
  priority: 0,
  status: "active" as "active" | "inactive",
};

type ZoneForm = typeof emptyForm;

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

function radiusToPolygon(center: Point, radiusKm: number): Point[] {
  const earthRadiusKm = 6371;
  const distance = radiusKm / earthRadiusKm;
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const points: Point[] = [];

  for (let i = 0; i < 64; i++) {
    const bearing = (2 * Math.PI * i) / 64;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distance) +
        Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing),
    );

    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1),
        Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2),
      );

    points.push({
      lat: (lat2 * 180) / Math.PI,
      lng: (lng2 * 180) / Math.PI,
    });
  }

  return points;
}

function toGeoJSON(points: Point[]) {
  const ring = points.map((point) => [point.lng, point.lat]);

  if (ring.length > 0) {
    const first = ring[0];
    const last = ring[ring.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first]);
    }
  }

  return {
    type: "Polygon" as const,
    coordinates: [ring],
  };
}

function fromGeoJSON(zone?: DeliveryZone): Point[] {
  const ring = zone?.boundary?.coordinates?.[0] ?? [];
  return ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
}

export default function DeliveryZonesWorkspace() {
  const [items, setItems] = useState<DeliveryZone[]>([]);
  const [form, setForm] = useState<ZoneForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [mode, setMode] = useState<DrawMode>("polygon");
  const [points, setPoints] = useState<Point[]>([]);
  const [radiusKm, setRadiusKm] = useState(5);
  const [radiusCenter, setRadiusCenter] = useState<Point | null>(null);

  const boundaryPoints =
    mode === "radius" && radiusCenter
      ? radiusToPolygon(radiusCenter, radiusKm)
      : points;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await deliveryAdminApi.zones.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        sort: "priority",
      });

      setItems(result.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load delivery zones.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof ZoneForm>(key: K, value: ZoneForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetMap() {
    setPoints([]);
    setRadiusCenter(null);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    resetMap();
    setMode("polygon");
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(zone: DeliveryZone) {
    setEditingId(zone._id);

    setForm({
      name: zone.name,
      slug: zone.slug,
      description: zone.description ?? "",
      country: zone.country || "BD",
      state: zone.state ?? "",
      city: zone.city,
      postalCodes: (zone.postalCodes ?? []).join(", "),
      deliveryFee: zone.deliveryFee ?? 0,
      freeDeliveryThreshold:
        zone.freeDeliveryThreshold == null
          ? ""
          : String(zone.freeDeliveryThreshold),
      minimumOrderAmount: zone.minimumOrderAmount ?? 0,
      estimatedDeliveryMinDays: zone.estimatedDeliveryMinDays ?? 1,
      estimatedDeliveryMaxDays: zone.estimatedDeliveryMaxDays ?? 3,
      supportsCOD: zone.supportsCOD ?? true,
      priority: zone.priority ?? 0,
      status: zone.status,
    });

    resetMap();
    setPoints(fromGeoJSON(zone));
    setMode("polygon");
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function undoPoint() {
    if (mode === "polygon") {
      setPoints((current) => current.slice(0, -1));
    } else {
      setRadiusCenter(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (boundaryPoints.length < 3) {
      setError(
        "Select a delivery area on the map. A polygon needs at least 3 points.",
      );
      return;
    }

    if (
      boundaryPoints.some(
        (point) =>
          !Number.isFinite(point.lat) ||
          !Number.isFinite(point.lng) ||
          Math.abs(point.lat) > 90 ||
          Math.abs(point.lng) > 180,
      )
    ) {
      setError("The map boundary contains invalid coordinates.");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      country: form.country.trim().toUpperCase(),
      state: form.state.trim() || undefined,
      city: form.city.trim(),
      postalCodes: form.postalCodes
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      boundary: toGeoJSON(boundaryPoints),

      // Keep existing API fields with their defaults.
      deliveryFee: Number(form.deliveryFee),
      freeDeliveryThreshold:
        form.freeDeliveryThreshold === ""
          ? undefined
          : Number(form.freeDeliveryThreshold),
      minimumOrderAmount: Number(form.minimumOrderAmount),
      estimatedDeliveryMinDays: Number(form.estimatedDeliveryMinDays),
      estimatedDeliveryMaxDays: Number(form.estimatedDeliveryMaxDays),
      supportsCOD: form.supportsCOD,
      priority: Number(form.priority),

      status: form.status,
    };

    try {
      if (editingId) {
        await deliveryAdminApi.zones.update(editingId, payload);
        setSuccess("Delivery zone updated.");
      } else {
        await deliveryAdminApi.zones.create(payload);
        setSuccess("Delivery zone created.");
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      resetMap();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save delivery zone.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(zone: DeliveryZone) {
    setError("");

    try {
      await deliveryAdminApi.zones.setStatus(
        zone._id,
        zone.status === "active" ? "inactive" : "active",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status.");
    }
  }

  async function remove(zone: DeliveryZone) {
    if (!window.confirm(`Delete delivery zone "${zone.name}"?`)) return;

    setError("");

    try {
      await deliveryAdminApi.zones.remove(zone._id);
      setSuccess("Delivery zone deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete zone.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Delivery Zones</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create map-based delivery coverage areas and manage zones.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          + Add Zone
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {success}
        </p>
      )}

      <input
        className={inputClass}
        placeholder="Search zones..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-5 rounded-xl border border-gray-200 p-5 dark:border-gray-800"
        >
          <div>
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit Delivery Zone" : "Create Delivery Zone"}
            </h2>
            <p className="text-sm text-gray-500">
              Select the zone boundary on the map and enter its basic details.
            </p>
          </div>

          <section className="space-y-3">
            <h3 className="font-semibold">1. Delivery Area Map</h3>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("polygon");
                  setRadiusCenter(null);
                }}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  mode === "polygon"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300"
                }`}
              >
                Draw Polygon
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("radius");
                  setPoints([]);
                }}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  mode === "radius"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300"
                }`}
              >
                Radius Area
              </button>

              <button
                type="button"
                onClick={undoPoint}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Undo
              </button>

              <button
                type="button"
                onClick={resetMap}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600"
              >
                Clear Map
              </button>
            </div>

            {mode === "polygon" ? (
              <p className="text-sm text-gray-500">
                Click at least 3 points on the map to draw the delivery
                boundary. Drag markers to adjust points.
              </p>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-40 space-y-1 text-sm">
                  Radius (KM)
                  <input
                    type="number"
                    min="0.1"
                    max="200"
                    step="0.1"
                    value={radiusKm}
                    onChange={(event) =>
                      setRadiusKm(Math.max(0.1, Number(event.target.value)))
                    }
                    className={inputClass}
                  />
                </label>
                <p className="text-sm text-gray-500">
                  Select a center point on the map. The radius becomes a
                  GeoJSON polygon when saved.
                </p>
              </div>
            )}

            <LeafletZoneMap
              mode={mode}
              points={points}
              radiusCenter={radiusCenter}
              radiusKm={radiusKm}
              onPointsChange={setPoints}
              onRadiusCenterChange={setRadiusCenter}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-gray-500">
                {mode === "polygon"
                  ? `${points.length} boundary points selected`
                  : radiusCenter
                    ? `${radiusKm} KM radius selected`
                    : "Select a center point on the map"}
              </span>
              <span className="font-medium">
                {boundaryPoints.length >= 3
                  ? "Boundary ready"
                  : "Boundary not complete"}
              </span>
            </div>
          </section>

          <div className="border-t border-gray-200 pt-5 dark:border-gray-800">
            <h3 className="mb-3 font-semibold">2. Zone Information</h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                Zone Name
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  className={inputClass}
                  value={form.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    update("name", value);

                    if (!editingId) {
                      update(
                        "slug",
                        value
                          .toLowerCase()
                          .trim()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                      );
                    }
                  }}
                />
              </label>

              <label className="space-y-1 text-sm">
                Slug
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  className={inputClass}
                  value={form.slug}
                  onChange={(event) => update("slug", event.target.value)}
                />
              </label>

              <label className="space-y-1 text-sm">
                Country
                <input
                  required
                  maxLength={3}
                  className={inputClass}
                  value={form.country}
                  onChange={(event) => update("country", event.target.value)}
                />
              </label>

              <label className="space-y-1 text-sm">
                State
                <input
                  className={inputClass}
                  value={form.state}
                  onChange={(event) => update("state", event.target.value)}
                />
              </label>

              <label className="space-y-1 text-sm">
                City
                <input
                  required
                  className={inputClass}
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                />
              </label>

              <label className="space-y-1 text-sm">
                Postal Codes (comma separated)
                <input
                  className={inputClass}
                  placeholder="1205, 1207, 1212"
                  value={form.postalCodes}
                  onChange={(event) =>
                    update("postalCodes", event.target.value)
                  }
                />
              </label>

              <label className="space-y-1 text-sm">
                Status
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(event) =>
                    update("status", event.target.value as ZoneForm["status"])
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>

          <label className="block space-y-1 text-sm">
            Description
            <textarea
              maxLength={500}
              className={inputClass}
              rows={3}
              value={form.description}
              onChange={(event) =>
                update("description", event.target.value)
              }
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={saving || boundaryPoints.length < 3}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Zone"
                  : "Create Zone"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetMap();
              }}
              className="rounded-lg border px-5 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {[
                "Zone",
                "Location",
                "Postal Codes",
                "Map",
                "Status",
                "Actions",
              ].map((heading) => (
                <th key={heading} className="px-4 py-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  Loading zones...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No delivery zones found.
                </td>
              </tr>
            ) : (
              items.map((zone) => (
                <tr
                  key={zone._id}
                  className="border-t border-gray-200 dark:border-gray-800"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{zone.name}</div>
                    <div className="text-xs text-gray-500">{zone.slug}</div>
                  </td>

                  <td className="px-4 py-3">
                    {[zone.city, zone.state, zone.country]
                      .filter(Boolean)
                      .join(", ")}
                  </td>

                  <td className="px-4 py-3">
                    {zone.postalCodes?.join(", ") || "—"}
                  </td>

                  <td className="px-4 py-3">
                    {zone.boundary ? "Mapped" : "Not mapped"}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={
                        zone.status === "active"
                          ? "text-green-600"
                          : "text-gray-500"
                      }
                    >
                      {zone.status}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(zone)}
                        className="text-blue-600"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => void changeStatus(zone)}
                        className="text-amber-600"
                      >
                        {zone.status === "active" ? "Disable" : "Enable"}
                      </button>

                      <button
                        onClick={() => void remove(zone)}
                        className="text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
