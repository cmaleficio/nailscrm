import type { TermsOfServiceValues } from "./termsOfService.types";
import Link from "next/link";

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(d);
}

export function renderTermsOfService(values: TermsOfServiceValues): React.ReactNode {
  const lastUpdated = fmtDate(values.effectiveDate);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 text-gray-800">
      <header className="mb-10 border-b border-gray-200 pb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-pink-600">
          Documento legal
        </p>
        <h1 className="text-3xl font-bold text-gray-900">Condiciones de Servicio</h1>
        <p className="mt-2 text-sm text-gray-500">
          Última actualización: <time dateTime={values.effectiveDate}>{lastUpdated}</time>
        </p>
      </header>

      <section className="space-y-4 text-base leading-relaxed">
        <p>
          Bienvenido/a a <strong>{values.companyName}</strong> (&quot;nosotros&quot;,
          &quot;nuestro&quot; o &quot;nos&quot;). Estas Condiciones de Servicio regulan el
          acceso y uso de nuestra plataforma de reservas y gestión para nail design
          disponible en{" "}
          <a href={values.siteUrl} className="text-pink-600 underline hover:text-pink-700">
            {values.siteUrl}
          </a>{" "}
          (el &quot;Servicio&quot;). Al registrarte, reservar una cita o utilizar el
          Servicio de cualquier forma, aceptas estas Condiciones. Si no estás de acuerdo,
          por favor no utilices el Servicio.
        </p>
        <p>
          Estas Condiciones deben leerse junto con nuestra{" "}
          <Link href="/politicas" className="text-pink-600 underline hover:text-pink-700">
            Política de Privacidad
          </Link>
          .
        </p>
      </section>

      <Section id="servicio" title="1. Descripción del Servicio">
        <p>
          {values.companyName} ofrece una plataforma web que permite a las clientas
          reservar citas de nail design, gestionar su historial, fotos de referencia,
          fotos de resultados y pagos, y al personal del estudio administrar la agenda,
          CRM de clientas, finanzas, inventario y muro de inspiración. El Servicio se
          presta desde {values.country} y se rige por {values.governingLaw}.
        </p>
      </Section>

      <Section id="cuenta" title="2. Registro y cuenta de usuario">
        <List>
          <li>
            Para reservar una cita debes crear una cuenta. Puedes hacerlo con tu correo
            electrónico y una contraseña o mediante Google Sign-In.
          </li>
          <li>
            Eres responsable de mantener la confidencialidad de tu contraseña y de
            todas las actividades que ocurran bajo tu cuenta. Notifícanos inmediatamente
            si detectas un acceso no autorizado.
          </li>
          <li>
            Tras iniciar sesión con Google por primera vez, te solicitaremos tu número
            de teléfono para poder contactarte por WhatsApp sobre tus citas.
          </li>
          <li>
            Podemos suspender o cancelar cuentas que incumplan estas Condiciones o que
            sean señaladas por Google como comprometidas a través del canal RISC
            (Cross-Account Protection).
          </li>
        </List>
      </Section>

      <Section id="reservas" title="3. Reservas, cancelaciones y pagos">
        <List>
          <li>
            Las reservas se confirman en función de la disponibilidad publicada en la
            agenda del estudio.
          </li>
          <li>
            Puedes cancelar una cita desde tu perfil o contactando directamente al
            estudio. La cancelación <strong>elimina</strong> la cita de forma definitiva
            (tras archivar un snapshot interno) y, cuando aplica, también borra el
            evento correspondiente en Google Calendar.
          </li>
          <li>
            Las citas ya completadas no se pueden cancelar, pero puedes solicitar una
            revisión contactando directamente al estudio.
          </li>
          <li>
            Los precios se muestran en USD y, cuando aplica, su equivalente en
            bolívares se calcula con la tasa oficial BCV del día. Aceptamos pagos en
            efectivo, transferencia y, opcionalmente, capturas de transferencia
            reportadas por la clienta y aprobadas por el estudio.
          </li>
          <li>
            Los comprobantes de pago se conservan conforme a las obligaciones fiscales
            aplicables (ver Política de Privacidad, sección &quot;Conservación&quot;).
          </li>
        </List>
      </Section>

      <Section id="google" title="4. Integraciones con Google">
        <p>El Servicio utiliza productos de Google únicamente con los permisos que tú apruebas:</p>
        <List>
          <li>
            <strong>Google Sign-In:</strong> recibimos tu nombre, correo electrónico y
            foto de perfil para crear y autenticar tu cuenta. Scopes:{" "}
            <code>openid</code>, <code>email</code> y <code>profile</code>.
          </li>
          <li>
            <strong>Google Calendar:</strong> si lo autorizas, creamos eventos en tu
            calendario cuando confirmas una cita (escritura únicamente; no leemos ni
            modificamos eventos existentes). Scope:{" "}
            <code>https://www.googleapis.com/auth/calendar.events</code> (considerado
            <em> sensitive</em> por Google).
          </li>
          <li>
            <strong>Eventos RISC (Cross-Account Protection):</strong> Google puede
            notificarnos eventos de seguridad firmados digitalmente sobre tu cuenta
            (por ejemplo, revocación de tokens). Usamos esta información únicamente para
            proteger tu cuenta cerrando sesiones o bloqueando el acceso. Más detalles
            en la sección &quot;Seguridad&quot; de nuestra Política de Privacidad.
          </li>
        </List>
        <p>
          El uso de Google está sujeto a las Condiciones de Servicio de Google y a su
          Política de Privacidad. Puedes revocar el acceso del Servicio en cualquier
          momento desde{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-600 underline hover:text-pink-700"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </Section>

      <Section id="contenido" title="5. Contenido del usuario y muro de inspiración">
        <List>
          <li>
            Puedes subir fotos de referencia para tus citas y, tras la cita, el estudio
            puede publicar fotos del resultado final en el muro de inspiración público.
          </li>
          <li>
            En el muro público sólo se muestra tu <strong>nombre de pila</strong> por
            defecto. Puedes oponerte a la publicación escribiendo al estudio.
          </li>
          <li>
            Declaras que las fotos que subes son de tu propiedad o que cuentas con los
            derechos necesarios para compartirlas, y que no infringen derechos de
            terceros.
          </li>
          <li>
            Nos reservamos el derecho de retirar cualquier contenido que consideremos
            inapropiado o que vulnere derechos de terceros.
          </li>
        </List>
      </Section>

      <Section id="uso-aceptable" title="6. Uso aceptable">
        <p>Te comprometes a no utilizar el Servicio para:</p>
        <List>
          <li>Realizar actividades ilegales, fraudulentas o que dañen al estudio o a terceros.</li>
          <li>Suplantar la identidad de otra persona o entidad.</li>
          <li>Intentar acceder a áreas no públicas del Servicio o a datos de otros usuarios.</li>
          <li>Interferir con la seguridad, el rendimiento o el funcionamiento del Servicio.</li>
          <li>Publicar contenido ofensivo, difamatorio, obsceno o que vulnere derechos de terceros.</li>
        </List>
      </Section>

      <Section id="propiedad" title="7. Propiedad intelectual">
        <p>
          La marca, el diseño, los textos, las fotografías de servicios publicadas por
          el estudio, el software y todos los elementos del Servicio son propiedad de{" "}
          {values.companyName} o de sus licenciantes y están protegidos por las leyes de
          propiedad intelectual aplicables en {values.country}. No puedes copiarlos,
          distribuirlos ni crear obras derivadas sin autorización.
        </p>
      </Section>

      <Section id="limitacion" title="8. Limitación de responsabilidad">
        <p>
          En la máxima medida permitida por la ley aplicable, el Servicio se presta
          &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No garantizamos que el
          Servicio sea ininterrumpido o libre de errores. {values.companyName} no será
          responsable por daños indirectos, incidentales o consecuentes derivados del uso
          o la imposibilidad de usar el Servicio, incluidos los derivados de la
          sincronización con Google Calendar o de eventos de seguridad RISC.
        </p>
      </Section>

      <Section id="suspension" title="9. Suspensión y terminación">
        <p>
          Podemos suspender o cancelar tu acceso al Servicio en caso de incumplimiento
          de estas Condiciones, inactividad prolongada, requerimiento legal o señal de
          compromiso de seguridad por parte de Google. Puedes solicitar la eliminación
          de tu cuenta en cualquier momento contactándonos; los datos fiscales se
          conservarán conforme a la Política de Privacidad.
        </p>
      </Section>

      <Section id="cambios" title="10. Cambios a estas Condiciones">
        <p>
          Podemos modificarlas para reflejar cambios legales, técnicos o de
          funcionamiento. Publicaremos la versión actualizada en esta misma URL junto
          con la fecha de &quot;Última actualización&quot;. Si los cambios son
          significativos, te avisaremos por correo electrónico o mediante un aviso
          visible dentro del Servicio antes de que entren en vigencia. El uso continuo
          del Servicio después de la entrada en vigencia de los cambios implica tu
          aceptación.
        </p>
      </Section>

      <Section id="ley" title="11. Ley aplicable y jurisdicción">
        <p>
          Estas Condiciones se rigen por {values.governingLaw}, sin tener en cuenta sus
          normas sobre conflicto de leyes. Para cualquier controversia derivada del
          Servicio, las partes se someten a los tribunales competentes de{" "}
          {values.country}.
        </p>
      </Section>

      <Section id="contacto" title="12. Contáctenos">
        <p>
          Si tienes preguntas sobre estas Condiciones, puedes escribirnos por
          cualquiera de estos medios:
        </p>
        <List>
          <li>
            <strong>Correo electrónico:</strong>{" "}
            <a
              href={`mailto:${values.contactEmail}`}
              className="text-pink-600 underline hover:text-pink-700"
            >
              {values.contactEmail}
            </a>
          </li>
          {values.contactPhone && (
            <li>
              <strong>Teléfono:</strong> {values.contactPhone}
            </li>
          )}
          {values.contactUrl && (
            <li>
              <strong>Web:</strong>{" "}
              <a
                href={values.contactUrl}
                className="text-pink-600 underline hover:text-pink-700"
              >
                {values.contactUrl}
              </a>
            </li>
          )}
          <li>
            <strong>Dirección:</strong> {values.contactAddress}
          </li>
        </List>
      </Section>

      <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500">
        <p>
          Última actualización: {lastUpdated} ·{" "}
          <Link href="/" className="text-pink-600 underline hover:text-pink-700">
            Volver al inicio
          </Link>
          {" · "}
          <Link href="/politicas" className="text-pink-600 underline hover:text-pink-700">
            Política de Privacidad
          </Link>
        </p>
      </footer>
    </article>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10">
      <h2 className="mb-3 text-xl font-semibold text-gray-900">{title}</h2>
      <div className="space-y-4 text-base leading-relaxed">{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-6 marker:text-pink-400">{children}</ul>
  );
}