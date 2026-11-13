const SELLER_REFRESH_KEY = "noptrix-seller-refresh-token";
const SELLER_SESSION_KEY = "noptrix-seller-session";

export interface SellerSessionData {
  sellerId: string;
  sessionId: string;
}

export const sellerAuthStorage = {
  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(SELLER_REFRESH_KEY);
  },

  setRefreshToken(token: string): void {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(SELLER_REFRESH_KEY, token);
  },

  getSession(): SellerSessionData | null {
    if (typeof window === "undefined") return null;

    try {
      const value = sessionStorage.getItem(SELLER_SESSION_KEY);
      return value ? JSON.parse(value) as SellerSessionData : null;
    } catch {
      return null;
    }
  },

  setSession(session: SellerSessionData): void {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(SELLER_SESSION_KEY, JSON.stringify(session));
  },

  clear(): void {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(SELLER_REFRESH_KEY);
    sessionStorage.removeItem(SELLER_SESSION_KEY);
  },
};

let sellerAccessToken: string | null = null;

export const sellerTokenStorage = {
  get(): string | null {
    return sellerAccessToken;
  },

  set(token: string): void {
    sellerAccessToken = token;
  },

  clear(): void {
    sellerAccessToken = null;
  },
};
