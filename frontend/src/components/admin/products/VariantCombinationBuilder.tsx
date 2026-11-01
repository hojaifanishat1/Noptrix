"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Layers3, Wand2 } from "lucide-react";

import type { Attribute } from "@/features/attributes/attribute.types";
import type {
  ProductOption,
  ProductVariant,
} from "@/features/product-variants/variant.types";

const MAX_COMBINATIONS = 100;

interface Props {
  attributes: readonly Attribute[];
  existingVariants: readonly ProductVariant[];
  onGenerate: (combinations: ProductOption[]) => Promise<void>;
  disabled?: boolean;
}

function normalizeCombination(options: ProductOption): string {
  return JSON.stringify(
    Object.entries(options)
      .map(([key, value]) => [
        key.trim().toLowerCase(),
        value.trim().toLowerCase(),
      ])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}

function buildCombinations(
  selections: Record<string, string[]>,
): ProductOption[] {
  const entries = Object.entries(selections).filter(
    ([, values]) => values.length > 0,
  );

  if (!entries.length) return [];

  return entries.reduce<ProductOption[]>(
    (combinations, [attributeName, values]) => {
      const next: ProductOption[] = [];

      for (const combination of combinations) {
        for (const value of values) {
          if (next.length >= MAX_COMBINATIONS) return next;

          next.push({
            ...combination,
            [attributeName]: value,
          });
        }
      }

      return next;
    },
    [{}],
  );
}

export default function VariantCombinationBuilder({
  attributes,
  existingVariants,
  onGenerate,
  disabled = false,
}: Props) {
  const [selections, setSelections] = useState<
    Record<string, string[]>
  >({});
  const [selectedCombinations, setSelectedCombinations] = useState<
    Set<string>
  >(new Set());
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState("");

  const usableAttributes = useMemo(
    () =>
      attributes.filter(
        (attribute) =>
          attribute.status === "ACTIVE" &&
          attribute.isVariant &&
          (attribute.type === "SELECT" ||
            attribute.type === "MULTI_SELECT") &&
          attribute.options.length > 0,
      ),
    [attributes],
  );

  const combinations = useMemo(
    () => buildCombinations(selections),
    [selections],
  );

  const existingKeys = useMemo(
    () =>
      new Set(
        existingVariants.map((variant) =>
          normalizeCombination(variant.options ?? {}),
        ),
      ),
    [existingVariants],
  );

  const availableCombinations = useMemo(
    () =>
      combinations.filter(
        (combination) =>
          !existingKeys.has(normalizeCombination(combination)),
      ),
    [combinations, existingKeys],
  );

  const selectedCount = availableCombinations.filter((combination) =>
    selectedCombinations.has(normalizeCombination(combination)),
  ).length;

  const updateSelection = (
    attributeName: string,
    value: string,
    checked: boolean,
  ) => {
    setSelections((current) => {
      const values = new Set(current[attributeName] ?? []);

      if (checked) values.add(value);
      else values.delete(value);

      return {
        ...current,
        [attributeName]: [...values],
      };
    });

    setSelectedCombinations(new Set());
    setError("");
  };

  const toggleCombination = (combination: ProductOption) => {
    const key = normalizeCombination(combination);

    setSelectedCombinations((current) => {
      const next = new Set(current);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return next;
    });
  };

  const selectAll = () => {
    setSelectedCombinations(
      new Set(availableCombinations.map(normalizeCombination)),
    );
  };

  const generate = async () => {
    const selected = availableCombinations.filter((combination) =>
      selectedCombinations.has(normalizeCombination(combination)),
    );

    if (!selected.length) {
      setError("Select at least one new combination.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      await onGenerate(selected);
      setSelectedCombinations(new Set());
      setSelections({});
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to generate variants.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <Layers3 className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold text-slate-900">
              Combination builder
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Generate variants from product attributes
            </span>
          </span>
        </span>

        <ChevronDown
          className={`h-5 w-5 text-slate-400 transition ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-slate-100 p-5">
          {usableAttributes.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No active SELECT or MULTI_SELECT variant attributes found.
              Create an Attribute and enable its Variant Attribute setting.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {usableAttributes.map((attribute) => {
                const selected = selections[attribute.name] ?? [];

                return (
                  <div
                    key={attribute._id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {attribute.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {attribute.options.length} available values
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {selected.length} selected
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {attribute.options.map((option) => {
                        const checked = selected.includes(option);

                        return (
                          <label
                            key={option}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                              checked
                                ? "border-violet-300 bg-violet-50 text-violet-800"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled || creating}
                              onChange={(event) =>
                                updateSelection(
                                  attribute.name,
                                  option,
                                  event.target.checked,
                                )
                              }
                              className="sr-only"
                            />
                            {checked && <Check className="h-3.5 w-3.5" />}
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">
                  Combination preview
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Existing combinations are automatically excluded.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-3 py-1.5 text-slate-600">
                  Total: {combinations.length}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-emerald-700">
                  New: {availableCombinations.length}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-slate-600">
                  Selected: {selectedCount}
                </span>
              </div>
            </div>

            {combinations.length >= MAX_COMBINATIONS && (
              <p className="mt-3 text-xs text-amber-700">
                Preview is capped at {MAX_COMBINATIONS} combinations.
              </p>
            )}

            {availableCombinations.length > 0 ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={disabled || creating}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Select all new
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCombinations(new Set())}
                    disabled={disabled || creating}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Clear selection
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {availableCombinations.map((combination) => {
                    const key = normalizeCombination(combination);
                    const checked = selectedCombinations.has(key);

                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                          checked
                            ? "border-violet-300 bg-violet-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled || creating}
                          onChange={() => toggleCombination(combination)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-800">
                            {Object.values(combination).join(" / ")}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {Object.entries(combination)
                              .map(([name, value]) => `${name}: ${value}`)
                              .join(" · ")}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Select attribute values to preview combinations.
              </p>
            )}

            {error && (
              <p role="alert" className="mt-3 whitespace-pre-line text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void generate()}
              disabled={disabled || creating || selectedCount === 0}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {creating
                ? "Generating..."
                : `Generate ${selectedCount} variants`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
