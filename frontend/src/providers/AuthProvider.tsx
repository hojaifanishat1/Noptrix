"use client";

import { useEffect, type ReactNode } from "react";

import { useAuthStore } from "@/stores/auth.store";

import { adminAuthApi } from "@/services/api/admin-auth.api";
import { employeeAuthApi } from "@/services/api/employee-auth.api";
import { customerAuthApi } from "@/services/api/customer-auth.api";
import { ownerAuthApi } from "@/services/api/owner-auth.api";
import { riderAuthApi } from "@/services/api/rider-auth.api";

import { authStorage } from "@/lib/auth/auth-storage";
import { tokenStorage } from "@/lib/auth/token-storage";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

interface AuthProviderProps {
    children: ReactNode;
}

/*
|--------------------------------------------------------------------------
| Owner Refresh Single-Flight
|--------------------------------------------------------------------------
|
| Prevents multiple refresh requests from using the same old refresh token
| at the same time.
|
| This is especially important in Next.js/React development mode where
| effects can be executed more than once during development.
|
*/

let ownerRefreshPromise:
    | Promise<
          Awaited<
              ReturnType<
                  typeof ownerAuthApi.refresh
              >
          >
      >
    | null = null;

/*
|--------------------------------------------------------------------------
| Admin Refresh Single-Flight
|--------------------------------------------------------------------------
*/

let adminRefreshPromise:
    | Promise<
          Awaited<
              ReturnType<
                  typeof adminAuthApi.refresh
              >
          >
      >
    | null = null;

let employeeRefreshPromise:
    | Promise<
        Awaited<
            ReturnType<
                typeof employeeAuthApi.refresh
            >
        >
    >
    | null = null;

/*
|--------------------------------------------------------------------------
| Customer Refresh Single-Flight
|--------------------------------------------------------------------------
*/

let customerRefreshPromise:
    | Promise<
        Awaited<
            ReturnType<
                typeof customerAuthApi.refresh
            >
        >
    >
    | null = null;

const refreshCustomerOnce = () => {
    if (!customerRefreshPromise) {
        customerRefreshPromise =
            customerAuthApi.refresh().finally(() => {
                customerRefreshPromise = null;
            });
    }

    return customerRefreshPromise;
};

/*
|--------------------------------------------------------------------------
| Auth Provider
|--------------------------------------------------------------------------
*/

export function AuthProvider({
    children,
}: AuthProviderProps) {
    const setUser =
        useAuthStore(
            (state) =>
                state.setUser,
        );

    const setLoading =
        useAuthStore(
            (state) =>
                state.setLoading,
        );

    const clearAuth =
        useAuthStore(
            (state) =>
                state.clearAuth,
        );

    useEffect(() => {
        let mounted = true;

        /*
        |--------------------------------------------------------------------------
        | Restore Session
        |--------------------------------------------------------------------------
        */

        const restoreSession =
            async (): Promise<void> => {
                try {
                    /*
                    |--------------------------------------------------------------------------
                    | Read Stored Authentication State
                    |--------------------------------------------------------------------------
                    */

                    const stored =
                        authStorage.get();

                    if (!stored) {
                        if (mounted) {
                            setLoading(false);
                        }

                        return;
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | OWNER
                    |--------------------------------------------------------------------------
                    |
                    | OWNER uses refresh-token rotation.
                    |
                    | The refresh operation is protected by a single-flight
                    | promise so multiple simultaneous restore attempts share
                    | the same refresh request.
                    |
                    */

                    if (
                        stored.accountType ===
                        "OWNER"
                    ) {
                        if (
                            !ownerRefreshPromise
                        ) {
                            ownerRefreshPromise =
                                ownerAuthApi
                                    .refresh()
                                    .finally(
                                        () => {
                                            ownerRefreshPromise =
                                                null;
                                        },
                                    );
                        }

                        const response =
                            await ownerRefreshPromise;

                        if (
                            !mounted ||
                            useAuthStore.getState().isAuthenticated
                        ) {
                            return;
                        }

                        /*
                        |--------------------------------------------------------------------------
                        | Store New Access Token
                        |--------------------------------------------------------------------------
                        */

                        tokenStorage.set(
                            response.accessToken,
                        );

                        /*
                        |--------------------------------------------------------------------------
                        | Restore OWNER State
                        |--------------------------------------------------------------------------
                        |
                        | Keep the verification state returned by the
                        | refreshed OWNER session.
                        |
                        */

                        setUser({
                            id:
                                response.userId ??
                                stored.userId,

                            email: "",

                            accountType:
                                "OWNER",

                            role: "OWNER",

                            isVerified:
                                false,

                            secretVerified:
                                response.secretVerified,
                        });

                        return;
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | ADMIN
                    |--------------------------------------------------------------------------
                    |
                    | Admin access tokens live only in memory.
                    | Therefore a page reload must first use the
                    | httpOnly refresh cookie to obtain a new token.
                    |
                    */

                    if (
                        stored.accountType ===
                        "ADMIN"
                    ) {
                        if (
                            !adminRefreshPromise
                        ) {
                            adminRefreshPromise =
                                adminAuthApi
                                    .refresh()
                                    .finally(
                                        () => {
                                            adminRefreshPromise =
                                                null;
                                        },
                                    );
                        }

                        const response =
                            await adminRefreshPromise;

                        if (
                            !mounted ||
                            useAuthStore.getState().isAuthenticated
                        ) {
                            return;
                        }

                        tokenStorage.set(
                            response.accessToken,
                        );

                        setUser(
                            response.user,
                        );

                        authStorage.set({
                            accountType:
                                response.user.accountType,

                            userId:
                                response.user.id,

                            role:
                                response.user.role,
                        });

                        return;
                    }

                    if (
                        stored.accountType ===
                        "EMPLOYEE"
                    ) {
                        if (!employeeRefreshPromise) {
                            employeeRefreshPromise =
                                employeeAuthApi
                                    .refresh()
                                    .finally(() => {
                                        employeeRefreshPromise = null;
                                    });
                        }

                        const response =
                            await employeeRefreshPromise;

                        if (
                            !mounted ||
                            useAuthStore.getState().isAuthenticated
                        ) {
                            return;
                        }

                        tokenStorage.set(response.accessToken);
                        setUser(response.user);
                        authStorage.set({
                            accountType: response.user.accountType,
                            userId: response.user.id,
                            role: response.user.role,
                        });
                        return;
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | CUSTOMER / RIDER
                    |--------------------------------------------------------------------------
                    */

                    let user;

                    switch (
                        stored.accountType
                    ) {
                        case "USER": {
                            let response;

                            try {
                                response = await refreshCustomerOnce();
                            } catch (error: unknown) {
                                console.error(
                                    "[Customer restore] Refresh failed:",
                                    error instanceof Error ? error.message : "Unknown error",
                                );
                                throw error;
                            }

                            tokenStorage.set(response.accessToken);

                            try {
                                user = await customerAuthApi.getMe();
                            } catch (error: unknown) {
                                console.error(
                                    "[Customer restore] getMe failed:",
                                    error instanceof Error ? error.message : "Unknown error",
                                );
                                throw error;
                            }

                            break;
                        }

                        case "RIDER":
                            user =
                                await riderAuthApi.getMe();
                            break;

                        default:
                            throw new Error(
                                "Unsupported account type.",
                            );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Prevent State Updates After Unmount
                    |--------------------------------------------------------------------------
                    */

                    if (
                        !mounted ||
                        useAuthStore.getState().isAuthenticated
                    ) {
                        return;
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Restore User
                    |--------------------------------------------------------------------------
                    */

                    setUser(user);

                    /*
                    |--------------------------------------------------------------------------
                    | Keep Local Auth State In Sync
                    |--------------------------------------------------------------------------
                    */

                    authStorage.set({
                        accountType:
                            user.accountType,

                        userId:
                            user.id,

                        role:
                            user.role,
                    });
                } catch (error: unknown) {
                    console.error(
                        "[AuthProvider] Session restoration failed:",
                        error instanceof Error ? error.message : "Unknown error",
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Session Restoration Failed
                    |--------------------------------------------------------------------------
                    */

                    if (!mounted) {
                        return;
                    }

                    if (useAuthStore.getState().isAuthenticated) {
                        return;
                    }

                    authStorage.clear();

                    tokenStorage.clear();

                    clearAuth();
                } finally {
                    /*
                    |--------------------------------------------------------------------------
                    | Finish Loading
                    |--------------------------------------------------------------------------
                    */

                    if (mounted) {
                        setLoading(false);
                    }
                }
            };

        void restoreSession();

        /*
        |--------------------------------------------------------------------------
        | Cleanup
        |--------------------------------------------------------------------------
        */

        return () => {
            mounted = false;
        };
    }, [
        setUser,
        setLoading,
        clearAuth,
    ]);

    return children;
}