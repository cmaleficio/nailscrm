"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-pink-main focus:outline-none";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [login, setLogin] = useState({ email: "", password: "" });
  const [register, setRegister] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    signIn("credentials", {
      email: login.email,
      password: login.password,
      redirect: false,
    })
      .then((res) => {
        if (res?.error) {
          setError("Correo o contraseña incorrectos");
        } else {
          router.push("/profile");
          router.refresh();
        }
      })
      .catch(() => setError("Error al iniciar sesión"))
      .finally(() => setLoading(false));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear la cuenta");
      }
      const signInRes = await signIn("credentials", {
        email: register.email,
        password: register.password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError("Cuenta creada. Inicia sesión con tus datos.");
        setMode("login");
        setLogin({ email: register.email, password: register.password });
      } else {
        router.push("/profile");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const tabCls = (active: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-pink-main text-gray-900" : "text-gray-500 hover:bg-gray-50"
    }`;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {mode === "login"
            ? "Entra con tu correo o con Google"
            : "Regístrate para agendar tus citas"}
        </p>
      </div>

      <div className="mb-6 flex rounded-xl border border-gray-200 bg-white p-1">
        <button type="button" onClick={() => setMode("login")} className={tabCls(mode === "login")}>
          Entrar
        </button>
        <button type="button" onClick={() => setMode("register")} className={tabCls(mode === "register")}>
          Registrarme
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {mode === "login" ? (
        <form onSubmit={handleLogin} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Correo</label>
            <input
              type="email"
              required
              value={login.email}
              onChange={(e) => setLogin({ ...login, email: e.target.value })}
              placeholder="tu@correo.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              required
              value={login.password}
              onChange={(e) => setLogin({ ...login, password: e.target.value })}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-pink-main px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">o</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="pt-1">
            <GoogleSignInButton
              callbackUrl="/profile"
              text="continue"
              variant="neutral"
              fullWidth
            />
          </div>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
            <input
              required
              value={register.name}
              onChange={(e) => setRegister({ ...register, name: e.target.value })}
              placeholder="Tu nombre"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Correo</label>
            <input
              type="email"
              required
              value={register.email}
              onChange={(e) => setRegister({ ...register, email: e.target.value })}
              placeholder="tu@correo.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
            <input
              value={register.phone}
              onChange={(e) => setRegister({ ...register, phone: e.target.value })}
              placeholder="+58 412 123 4567"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Dirección</label>
            <input
              value={register.address}
              onChange={(e) => setRegister({ ...register, address: e.target.value })}
              placeholder="Tu dirección"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={register.password}
              onChange={(e) => setRegister({ ...register, password: e.target.value })}
              placeholder="Mínimo 8 caracteres"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Confirmar contraseña</label>
            <input
              type="password"
              required
              value={register.confirmPassword}
              onChange={(e) => setRegister({ ...register, confirmPassword: e.target.value })}
              placeholder="Repite la contraseña"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-pink-main px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
          <p className="text-center text-xs text-gray-400">
            ¿Ya tienes cuenta?{" "}
            <button type="button" onClick={() => setMode("login")} className="text-pink-600 hover:underline">
              Entra aquí
            </button>
          </p>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-600">← Volver al inicio</Link>
      </p>
    </div>
  );
}