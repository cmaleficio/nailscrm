import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { desc, eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "gallery"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rows = db
    .select({
      id: schema.galleryPhotos.id,
      url: schema.galleryPhotos.url,
      serviceId: schema.galleryPhotos.serviceId,
      serviceName: schema.services.name,
      caption: schema.galleryPhotos.caption,
      createdAt: schema.galleryPhotos.createdAt,
    })
    .from(schema.galleryPhotos)
    .leftJoin(schema.services, eq(schema.galleryPhotos.serviceId, schema.services.id))
    .orderBy(desc(schema.galleryPhotos.createdAt))
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "gallery"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const serviceIdRaw = formData.get("serviceId");
  const captionRaw = formData.get("caption");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "El archivo es requerido" }, { status: 400 });
  }

  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Tipo de archivo no válido (usar JPEG, PNG o WebP)" },
      { status: 400 }
    );
  }

  let serviceId: string | null = null;
  if (typeof serviceIdRaw === "string" && serviceIdRaw.trim()) {
    const svc = db
      .select({ id: schema.services.id })
      .from(schema.services)
      .where(eq(schema.services.id, serviceIdRaw.trim()))
      .get();
    if (!svc) {
      return NextResponse.json({ error: "El servicio no existe" }, { status: 400 });
    }
    serviceId = svc.id;
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const uploadDir = join(process.cwd(), "public", "uploads", "gallery");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), buffer);

  const row = {
    id: crypto.randomUUID(),
    url: `/uploads/gallery/${filename}`,
    serviceId,
    caption:
      typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim() : null,
    position: 0,
    createdBy: session?.user?.id ?? null,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.galleryPhotos).values(row).run();

  return NextResponse.json(row, { status: 201 });
}
