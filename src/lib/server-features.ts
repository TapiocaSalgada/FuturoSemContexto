import "server-only";

export function isAccountTwoFactorEnabled() {
  return (
    process.env.ENABLE_ACCOUNT_2FA === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_2FA === "true"
  );
}

export function isPasswordResetEnabled() {
  if (process.env.ENABLE_PASSWORD_RESET !== "true") return false;
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}
