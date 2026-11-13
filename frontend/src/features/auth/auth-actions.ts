import {
    authApi,
} from "@/services/api/auth.api";

import {
    adminAuthApi,
} from "@/services/api/admin-auth.api";

import {
    employeeAuthApi,
} from "@/services/api/employee-auth.api";

import {
    customerAuthApi,
} from "@/services/api/customer-auth.api";

import {
    ownerAuthApi,
} from "@/services/api/owner-auth.api";

import {
    riderAuthApi,
} from "@/services/api/rider-auth.api";

import {
    useAuthStore,
} from "@/stores/auth.store";

import {
    authStorage,
} from "@/lib/auth/auth-storage";

import {
    tokenStorage,
} from "@/lib/auth/token-storage";

import type {
    AuthUser,
    LoginAttemptResponse,
    LoginInput,
    LoginVerificationChallenge,
    LoginVerificationInput,
    RegisterInput,
    RegistrationResponse,
} from "@/types/auth";


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const saveAuthenticatedUser = (
    user: AuthUser,
): AuthUser => {
    useAuthStore
        .getState()
        .setUser(user);

    authStorage.set({
        accountType:
            user.accountType,

        userId:
            user.id,

        role:
            user.role,
    });

    return user;
};


/*
|--------------------------------------------------------------------------
| Owner
|--------------------------------------------------------------------------
*/

export const ownerLogin = async (
    input: LoginInput,
): Promise<AuthUser> => {
    const response =
        await ownerAuthApi.login(input);

    tokenStorage.set(
        response.accessToken,
    );

    const user: AuthUser = {
        id:
            response.userId,

        email:
            input.email,

        accountType:
            "OWNER",

        role:
            "OWNER",

        isVerified:
            false,

        secretVerified:
            false,
    };

    return saveAuthenticatedUser(
        user,
    );
};


export const ownerVerifySecret = async (
    secretCode: string,
): Promise<AuthUser> => {
    const response =
        await ownerAuthApi.verifySecret({
            secretCode,
        });

    tokenStorage.set(
        response.accessToken,
    );

    const user: AuthUser = {
        id:
            response.userId,

        email:
            useAuthStore
                .getState()
                .user?.email ?? "",

        accountType:
            "OWNER",

        role:
            "OWNER",

        isVerified:
            true,

        secretVerified:
            true,
    };

    return saveAuthenticatedUser(
        user,
    );
};


/*
|--------------------------------------------------------------------------
| Admin
|--------------------------------------------------------------------------
*/

export const adminLogin = async (
    input: LoginInput,
): Promise<AuthUser | LoginVerificationChallenge> => {

    const response =
        await adminAuthApi.login(input);

    if ("verificationRequired" in response) {
        return response;
    }

    return saveStaffLogin(response);
};

export const adminVerifyLogin = async (
    input: LoginVerificationInput,
): Promise<AuthUser> => {
    const response = await adminAuthApi.verifyLogin(input);

    return saveStaffLogin(response);
};

export const adminResendLoginCode = async (
    challengeId: string,
): Promise<LoginVerificationChallenge> => {
    const response = await adminAuthApi.resendLoginCode(challengeId);

    if (!("verificationRequired" in response)) {
        throw new Error("Login verification challenge was not returned.");
    }

    return response;
};

const saveStaffLogin = (
    response: LoginAttemptResponse,
): AuthUser => {
    if ("verificationRequired" in response) {
        throw new Error("Login verification was not completed.");
    }

    const accessToken =
        response.tokens?.accessToken ??
        response.accessToken;

    if (accessToken) {
        tokenStorage.set(
            accessToken,
        );
    }

    return saveAuthenticatedUser(
        response.user,
    );
};

export const employeeLogin = async (
    input: LoginInput,
): Promise<AuthUser | LoginVerificationChallenge> => {
    const response =
        await employeeAuthApi.login(input);

    if ("verificationRequired" in response) {
        return response;
    }

    return saveStaffLogin(response);
};

export const employeeVerifyLogin = async (
    input: LoginVerificationInput,
): Promise<AuthUser> => {
    const response = await employeeAuthApi.verifyLogin(input);

    return saveStaffLogin(response);
};

export const employeeResendLoginCode = async (
    challengeId: string,
): Promise<LoginVerificationChallenge> => {
    const response = await employeeAuthApi.resendLoginCode(challengeId);

    if (!("verificationRequired" in response)) {
        throw new Error("Login verification challenge was not returned.");
    }

    return response;
};

/*
|--------------------------------------------------------------------------
| Customer
|--------------------------------------------------------------------------
*/

export const customerLogin = async (
    input: LoginInput,
): Promise<AuthUser> => {
    const response =
        await customerAuthApi.login(input);

    if (response.accessToken) {
        tokenStorage.set(
            response.accessToken,
        );
    }

    return saveAuthenticatedUser(
        response.user,
    );
};


export const customerRegister =
    async (
        input: RegisterInput,
    ): Promise<RegistrationResponse> => {
        return customerAuthApi.register(input);
    };


/*
|--------------------------------------------------------------------------
| Rider
|--------------------------------------------------------------------------
*/

export const riderLogin = async (
    input: LoginInput,
): Promise<AuthUser> => {
    const response =
        await riderAuthApi.login(input);

    tokenStorage.set(
        response.accessToken,
    );

    try {
        const profile =
            await riderAuthApi.getMe();

        return saveAuthenticatedUser({
            ...profile,
            id: response.userId,
            accountType: "RIDER",
            role: "RIDER",
        });
    } catch (error) {
        tokenStorage.clear();
        await riderAuthApi.logout(response.sessionId);
        throw error;
    }
};

export const riderVerifyLogin = async (
    input: LoginVerificationInput,
): Promise<AuthUser> => {
    const response = await riderAuthApi.verifyLogin(input);

    tokenStorage.set(response.accessToken);

    try {
        const profile = await riderAuthApi.getMe();

        return saveAuthenticatedUser({
            ...profile,
            id: response.userId,
            accountType: "RIDER",
            role: "RIDER",
        });
    } catch (error) {
        tokenStorage.clear();
        await riderAuthApi.logout(response.sessionId);
        throw error;
    }
};

export const riderResendLoginCode = async (
    challengeId: string,
) => {
    return riderAuthApi.resendLoginCode(challengeId);
};


/*
|--------------------------------------------------------------------------
| Current Session
|--------------------------------------------------------------------------
*/

export const restoreAuthSession =
    async (): Promise<AuthUser> => {

        const stored =
            authStorage.get();

        if (!stored) {
            throw new Error(
                "No stored authentication state.",
            );
        }

        let user: AuthUser;

        switch (
            stored.accountType
        ) {
            case "EMPLOYEE": {
                const response =
                    await employeeAuthApi.refresh();

                tokenStorage.set(response.accessToken);
                user = response.user;
                break;
            }

            case "ADMIN": {
                const response =
                    await adminAuthApi.refresh();

                tokenStorage.set(
                    response.accessToken,
                );

                user =
                    response.user;

                break;
            }

            case "USER":
                user =
                    await customerAuthApi.getMe();
                break;

            case "RIDER":
                user =
                    await riderAuthApi.getMe();
                break;

            case "OWNER":
                throw new Error(
                    "Owner session restoration requires secret verification.",
                );

            default:
                throw new Error(
                    "Unsupported account type.",
                );
        }

        return saveAuthenticatedUser(
            user,
        );
    };


/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

export const logout = async (): Promise<void> => {
    try {
        const user =
            useAuthStore
                .getState()
                .user;

        switch (
            user?.accountType
        ) {
            case "OWNER":
                await ownerAuthApi.logout();
                break;

            case "ADMIN":
                await adminAuthApi.logout();
                break;

            case "EMPLOYEE":
                await employeeAuthApi.logout();
                break;

            case "USER":
                if (user.id) {
                    await customerAuthApi.logout(
                        user.id,
                    );
                }
                break;

            case "RIDER":
                await riderAuthApi.logout();
                break;

            default:
                await authApi.logout();
                break;
        }
    } finally {
        tokenStorage.clear();

        authStorage.clear();

        useAuthStore
            .getState()
            .clearAuth();
    }
};
