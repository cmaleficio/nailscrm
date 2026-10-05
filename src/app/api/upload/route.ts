import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";
import { validateImageUpload } from "@/lib/image-upload";
import {
  isPrivateMediaKind,
  privateMediaUrl,
  PRIVATE_UPLOADS_DIRNAME,
  type PrivateMediaKind,
} from "@/lib/private-media";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  // `kind` decide el destino. Lo que no es media sensible (fotos de servicios,
  // del muro, de citas) sigue yendo a `public/uploads` a propósito: es lo que
  // indexa Google Images y lo que alimenta el muro público sin sesión. Las
  // capturas de pago y las fotos de producto no pueden estar ahí, así que van
  // a `private-uploads/` y se sirven por `/api/media` con sesión.
  const rawKind = formData.get("kind");
  const kind: PrivateMediaKind | null =
    typeof rawKind === "string" && isPrivateMediaKind(rawKind) ? rawKind : null;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // La extensión la decide el servidor a partir de los magic bytes del contenido,
  // nunca a partir del nombre que envió el cliente: los uploads públicos se sirven
  // en el mismo origen que la app, así que un .html o .svg sería XSS con la cookie
  // de sesión.
  const validation = validateImageUpload({ size: file.size }, buffer);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const filename = `${crypto.randomUUID()}.${validation.extension}`;

  if (kind) {
    const privateDir = join(process.cwd(), PRIVATE_UPLOADS_DIRNAME);
    await mkdir(privateDir, { recursive: true });
    await writeFile(join(privateDir, filename), buffer);
    return NextResponse.json({ url: privateMediaUrl(kind, filename) });
  }

  const uploadDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
