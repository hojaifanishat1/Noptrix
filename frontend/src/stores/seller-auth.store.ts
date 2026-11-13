"use client";

import { create } from "zustand";
import type { Seller } from "@/services/api/sellers.api";

interface SellerAuthState {
  seller: Seller | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSeller: (seller: Seller | null) => void;
  setLoading: (loading: boolean) => void;
  clearSeller: () => void;
}

export const useSellerAuthStore = create<SellerAuthState>((set) => ({
  seller: null,
  isAuthenticated: false,
  isLoading: true,

  setSeller: (seller) =>
    set({
      seller,
      isAuthenticated: Boolean(seller && seller.status === "ACTIVE"),
    }),

  setLoading: (isLoading) => set({ isLoading }),

  clearSeller: () =>
    set({
      seller: null,
      isAuthenticated: false,
    }),
}));
