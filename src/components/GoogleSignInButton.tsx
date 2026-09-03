"use client";

import { signIn, useSession } from "next-auth/react";

type Variant = "neutral" | "blue";

interface GoogleSignInButtonProps {
  callbackUrl?: string;
  text?: "signin" | "continue";
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#34A853"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#FBBC05"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#EA4335"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  callbackUrl = "/profile",
  text = "continue",
  variant = "neutral",
  fullWidth = false,
  className = "",
}: GoogleSignInButtonProps) {
  const { data: session, status } = useSession();

  const label =
    text === "signin" ? "Iniciar sesión con Google" : "Continuar con Google";

  if (status === "loading") {
    return (
      <div
        className={`flex items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 opacity-60 ${
          fullWidth ? "w-full" : ""
        } ${className}`}
        style={{ minHeight: 40 }}
      >
        <GoogleG className="h-[18px] w-[18px]" />
        {label}
      </div>
    );
  }

  if (session?.user) {
    return null;
  }

  const base =
    "group relative flex items-center justify-center gap-3 rounded-lg font-medium transition-shadow";
  const size = "px-4 py-2.5 text-sm";
  const widthStyle = fullWidth ? "w-full" : "";

  const neutralStyle =
    "border border-[#747775] bg-white text-[#1F1F1F] hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4]/40";

  const blueStyle =
    "bg-[#4285F4] text-white hover:bg-[#3367D6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4]/60";

  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
      aria-label={label}
      className={`${base} ${size} ${widthStyle} ${
        variant === "blue" ? blueStyle : neutralStyle
      } ${className}`}
      style={{
        minHeight: 40,
        fontFamily:
          "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        letterSpacing: 0.25,
      }}
    >
      <GoogleG className="h-[18px] w-[18px] shrink-0" />
      <span>{label}</span>
    </button>
  );
}