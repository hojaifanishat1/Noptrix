"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number };
type DrawMode = "polygon" | "radius";

interface Props {
  mode: DrawMode;
  points: Point[];
  radiusCenter: Point | null;
  radiusKm: number;
  onPointsChange: (points: Point[]) => void;
  onRadiusCenterChange: (point: Point | null) => void;
}

export default function LeafletZoneMap({
  mode,
  points,
  radiusCenter,
  radiusKm,
  onPointsChange,
  onRadiusCenterChange,
}: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);
  const stateRef = useRef({ mode, points, onPointsChange, onRadiusCenterChange });
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    stateRef.current = { mode, points, onPointsChange, onRadiusCenterChange };
  }, [mode, points, onPointsChange, onRadiusCenterChange]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const L = await import("leaflet");
      if (cancelled || !elementRef.current || mapRef.current) return;

      const map = L.map(elementRef.current).setView([23.8103, 90.4125], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const layers = L.layerGroup().addTo(map);
      mapRef.current = map;
      layersRef.current = layers;

      map.on("click", (event) => {
        const current = stateRef.current;
        const point = {
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        };

        if (current.mode === "polygon") {
          current.onPointsChange([...current.points, point]);
        } else {
          current.onRadiusCenterChange(point);
        }
      });

      requestAnimationFrame(() => map.invalidateSize());
    }

    void initialize();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function renderShapes() {
      const map = mapRef.current;
      const layers = layersRef.current;
      if (!map || !layers) return;

      const L = await import("leaflet");
      if (cancelled) return;

      layers.clearLayers();

      if (mode === "polygon") {
        const coordinates = points.map(
          (point) => [point.lat, point.lng] as [number, number],
        );

        if (coordinates.length >= 2) {
          L.polyline(coordinates, {
            color: "#2563eb",
            weight: 2,
            dashArray: coordinates.length < 3 ? "6 6" : undefined,
          }).addTo(layers);
        }

        if (coordinates.length >= 3) {
          L.polygon(coordinates, {
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 0.2,
            weight: 2,
          }).addTo(layers);
        }

        points.forEach((point, index) => {
          const marker = L.marker([point.lat, point.lng], {
            draggable: true,
          }).addTo(layers);

          marker.bindTooltip(`Point ${index + 1}`);

          marker.on("dragend", () => {
            const position = marker.getLatLng();
            const updated = [...stateRef.current.points];
            updated[index] = {
              lat: position.lat,
              lng: position.lng,
            };
            stateRef.current.onPointsChange(updated);
          });
        });
      } else if (radiusCenter) {
        L.circle([radiusCenter.lat, radiusCenter.lng], {
          radius: radiusKm * 1000,
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.2,
          weight: 2,
        }).addTo(layers);

        L.marker([radiusCenter.lat, radiusCenter.lng])
          .bindTooltip("Radius center")
          .addTo(layers);
      }
    }

    void renderShapes();

    return () => {
      cancelled = true;
    };
  }, [mode, points, radiusCenter, radiusKm]);

  async function searchPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearchError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query.trim())}`,
        { headers: { Accept: "application/json" } },
      );

      if (!response.ok) {
        throw new Error("Place search failed. Please try again.");
      }

      const results = (await response.json()) as Array<{
        lat: string;
        lon: string;
      }>;

      if (!results.length) {
        throw new Error("No matching place found.");
      }

      mapRef.current?.setView(
        [Number(results[0].lat), Number(results[0].lon)],
        14,
      );
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Unable to search place.",
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={searchPlace} className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search city or address..."
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {searchError && (
        <p role="alert" className="text-sm text-red-600">
          {searchError}
        </p>
      )}

      <div
        ref={elementRef}
        className="z-0 h-[420px] w-full overflow-hidden rounded-xl border border-gray-300 bg-gray-100"
      />

      <p className="text-xs text-gray-500">
        Map data © OpenStreetMap contributors.
      </p>
    </div>
  );
}
