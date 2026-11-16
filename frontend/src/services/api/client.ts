import { refreshCustomerAccessToken } from "./customer-refresh";
import axios, {
    type AxiosError,
    type AxiosInstance,
    type AxiosRequestConfig,
    type InternalAxiosRequestConfig,
} from "axios";

import { env } from "@/config/env";

import {
    authStorage,
} from "@/lib/auth/auth-storage";

import {
    tokenStorage,
} from "@/lib/auth/token-storage";

import {
    useAuthStore,
} from "@/stores/auth.store";

import type {
    AuthUser,
} from "@/types/auth";

import type {
    ApiResponse,
} from "@/types/api";


/*
|--------------------------------------------------------------------------
| Extended Request Config
|--------------------------------------------------------------------------
|
| Prevents an infinite:
|
| 401 -> refresh -> retry -> 401 -> refresh -> ...
|
*/

interface RetryableRequestConfig
    extends InternalAxiosRequestConfig {
    _noptrixRetry?: boolean;
}


/*
|--------------------------------------------------------------------------
| Refresh Response Contracts
|--------------------------------------------------------------------------
*/

interface AdminRefreshResponse {
    readonly accessToken: string;
    readonly user: AuthUser;
    readonly userId: string;
    readonly adminId: string;
    readonly sessionId: string;
    readonly secretVerified: boolean;
}


interface OwnerRefreshResponse {
    readonly userId: string;
    readonly ownerId: string;
    readonly sessionId: string;
    readonly accessToken: string;
    readonly secretVerified: boolean;
}


/*
|--------------------------------------------------------------------------
| Bare Axios Client
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This client has NO interceptors.
|
| Otherwise the refresh request itself could trigger the same 401
| interceptor and create a refresh loop.
|
*/

const refreshClient: AxiosInstance =
    axios.create({
        baseURL: env.apiUrl,

        withCredentials: true,

        headers: {
            "Content-Type":
                "application/json",
        },

        timeout: 30_000,
    });


/*
|--------------------------------------------------------------------------
| Refresh Single-Flight State
|--------------------------------------------------------------------------
|
| If multiple API requests receive 401 at the same time:
|
| Request A -> 401
| Request B -> 401
| Request C -> 401
|
| only ONE refresh request is sent.
|
*/

let refreshPromise:
    | Promise<string | null>
    | null = null;


/*
|--------------------------------------------------------------------------
| Clear Authentication
|--------------------------------------------------------------------------
*/

const clearAuthentication = (): void => {
    tokenStorage.clear();

    authStorage.clear();

    useAuthStore
        .getState()
        .clearAuth();
};


/*
|--------------------------------------------------------------------------
| Refresh Customer Session
|--------------------------------------------------------------------------
*/

const refreshCustomerSession =
    async (): Promise<string | null> => {
        try {
            const response = await refreshCustomerAccessToken();
            return response.accessToken;
        } catch (error: unknown) {
            console.error(
                "[API] Customer refresh failed:",
                error instanceof Error ? error.message : "Unknown error",
            );
            clearAuthentication();
            return null;
        }
    };


/*
|--------------------------------------------------------------------------
| Refresh Admin Session
|--------------------------------------------------------------------------
*/

const refreshAdminSession =
    async (): Promise<string | null> => {

        try {
            const response =
                await refreshClient.post<
                    ApiResponse<AdminRefreshResponse>
                >(
                    "/admin-auth/refresh",
                    {},
                );

            const data =
                response.data.data;

            if (
                !data ||
                typeof data.accessToken !==
                    "string" ||
                !data.accessToken.trim()
            ) {
                throw new Error(
                    "Admin refresh did not return an access token.",
                );
            }

            /*
             * Replace the expired access token
             * in memory.
             */
            tokenStorage.set(
                data.accessToken,
            );

            /*
             * Refresh returns the complete
             * authenticated Admin user.
             */
            useAuthStore
                .getState()
                .setUser(
                    data.user,
                );

            /*
             * Keep persisted auth identity
             * synchronized.
             */
            authStorage.set({
                accountType:
                    data.user.accountType,

                userId:
                    data.user.id,

                role:
                    data.user.role,
            });

            return data.accessToken;

        } catch {
            clearAuthentication();

            return null;
        }
    };

const refreshEmployeeSession =
    async (): Promise<string | null> => {
        try {
            const response =
                await refreshClient.post<
                    ApiResponse<AdminRefreshResponse>
                >(
                    "/employee-auth/refresh",
                    {},
                );

            const data = response.data.data;

            if (
                !data ||
                typeof data.accessToken !== "string" ||
                !data.accessToken.trim() ||
                data.user.accountType !== "EMPLOYEE"
            ) {
                throw new Error(
                    "Employee refresh did not return a valid employee session.",
                );
            }

            tokenStorage.set(data.accessToken);
            useAuthStore.getState().setUser(data.user);
            authStorage.set({
                accountType: data.user.accountType,
                userId: data.user.id,
                role: data.user.role,
            });

            return data.accessToken;
        } catch {
            clearAuthentication();
            return null;
        }
    };



/*
|--------------------------------------------------------------------------
| Refresh Rider Session
|--------------------------------------------------------------------------
*/

const refreshRiderSession =
    async (): Promise<string | null> => {
        try {
            const response =
                await refreshClient.post<
                    ApiResponse<{
                        accessToken: string;
                        riderId: string;
                        sessionId: string;
                    }>
                >(
                    "/rider-auth/refresh",
                    {},
                );

            const data = response.data.data;

            if (
                !data ||
                typeof data.accessToken !== "string" ||
                !data.accessToken.trim()
            ) {
                throw new Error(
                    "Rider refresh did not return a valid access token.",
                );
            }

            tokenStorage.set(data.accessToken);

            return data.accessToken;
        } catch {
            clearAuthentication();
            return null;
        }
    };


/*
|--------------------------------------------------------------------------
| Refresh Owner Session
|--------------------------------------------------------------------------
|
| Owner refresh does not return a complete user profile,
| so preserve the existing authenticated user and update
| only the token/security state.
|
*/

const refreshOwnerSession =
    async (): Promise<string | null> => {

        try {
            const response =
                await refreshClient.post<
                    ApiResponse<OwnerRefreshResponse>
                >(
                    "/owner-auth/refresh",
                );

            const data =
                response.data.data;

            if (
                !data ||
                typeof data.accessToken !==
                    "string" ||
                !data.accessToken.trim()
            ) {
                throw new Error(
                    "Owner refresh did not return an access token.",
                );
            }

            tokenStorage.set(
                data.accessToken,
            );

            const currentUser =
                useAuthStore
                    .getState()
                    .user;

            if (currentUser) {
                useAuthStore
                    .getState()
                    .setUser({
                        ...currentUser,

                        id:
                            data.userId,

                        accountType:
                            "OWNER",

                        role:
                            "OWNER",

                        secretVerified:
                            data.secretVerified,
                    });
            }

            return data.accessToken;

        } catch {
            clearAuthentication();

            return null;
        }
    };


/*
|--------------------------------------------------------------------------
| Refresh Authentication
|--------------------------------------------------------------------------
*/

const refreshAuthentication =
    async (): Promise<string | null> => {

        const stored =
            authStorage.get();

        if (!stored) {
            clearAuthentication();

            return null;
        }

        switch (
            stored.accountType
        ) {
            case "ADMIN":
                return refreshAdminSession();

            case "EMPLOYEE":
                return refreshEmployeeSession();

            case "USER":
                return refreshCustomerSession();

            case "OWNER":
                return refreshOwnerSession();

            case "RIDER":
                return refreshRiderSession();

            default:
                return null;
        }
    };


/*
|--------------------------------------------------------------------------
| Single-Flight Refresh
|--------------------------------------------------------------------------
*/

const getRefreshedAccessToken =
    async (): Promise<string | null> => {

        if (!refreshPromise) {
            refreshPromise =
                refreshAuthentication()
                    .finally(() => {
                        refreshPromise = null;
                    });
        }

        return refreshPromise;
    };


/*
|--------------------------------------------------------------------------
| API Client
|--------------------------------------------------------------------------
*/

const apiClient: AxiosInstance =
    axios.create({
        baseURL: env.apiUrl,

        withCredentials: true,

        headers: {
            "Content-Type":
                "application/json",
        },

        timeout: 30_000,
    });


/*
|--------------------------------------------------------------------------
| Request Interceptor
|--------------------------------------------------------------------------
*/

apiClient.interceptors.request.use(
    (
        config: InternalAxiosRequestConfig,
    ) => {

        const accessToken =
            tokenStorage.get();

        if (accessToken) {
            config.headers.Authorization =
                `Bearer ${accessToken}`;
        }

        /*
        |--------------------------------------------------------------------------
        | FormData Handling
        |--------------------------------------------------------------------------
        |
        | Let the browser automatically set:
        |
        | Content-Type: multipart/form-data; boundary=...
        |
        */

        if (
            typeof FormData !==
                "undefined" &&
            config.data instanceof
                FormData
        ) {
            delete config.headers[
                "Content-Type"
            ];
        }

        return config;
    },

    (error: AxiosError) => {
        return Promise.reject(
            error,
        );
    },
);


/*
|--------------------------------------------------------------------------
| Response Interceptor
|--------------------------------------------------------------------------
*/

apiClient.interceptors.response.use(
    (response) => {
        return response;
    },

    async (
        error: AxiosError,
    ) => {

        const originalRequest =
            error.config as
                | RetryableRequestConfig
                | undefined;

        /*
        |--------------------------------------------------------------------------
        | Basic Validation
        |--------------------------------------------------------------------------
        */

        if (
            error.response?.status !==
                401 ||
            !originalRequest
        ) {
            return Promise.reject(
                error,
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Never Refresh Twice
        |--------------------------------------------------------------------------
        */

        if (
            originalRequest
                ._noptrixRetry
        ) {
            return Promise.reject(
                error,
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Never Intercept Refresh Requests
        |--------------------------------------------------------------------------
        */

        const requestUrl =
            originalRequest.url ??
            "";

        if (
            requestUrl.includes(
                "/admin-auth/refresh",
            ) ||
            requestUrl.includes(
                "/employee-auth/refresh",
            ) ||
            requestUrl.includes(
                "/owner-auth/refresh",
            ) ||
            requestUrl.includes(
                "/user-auth/refresh",
            ) ||
            requestUrl.includes(
                "/rider-auth/refresh",
            )
        ) {
            return Promise.reject(
                error,
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Only Refresh Known Account Types
        |--------------------------------------------------------------------------
        */

        const stored =
            authStorage.get();

        if (
            !stored ||
            (
                stored.accountType !== "ADMIN" &&
                stored.accountType !== "EMPLOYEE" &&
                stored.accountType !== "OWNER" &&
                stored.accountType !== "USER" &&
                stored.accountType !== "RIDER"
            )
        ) {
            return Promise.reject(
                error,
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Refresh
        |--------------------------------------------------------------------------
        */

        const newAccessToken =
            await getRefreshedAccessToken();

        if (!newAccessToken) {
            return Promise.reject(
                error,
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Retry Original Request
        |--------------------------------------------------------------------------
        */

        originalRequest
            ._noptrixRetry = true;

        originalRequest.headers.Authorization =
            `Bearer ${newAccessToken}`;

        return apiClient.request(
            originalRequest as AxiosRequestConfig,
        );
    },
);


export default apiClient;
