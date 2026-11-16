import {
    NextResponse,
    type NextRequest,
} from "next/server";

import {
    isProtectedRoute,
} from "@/lib/auth/route-access";

/*
|--------------------------------------------------------------------------
| Auth Pages
|--------------------------------------------------------------------------
|
| Authentication pages must always remain accessible.
|
*/

const AUTH_PATHS = [
    "/owner",
    "/owner/verify-secret",

    "/admin/login",
    "/admin/verify-otp",
    "/employee/login",
    "/employee/verify-otp",

    "/customer/login",
    "/customer/register",

    "/seller/login",
    "/rider/login",
    "/rider/verify-otp",
] as const;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const isAuthPage = (
    pathname: string,
): boolean => {
    return AUTH_PATHS.some(
        (path) =>
            pathname === path ||
            pathname.startsWith(
                `${path}/`,
            ),
    );
};

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Access tokens are intentionally stored in memory on the client.
| Therefore middleware cannot authenticate the user by reading a
| client-side access-token cookie.
|
| Authentication and authorization are handled by:
|
| 1. AuthProvider
| 2. Account-specific AuthGuard
| 3. Backend authorization
|
| Middleware only handles route classification here.
|
*/

export function middleware(
    request: NextRequest,
) {
    const {
        pathname,
    } = request.nextUrl;

    /*
    |--------------------------------------------------------------------------
    | Authentication Pages
    |--------------------------------------------------------------------------
    */

    if (
        isAuthPage(pathname)
    ) {
        return NextResponse.next();
    }

    /*
    |--------------------------------------------------------------------------
    | Non-Protected Routes
    |--------------------------------------------------------------------------
    */

    if (
        !isProtectedRoute(
            pathname,
        )
    ) {
        return NextResponse.next();
    }

    /*
    |--------------------------------------------------------------------------
    | Protected Routes
    |--------------------------------------------------------------------------
    |
    | Do not perform token authentication here.
    |
    | The client-side AuthGuard will determine whether the current
    | authenticated account can access the requested panel.
    |
    */

    return NextResponse.next();
}

/*
|--------------------------------------------------------------------------
| Matcher
|--------------------------------------------------------------------------
*/

export const config = {
    matcher: [
        "/admin/:path*",
        "/seller-panel/:path*",
        "/rider-panel/:path*",
        "/rider/:path*",
    ],
};
