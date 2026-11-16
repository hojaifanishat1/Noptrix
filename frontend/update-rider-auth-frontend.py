from pathlib import Path
import re

ROOT = Path.cwd()

FILES = {
    "api": ROOT / "src/services/api/rider-auth.api.ts",
    "actions": ROOT / "src/features/auth/auth-actions.ts",
    "login": ROOT / "src/features/auth/rider/rider-login-form.tsx",
    "verify": ROOT / "src/features/auth/rider/rider-login-verification-form.tsx",
}

# Read all files first. Nothing is written until every replacement succeeds.
data = {key: path.read_text() for key, path in FILES.items()}



def replace_once(text, old, new, label):
    def normalize(value):
        return [
            (ch, index)
            for index, ch in enumerate(value)
            if not ch.isspace()
        ]

    old_chars = "".join(ch for ch, _ in normalize(old))
    normalized_text = normalize(text)
    text_chars = "".join(ch for ch, _ in normalized_text)
    positions = [index for _, index in normalized_text]

    matches = []
    offset = 0

    while True:
        found = text_chars.find(old_chars, offset)
        if found < 0:
            break
        matches.append(found)
        offset = found + 1

    if len(matches) != 1:
        raise RuntimeError(
            f"{label}: expected 1 match, found {len(matches)}. "
            "No files have been written."
        )

    found = matches[0]
    original_start = positions[found]
    original_end = positions[found + len(old_chars) - 1] + 1

    return text[:original_start] + new + text[original_end:]


def wrap_div_after_marker(text, marker, condition):
    marker_pos = text.find(marker)
    if marker_pos < 0:
        raise RuntimeError(f"Missing JSX marker: {marker}")

    start = text.find("<div", marker_pos + len(marker))
    if start < 0:
        raise RuntimeError(f"Missing div after marker: {marker}")

    token_re = re.compile(r"</?div\b[^>]*>")
    depth = 0
    end = None

    for match in token_re.finditer(text, start):
        token = match.group(0)

        if token.startswith("</"):
            depth -= 1
        elif not token.rstrip().endswith("/>"):
            depth += 1

        if depth == 0:
            end = match.end()
            break

    if end is None:
        raise RuntimeError(f"Could not match JSX div for: {marker}")

    block = text[start:end]
    wrapped = (
        "{"
        + condition
        + " && (\n"
        + block
        + "\n            )}"
    )

    return text[:start] + wrapped + text[end:]


# --------------------------------------------------
# 1. Rider API
# --------------------------------------------------

s = data["api"]

s = replace_once(
    s,
    'import type {\n    AuthUser,\n    LoginInput,\n} from "@/types/auth";',
    'import type {\n    AuthUser,\n} from "@/types/auth";',
    "Rider API shared import",
)

s = replace_once(
    s,
    "export interface RiderLoginVerificationChallenge {",
    """export interface RiderLoginInput {
    email?: string;
    phone?: string;
    password: string;
}

export interface RiderLoginVerificationChallenge {""",
    "Rider API input type",
)

s = replace_once(
    s,
    "    email: string;\n    phone: string;\n    expiresAt: string;",
    "    email?: string;\n    phone?: string;\n    expiresAt: string;",
    "Rider API optional contacts",
)

s = replace_once(
    s,
    "        input: LoginInput,",
    "        input: RiderLoginInput,",
    "Rider API login input",
)

data["api"] = s


# --------------------------------------------------
# 2. Rider auth action
# --------------------------------------------------

s = data["actions"]

s = replace_once(
    s,
    """export const riderLogin = async (
    input: LoginInput,
): Promise<RiderLoginVerificationChallenge> => {""",
    """export const riderLogin = async (
    input: { email?: string; phone?: string; password: string },
): Promise<RiderLoginVerificationChallenge> => {""",
    "Rider login action input",
)

data["actions"] = s


# --------------------------------------------------
# 3. Rider login form
# --------------------------------------------------

s = data["login"]

s = replace_once(
    s,
    '    const [email, setEmail] = useState("");',
    '    const [identifier, setIdentifier] = useState("");',
    "Rider login state",
)

s = replace_once(
    s,
    """            const challenge = await riderLogin({
                email: email.trim(),
                password,
            });""",
    """            const value = identifier.trim();

            if (!value) {
                throw new Error(
                    "Enter your registered email address or phone number.",
                );
            }

            const loginInput = value.includes("@")
                ? { email: value.toLowerCase(), password }
                : { phone: value, password };

            const challenge = await riderLogin(loginInput);""",
    "Rider login payload",
)

s = replace_once(
    s,
    """                        Sign in with the account provided in your
                        NOPTRIX rider invitation. We will verify
                        your identity using email and phone OTP.""",
    """                        Sign in with the email address or phone number
                        linked to your NOPTRIX rider account. We will send
                        a verification code to your available contact method(s).""",
    "Rider login intro",
)

s = replace_once(
    s,
    '                                htmlFor="rider-email"',
    '                                htmlFor="rider-identifier"',
    "Rider identifier label",
)

s = replace_once(
    s,
    "                                Email address\n",
    "                                Email or phone number\n",
    "Rider identifier label text",
)

s = replace_once(
    s,
    """                                    id="rider-email"
                                    name="email"
                                    type="email"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    spellCheck={false}""",
    """                                    id="rider-identifier"
                                    name="identifier"
                                    type="text"
                                    inputMode="text"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}""",
    "Rider identifier input attributes",
)

s = replace_once(
    s,
    """                                    value={email}
                                    onChange={(event) => {
                                        setEmail(event.target.value);""",
    """                                    value={identifier}
                                    onChange={(event) => {
                                        setIdentifier(event.target.value);""",
    "Rider identifier input state",
)

s = replace_once(
    s,
    '                                    placeholder="rider@example.com"',
    '                                    placeholder="Email address or +9665XXXXXXXX"',
    "Rider identifier placeholder",
)

data["login"] = s


# --------------------------------------------------
# 4. Rider OTP verification form
# --------------------------------------------------

s = data["verify"]

s = replace_once(
    s,
    "    email: string;\n    phone: string;\n    expiresAt: string;",
    "    email?: string;\n    phone?: string;\n    expiresAt: string;",
    "Rider verification optional contacts",
)

s = replace_once(
    s,
    """            typeof parsed.email === "string" &&
            typeof parsed.phone === "string" &&""",
    """            (parsed.email === undefined || typeof parsed.email === "string") &&
            (parsed.phone === undefined || typeof parsed.phone === "string") &&
            Boolean(parsed.email || parsed.phone) &&""",
    "Rider challenge parser",
)

s = replace_once(
    s,
    """                                    Enter the six-digit codesent to both
                                    your registered email and phone.""",
    """                                    Enter the six-digit code sent to your
                                    registered contact method(s).""",
    "Rider verification intro",
)

s = replace_once(
    s,
    "                                    Dual-channel protection",
    "                                    Flexible contact verification",
    "Rider verification heading",
)

s = replace_once(
    s,
    """                                    Your sign-in code is delivered to both
                                    your registered emailand phone.""",
    """                                    Your sign-in code is delivered to the
                                    available contact method(s) on your account.""",
    "Rider verification branding copy",
)

s = replace_once(
    s,
    """                                        Check your email inbox and SMS messages.
                                        Use the same code from either channel.""",
    """                                        Check your registered email or phone.
                                        Use the code delivered to either available channel.""",
    "Rider OTP hint",
)

# Render email and phone cards only when those contacts exist.
s = wrap_div_after_marker(
    s,
    "                            {/* Email */}",
    "challenge.email",
)

s = wrap_div_after_marker(
    s,
    "                            {/* Phone */}",
    "challenge.phone",
)

data["verify"] = s


# --------------------------------------------------
# Write only after every expected replacement passed.
# --------------------------------------------------

for key, path in FILES.items():
    path.write_text(data[key])
    print(f"Updated: {path.relative_to(ROOT)}")

print("\nRider frontend update completed.")
