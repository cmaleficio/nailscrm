import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { NextResponse } from "next/server";
import {
  requiresAuth,
  trackingScopeFor,
  TRACKING_SCOPE_HEADER,
} from "@/lib/tracking-scope";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  if (requiresAuth(pathname) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Marca el scope para que el layout raíz sepa si monta las etiquetas. El
  // layout raíz es el único que puede escribir en <head> (los layouts anidados
  // renderizan dentro de <body>), y ahí es donde tiene que ir el `gtag('config')`
  // inline para que Google lo lea igual que el <script async src>.
  const scope = trackingScopeFor(pathname);
  if (!scope) return NextResponse.next();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(TRACKING_SCOPE_HEADER, scope);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  // El guard de auth de /dashboard y /profile es seguridad y se mantiene tal
  // cual. Lo que se amplía es el alcance para poder marcar el scope también en
  // las páginas públicas. Se excluyen api, assets de Next y /uploads porque
  // ahí no hay <head> que renderizar y `auth()` no debe correr en cada archivo.
  // robots.txt y sitemap.xml también quedan fuera: los rastreadores los piden
  // muchísimo (son los dos archivos más golpeados del sitio), no renderizan
  // <head>, y con ellos dentro el proxy corría `auth()` en cada visita.
  //
  // El lookahead tiene que ser un literal: Next parsea `config` en build y
  // `tracking-scope.test.ts` falla si deja de coincidir con la lista de
  // `PROXY_EXCLUDED_SEGMENTS`, que es donde vive la razón de cada segmento.
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/((?!api|_next|uploads|robots.txt|sitemap.xml|favicon.ico).*)",
  ],
};
