import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { ServiceCard } from "@/components/ServiceCard";
import { GalleryGrid } from "@/components/GalleryGrid";
import { getSalonName, getSalonLogo } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const services = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.isActive, 1))
    .all();

  const allPhotos = db.select().from(schema.servicePhotos).all();
  const byService = new Map<string, { id: string; url: string }[]>();
  for (const p of allPhotos) {
    const list = byService.get(p.serviceId) ?? [];
    list.push({ id: p.id, url: p.url });
    byService.set(p.serviceId, list);
  }

  const salonName = getSalonName();
  const salonLogo = getSalonLogo();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <section className="mb-16">
        <div className="mb-8 text-center">
          {salonLogo && (
            <div className="mx-auto mb-4 relative h-24 w-24 overflow-hidden rounded-2xl">
              <img
                src={salonLogo}
                alt={salonName}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900">
            {salonName}
          </h1>
          <p className="mt-3 text-base font-medium text-pink-600">
            Plataforma de reservas y gestión para nail design
          </p>
          <p className="mt-3 max-w-2xl mx-auto text-gray-600">
            Agenda tu cita en línea, descubre nuestro catálogo de servicios y
            inspírate con diseños reales en nuestro muro. Desde tu perfil puedes
            ver tu historial, fotos de referencia, pagos y mucho más — todo en un
            solo lugar.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.id} {...s} photos={byService.get(s.id) ?? []} />
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-3 text-2xl font-semibold text-gray-900">
          Acerca de {salonName}
        </h2>
        <p className="mb-4 max-w-3xl text-gray-600">
          <strong>{salonName}</strong> es un estudio de nail design especializado en
          acrílico, gel semipermanente, nail art y cursos de formación. Esta plataforma
          web es nuestra herramienta oficial para gestionar reservas, comunicación con
          clientas, seguimiento de cada servicio y la operación interna del estudio.
          Funciona como un sistema integral (SaaS) que combina agenda, CRM, finanzas e
          inventario en un único lugar.
        </p>
        <p className="mb-4 max-w-3xl text-gray-600">
          Nuestra misión es ofrecer a cada clienta una atención personalizada: las
          clientas pueden reservar en línea, consultar su historial completo de visitas,
          adjuntar fotos de referencia, ver fotos del resultado final, controlar su
          estado de cuenta y reportar pagos. Por su parte, el personal del estudio
          utiliza la misma plataforma para administrar la agenda diaria y semanal,
          mantener un CRM con notas técnicas por clienta, registrar pagos y facturas,
          gestionar inventario con kardex, y operar el muro de inspiración que conecta
          diseños reales con nuevas reservas.
        </p>
        <p className="max-w-3xl text-gray-600">
          La plataforma se ofrece bajo un modelo de software como servicio (SaaS): el
          estudio es propietario absoluto de sus datos (a diferencia de marketplaces
          como Fresha o Booksy) e integra servicios de terceros cuidadosamente
          seleccionados para mejorar la experiencia de las clientas, como Google
          Sign-In para autenticación y Google Calendar para sincronizar las citas con
          el calendario personal de cada clienta que lo autorice.
        </p>
      </section>

      <section className="mb-16">
        <h2 className="mb-3 text-2xl font-semibold text-gray-900">
          ¿Qué hace exactamente esta app y para quién es?
        </h2>
        <p className="mb-4 max-w-3xl text-gray-600">
          Esta aplicación tiene como propósito principal permitir a las clientas del
          estudio reservar y gestionar citas de nail design (manicura, pedicura, acrílico,
          gel, nail art y cursos), y al equipo del estudio administrar de forma integral
          la operación del salón. La app está dirigida a dos tipos de usuarios:
        </p>
        <ul className="mb-4 max-w-3xl list-disc space-y-2 pl-6 text-gray-600 marker:text-pink-400">
          <li>
            <strong>Clientas:</strong> personas que desean reservar, reagendar o cancelar
            citas, consultar su historial, subir fotos de referencia, ver fotos del
            resultado final, llevar el control de sus pagos y recibir soporte directo
            por WhatsApp.
          </li>
          <li>
            <strong>Personal del estudio:</strong> la manicurista, asistentes y
            administradores que gestionan la agenda, el CRM de clientas, las finanzas
            (cuentas por cobrar, pagos, facturas, cuentas por pagar), el inventario y
            el muro de inspiración.
          </li>
        </ul>
        <p className="max-w-3xl text-gray-600">
          La app <strong>no</strong> vende productos, no muestra publicidad de terceros
          ni transfiere datos personales a redes publicitarias o brokers de datos.
          Tampoco utiliza los datos de las cuentas Google para ningún fin distinto al
          aquí descrito.
        </p>
      </section>

      <section className="mb-16 rounded-2xl border border-pink-100 bg-pink-50/60 p-6">
        <h2 className="mb-3 text-2xl font-semibold text-gray-900">
          Permisos de Google que utilizamos y por qué
        </h2>
        <p className="mb-4 max-w-3xl text-gray-700">
          Para prestar el Servicio integramos dos productos de Google. Sólo solicitamos
          los permisos mínimos necesarios y siempre con tu consentimiento explícito en
          la pantalla oficial de consentimiento de Google:
        </p>
        <ul className="mb-4 max-w-3xl list-disc space-y-2 pl-6 text-gray-700 marker:text-pink-400">
          <li>
            <strong>Google Sign-In (scopes <code>openid</code>, <code>email</code> y{" "}
            <code>profile</code>):</strong> permite crear tu cuenta de clienta usando tu
            identidad de Google sin que tengas que recordar una contraseña adicional.
            Recibimos únicamente tu nombre, foto de perfil y dirección de correo para
            identificarte. Este permiso <strong>no</strong> es de tipo
            <em> sensitive</em> ni <em>restricted</em>.
          </li>
          <li>
            <strong>Google Calendar (scope{" "}
            <code>https://www.googleapis.com/auth/calendar.events</code>, considerado
            <em> sensitive</em>):</strong> únicamente si lo autorizas desde tu perfil,
            creamos eventos en tu calendario personal cuando confirmas una cita. Sólo
            escribimos eventos nuevos a tu nombre; nunca leemos, modificamos ni
            eliminamos eventos existentes de tu calendario. Puedes revocar este permiso
            en cualquier momento desde{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-600 underline hover:text-pink-700"
            >
              myaccount.google.com/permissions
            </a>
            .
          </li>
        </ul>
        <p className="max-w-3xl text-gray-700">
          Los datos recibidos desde Google se utilizan exclusivamente para las
          funcionalidades descritas en esta página y en nuestra{" "}
          <a
            href="https://studiodreamnails.com/politicas"
            className="text-pink-600 underline hover:text-pink-700"
          >
            Política de Privacidad
          </a>
          . El detalle completo de qué datos recopilamos, cómo los almacenamos, durante
          cuánto tiempo los conservamos y cuáles son tus derechos como titular se
          explica de forma transparente en dicho documento.
        </p>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold text-gray-900">
          Cómo funciona
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-pink-100 bg-pink-50 p-5">
            <div className="mb-2 text-2xl font-bold text-pink-500">1</div>
            <h3 className="mb-1 font-semibold text-gray-900">
              Inspírate
            </h3>
            <p className="text-sm text-gray-600">
              Explora el muro con diseños reales y el catálogo de servicios
              para elegir tu próximo look.
            </p>
          </div>
          <div className="rounded-xl border border-pink-100 bg-pink-50 p-5">
            <div className="mb-2 text-2xl font-bold text-pink-500">2</div>
            <h3 className="mb-1 font-semibold text-gray-900">
              Reserva en línea
            </h3>
            <p className="text-sm text-gray-600">
              Crea tu cuenta, elige servicio, día y hora disponible. Recibirás
              la confirmación al instante.
            </p>
          </div>
          <div className="rounded-xl border border-pink-100 bg-pink-50 p-5">
            <div className="mb-2 text-2xl font-bold text-pink-500">3</div>
            <h3 className="mb-1 font-semibold text-gray-900">
              Disfruta tu visita
            </h3>
            <p className="text-sm text-gray-600">
              Acude a tu cita y sigue tu historial, fotos y pagos desde tu
              perfil. Te avisamos por WhatsApp.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-3 text-2xl font-semibold text-gray-900">
          Qué información recopilamos y cómo la usamos
        </h2>
        <p className="mb-4 max-w-3xl text-gray-600">
          Para prestar el Servicio tratamos las siguientes categorías de datos: datos
          de cuenta (nombre, correo electrónico, teléfono, dirección, contraseña
          cifrada), datos de autenticación con Google cuando eliges esa opción, datos
          de la cita (servicio reservado, fecha, hora, fotos de referencia y fotos del
          resultado final, reseñas opcionales), datos financieros (pagos registrados,
          comprobantes de transferencia y saldos) y datos técnicos (dirección IP,
          navegador, sistema operativo) para seguridad y prevención de fraude.
        </p>
        <p className="mb-4 max-w-3xl text-gray-600">
          Estos datos se utilizan <strong>únicamente</strong> para gestionar tus citas,
          mantener tu historial, mostrarte el equivalente en bolívares de los precios
          usando la tasa oficial del BCV, proteger tu cuenta y cumplir nuestras
          obligaciones fiscales. No vendemos tus datos ni los compartimos con
          anunciantes o terceros con fines comerciales.
        </p>
        <p className="max-w-3xl text-gray-600">
          Los plazos concretos de conservación, las bases legales del tratamiento, los
          proveedores con los que trabajamos (Google, WhatsApp, BCV, Cloudflare) y tus
          derechos como titular (acceso, rectificación, cancelación, oposición,
          portabilidad y revocación del consentimiento) están detallados en nuestra{" "}
          <a
            href="https://studiodreamnails.com/politicas"
            className="text-pink-600 underline hover:text-pink-700"
          >
            Política de Privacidad
          </a>
          .
        </p>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold text-gray-900">
          Muro de Inspiración
        </h2>
        <GalleryGrid />
      </section>

      <footer className="mt-16 border-t border-gray-200 pt-8 text-center text-sm text-gray-500 space-y-2">
        <p>
          <a href="https://studiodreamnails.com/politicas" className="hover:text-pink-500 transition-colors">Política de Privacidad</a>
          {" · "}
          <a href="https://studiodreamnails.com/condiciones" className="hover:text-pink-500 transition-colors">Condiciones de Servicio</a>
        </p>
        <p>&copy; {new Date().getFullYear()} {salonName}. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}