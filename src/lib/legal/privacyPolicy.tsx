import type { PrivacyPolicyValues } from "./privacyPolicy.types";
import Link from "next/link";

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(d);
}

export function renderPrivacyPolicy(values: PrivacyPolicyValues): React.ReactNode {
  const lastUpdated = fmtDate(values.effectiveDate);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 text-gray-800">
      <header className="mb-10 border-b border-gray-200 pb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-pink-600">
          Documento legal
        </p>
        <h1 className="text-3xl font-bold text-gray-900">Política de Privacidad</h1>
        <p className="mt-2 text-sm text-gray-500">
          Última actualización: <time dateTime={values.effectiveDate}>{lastUpdated}</time>
        </p>
      </header>

      <section className="space-y-4 text-base leading-relaxed">
        <p>
          <strong>{values.companyName}</strong> (&quot;nosotros&quot;, &quot;nuestro&quot; o &quot;nos&quot;)
          respeta tu privacidad y se compromete a proteger tu información personal. Esta
          Política de Privacidad explica qué datos recopilamos, cómo los usamos, con quién
          los compartimos y qué derechos tienes sobre ellos cuando utilizas nuestra
          plataforma de reservas y gestión para nail design disponible en{" "}
          <a href={values.siteUrl} className="text-pink-600 underline hover:text-pink-700">
            {values.siteUrl}
          </a>{" "}
          (el &quot;Servicio&quot;).
        </p>
        <p>
          Al acceder o utilizar el Servicio, aceptas las prácticas descritas en esta
          política y en nuestras Condiciones de Servicio. Si no estás de acuerdo, por
          favor no utilices el Servicio.
        </p>
      </section>

      <Section id="definiciones" title="1. Definiciones clave">
        <p>Para que esta política sea clara, definimos los siguientes términos:</p>
        <List>
          <li>
            <strong>Compañía:</strong> {values.companyName}, responsable del tratamiento
            de tus datos personales bajo esta política.
          </li>
          <li>
            <strong>Servicio:</strong> la plataforma web de reservas y gestión accesible en{" "}
            <a href={values.siteUrl} className="text-pink-600 underline hover:text-pink-700">
              {values.siteUrl}
            </a>{" "}
            y sus subdominios.
          </li>
          <li>
            <strong>País:</strong> {values.country}, jurisdicción donde se encuentra
            establecida la Compañía.
          </li>
          <li>
            <strong>Datos personales:</strong> cualquier información que permita
            identificarte directa o indirectamente (nombre, correo electrónico, teléfono,
            dirección IP, etc.).
          </li>
          <li>
            <strong>Usuario:</strong> cualquier persona registrada o invitada que utiliza
            el Servicio, incluyendo clientas y personal del estudio.
          </li>
          <li>
            <strong>Cookies:</strong> pequeños archivos que tu dispositivo almacena al
            visitar el Servicio, utilizados para autenticación y preferencias.
          </li>
          <li>
            <strong>Sitio web:</strong>{" "}
            <a href={values.siteUrl} className="text-pink-600 underline hover:text-pink-700">
              {values.siteUrl}
            </a>
            .
          </li>
        </List>
      </Section>

      <Section id="datos-google" title="2. Datos que obtenemos a través de Google">
        <p>
          Cuando eliges iniciar sesión con tu cuenta de Google o conectar Google Calendar,
          Google nos comparte información según los permisos (scopes) que tú apruebas en
          la pantalla de consentimiento. Sólo solicitamos los permisos mínimos necesarios
          para prestar el Servicio:
        </p>
        <List>
          <li>
            <strong>Google Sign-In (scopes <code>openid</code>, <code>email</code> y{" "}
            <code>profile</code>):</strong> recibimos tu nombre, dirección de correo
            electrónico, foto de perfil y un identificador único de Google para crear y
            autenticar tu cuenta en la plataforma.
          </li>
          <li>
            <strong>Google Calendar (scope{" "}
            <code>https://www.googleapis.com/auth/calendar.events</code>, considerado
            <em> sensitive</em> por Google):</strong> si lo autorizas explícitamente desde
            tu perfil, creamos eventos en tu calendario personal cuando confirmas una cita.
            Sólo escribimos eventos nuevos a tu nombre (push); en ningún caso leemos,
            modificamos ni eliminamos eventos existentes de tu calendario.
          </li>
          <li>
            <strong>Eventos de seguridad (RISC / Cross-Account Protection):</strong>{" "}
            recibimos notificaciones cifradas y firmadas por Google si Google detecta
            actividad sospechosa en tu cuenta (por ejemplo, robo de sesión). Las usamos
            exclusivamente para proteger tu cuenta cerrando sesiones o bloqueando el
            acceso cuando es necesario. Estos eventos no contienen el contenido de tus
            correos, archivos ni datos personales distintos del identificador de tu cuenta
            Google.
          </li>
        </List>
        <p>
          Google actúa como encargado independiente del tratamiento conforme a sus
          propias condiciones y política de privacidad, disponibles en{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-600 underline hover:text-pink-700"
          >
            policies.google.com/privacy
          </a>
          .
        </p>
      </Section>

      <Section id="datos-otros" title="3. Otros datos que recopilamos">
        <p>Además de los datos de Google, recopilamos la siguiente información. Cada categoría incluye su <strong>finalidad</strong>, la <strong>base legal</strong> y si es obligatoria o opcional:</p>

        <h3 className="mt-6 text-lg font-semibold text-gray-900">
          3.1. Datos de cuenta y autenticación
        </h3>
        <List>
          <li>
            <strong>Nombre completo:</strong> necesario para identificar a cada clienta
            en la agenda, los comprobantes de pago y las notificaciones. Finalidad:
            gestión de la cuenta y comunicación sobre citas. Base legal: ejecución del
            contrato.
          </li>
          <li>
            <strong>Correo electrónico:</strong> necesario para iniciar sesión, enviar
            confirmaciones y avisos de seguridad, y recuperar el acceso a la cuenta.
            Finalidad: autenticación y notificaciones transaccionales. Base legal:
            ejecución del contrato.
          </li>
          <li>
            <strong>Teléfono (WhatsApp):</strong> opcional. Se utiliza únicamente cuando
            la clienta inicia una conversación haciendo clic en el botón
            correspondiente. No se utiliza para enviar SMS ni llamadas automáticas.
            Finalidad: soporte directo. Base legal: consentimiento.
          </li>
          <li>
            <strong>Dirección:</strong> opcional. Se utiliza para envíos o para que el
            equipo del estudio ubique a la clienta. Finalidad: logística. Base legal:
            ejecución del contrato.
          </li>
          <li>
            <strong>Contraseña cifrada:</strong> sólo se almacena cuando la clienta
            elige registrarse con correo y contraseña. Se cifra con algoritmos de hash
            seguros (bcrypt) y nunca se guarda en texto plano. Finalidad: autenticación.
            Base legal: ejecución del contrato.
          </li>
        </List>

        <h3 className="mt-6 text-lg font-semibold text-gray-900">
          3.2. Datos de la cita
        </h3>
        <List>
          <li>
            <strong>Servicio reservado, fecha y hora:</strong> imprescindibles para
            gestionar la agenda. Finalidad: prestación del servicio. Base legal:
            ejecución del contrato.
          </li>
          <li>
            <strong>Fotos de referencia subidas por la clienta:</strong> opcionales.
            Sólo la clienta y el equipo del estudio pueden verlas. Finalidad: entender
            el diseño deseado. Base legal: ejecución del contrato / consentimiento.
          </li>
          <li>
            <strong>Fotos del resultado final:</strong> subidas por el estudio al
            completar la cita. Por defecto sólo se muestran en el muro de inspiración
            público con el <strong>nombre de pila</strong> de la clienta. La clienta
            puede oponerse a la publicación contactando al estudio. Finalidad:
            portafolio del estudio y muro de inspiración. Base legal: consentimiento.
          </li>
          <li>
            <strong>Reseñas y calificaciones:</strong> opcionales. Se publican de forma
            agregada (puntuación media) en la ficha del servicio. Finalidad: mejora del
            servicio y transparencia para nuevas clientas. Base legal: consentimiento.
          </li>
          <li>
            <strong>Lista de espera:</strong> si la clienta se une a la lista de espera
            para una fecha sin disponibilidad, guardamos la fecha preferida y el
            nombre del cliente. Se elimina automáticamente cuando la fecha pasa o la
            clienta es notificada. Finalidad: gestionar cupos liberados. Base legal:
            ejecución del contrato.
          </li>
        </List>

        <h3 className="mt-6 text-lg font-semibold text-gray-900">
          3.3. Datos financieros y fiscales
        </h3>
        <List>
          <li>
            <strong>Pagos registrados:</strong> monto, fecha, moneda (USD o VES),
            referencia y, cuando aplica, captura de la transferencia. Finalidad:
            gestión de cuentas por cobrar y cumplimiento fiscal. Base legal: ejecución
            del contrato + obligación legal (legislación fiscal venezolana y SENIAT).
          </li>
          <li>
            <strong>Tasa de cambio BCV consultada:</strong> sólo almacenamos la tasa
            del día para calcular el equivalente en bolívares de cada pago. No se
            envía información personal al BCV.
          </li>
          <li>
            <strong>Capturas de pago reportadas por la clienta:</strong> la clienta
            puede subir una captura al reportar un pago en bolívares. El equipo del
            estudio la revisa y aprueba o rechaza. La captura se asocia al pago
            correspondiente una vez aprobada. Finalidad: soporte al proceso de pago.
            Base legal: ejecución del contrato.
          </li>
        </List>

        <h3 className="mt-6 text-lg font-semibold text-gray-900">
          3.4. Datos técnicos y de seguridad
        </h3>
        <List>
          <li>
            <strong>Dirección IP, navegador, sistema operativo, idioma, URL de
            referencia:</strong> se registran automáticamente para mantener la
            seguridad del Servicio, prevenir fraude y diagnosticar incidencias.
            Finalidad: seguridad y operación. Base legal: interés legítimo.
          </li>
          <li>
            <strong>Sellos de tiempo y registros de eventos:</strong> quién hizo qué y
            cuándo dentro del Servicio (por ejemplo, inicio de sesión, creación de
            cita, registro de pago). Finalidad: auditoría, seguridad y cumplimiento.
            Base legal: interés legítimo + obligación legal.
          </li>
          <li>
            <strong>Eventos RISC de Google:</strong> descritos en la sección 2.
            Finalidad: protección de la cuenta ante compromiso de seguridad. Base
            legal: interés legítimo + consentimiento al usar Google Sign-In.
          </li>
        </List>

        <h3 className="mt-6 text-lg font-semibold text-gray-900">
          3.5. Datos que NO recopilamos
        </h3>
        <p>
          No recopilamos ni tratamos categorías especiales de datos (origen racial,
          opiniones políticas, convicciones religiosas, datos genéticos, datos
          biométricos, datos de salud, orientación sexual, antecedentes penales).
          Tampoco solicitamos permisos de dispositivo como GPS, micrófono, contactos,
          cámara más allá de la galería de fotos, ni sensores del dispositivo. No
          usamos cookies de publicidad ni de seguimiento entre sitios.
        </p>
      </Section>

      <Section id="uso" title="4. Cómo usamos tu información">
        <p>Tratamos tus datos personales únicamente para los fines que se describen a continuación:</p>
        <List>
          <li>Crear y mantener tu cuenta de cliente y/o administrador.</li>
          <li>Gestionar reservas, pagos, fotos, reseñas y la lista de espera.</li>
          <li>Sincronizar tus citas con Google Calendar cuando lo autorizas.</li>
          <li>Proteger tu cuenta y responder a eventos de seguridad de Google (RISC).</li>
          <li>Cumplir con obligaciones legales, contables y fiscales en {values.country}.</li>
          <li>Atender tus solicitudes de soporte a través de los canales habilitados.</li>
          <li>
            Mostrarte el muro de inspiración usando únicamente tu nombre de pila cuando
            publicas fotos finales (privacidad por defecto).
          </li>
        </List>
        <p>
          <strong>No vendemos</strong> tus datos personales ni los transferimos a
          anunciantes, brokers de datos ni terceros con fines comerciales.
        </p>
      </Section>

      <Section id="base-legal" title="5. Base legal del tratamiento">
        <p>Tratamos tus datos personales sobre las siguientes bases legales:</p>
        <List>
          <li>
            <strong>Ejecución del contrato</strong> que celebras con nosotros al
            registrarte y utilizar el Servicio de reservas.
          </li>
          <li>
            <strong>Consentimiento expreso</strong> que otorgas al iniciar sesión con
            Google, conectar Google Calendar o subir fotos.
          </li>
          <li>
            <strong>Cumplimiento de obligaciones legales</strong>, incluidas las fiscales,
            contables y de conservación documental aplicables en {values.country}.
          </li>
          <li>
            <strong>Interés legítimo</strong> en mantener la seguridad, prevenir fraude y
            mejorar el Servicio, siempre respetando tus derechos.
          </li>
        </List>
      </Section>

      <Section id="uso-limitado-google" title="6. Cumplimiento de los requisitos de uso limitado de Google">
        <p>
          Cuando utilizas Google Sign-In o Google Calendar a través de nuestro
          Servicio, los datos recibidos desde Google están sujetos a los{" "}
          <em>Limited Use Requirements</em> de Google API Services User Data Policy.
          Esto significa, en concreto, que:
        </p>
        <List>
          <li>
            Sólo usamos los datos de Google para <strong>prestar las funcionalidades
            visibles y destacadas</strong> del Servicio descritas en esta política
            (crear tu cuenta, autenticarte, sincronizar tus citas con Calendar cuando
            lo autorizas, proteger tu cuenta ante eventos de seguridad RISC).
          </li>
          <li>
            <strong>No transferimos</strong> los datos recibidos desde Google a
            terceros, excepto cuando sea necesario para prestar el propio Servicio
            (por ejemplo, el proveedor de hosting que almacena la base de datos) o
            cuando lo exija la ley.
          </li>
          <li>
            <strong>No usamos</strong> los datos de Google para servir publicidad,
            incluirte en audiencias publicitarias, hacer retargeting, vender la
            información o determinar tu solvencia crediticia.
          </li>
          <li>
            <strong>No permitimos que humanos lean</strong> los datos de Google,
            salvo que tú lo autorices explícitamente (por ejemplo, al solicitar
            soporte y compartir capturas o detalles) o que sea estrictamente necesario
            para investigar un incidente de seguridad.
          </li>
          <li>
            El acceso a los datos de Google por parte de nuestro personal está
            limitado a los roles que lo necesitan para operar el Servicio y está
            auditado.
          </li>
        </List>
      </Section>

      <Section id="proveedores" title="7. Proveedores de servicios e integraciones">
        <p>
          Para operar el Servicio compartimos información estrictamente necesaria con los
          siguientes proveedores:
        </p>
        <List>
          <li>
            <strong>Google LLC (Sign-In, Calendar, RISC):</strong> actúa como encargado
            del tratamiento con los scopes autorizados por ti. Política:{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-600 underline hover:text-pink-700"
            >
              policies.google.com/privacy
            </a>
            .
          </li>
          <li>
            <strong>WhatsApp (Meta Platforms, Inc.):</strong> usamos únicamente enlaces
            profundos <code>wa.me</code> que se abren al hacer clic. No usamos la API
            oficial ni enviamos mensajes automáticos.
          </li>
          <li>
            <strong>Banco Central de Venezuela (BCV):</strong> consultamos públicamente
            la tasa oficial del día en{" "}
            <a
              href="https://www.bcv.org.ve"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-600 underline hover:text-pink-700"
            >
              bcv.org.ve
            </a>{" "}
            para mostrarte precios y pagos en bolívares. No se envía información
            personal.
          </li>
          <li>
            <strong>Cloudflare, Inc. (red y proxy):</strong> expone públicamente el
            Servicio. Puede procesar direcciones IP y cabeceras para seguridad y
            distribución de contenido.
          </li>
          <li>
            <strong>Proveedor de hosting:</strong> aloja la aplicación y la base de
            datos SQLite cifrada en disco.
          </li>
        </List>
      </Section>

      <Section id="transferencias" title="8. Transferencias internacionales">
        <p>
          Algunos proveedores (notablemente Google LLC) almacenan datos en centros de
          datos ubicados fuera de {values.country}, principalmente en Estados Unidos.
          Estas transferencias son necesarias para la ejecución del Servicio que
          contratas. Nos aseguramos de que los proveedores ofrezcan garantías adecuadas
          conforme a estándares internacionalmente reconocidos.
        </p>
      </Section>

      <Section id="conservacion" title="9. ¿Cuánto tiempo conservamos tus datos?">
        <List>
          <li>
            <strong>Datos contables y fiscales</strong> (pagos, facturas, cuentas por
            cobrar, kardex de inventario y comprobantes de transferencia):{" "}
            <strong>5 años</strong> desde la fecha del pago o movimiento, conforme a las
            obligaciones de conservación documental del SENIAT y la legislación fiscal
            venezolana.
          </li>
          <li>
            <strong>Historial de citas, fotos de referencia, fotos finales y
            reseñas:</strong> <strong>3 años</strong> desde la fecha de la última
            visita. Pasado ese plazo se eliminan o se anonimizan.
          </li>
          <li>
            <strong>Datos de cuenta</strong> (nombre, email, teléfono, contraseña
            cifrada, sesión iniciada con Google): mientras tu cuenta esté activa. Tras
            solicitar la eliminación, mantenemos un registro mínimo de la baja durante
            <strong> 12 meses</strong> para impedir reingresos no autorizados y atender
            eventuales requerimientos legales.
          </li>
          <li>
            <strong>Datos fiscales/contables</strong> prevalecen sobre las reglas
            anteriores: si tienes pagos dentro del período de 5 años, conservamos los
            datos asociados hasta cumplirse dicho plazo.
          </li>
        </List>
      </Section>

      <Section id="seguridad" title="10. Cómo protegemos tu información">
        <p>
          Implementamos medidas técnicas y organizativas razonables para proteger tus
          datos: HTTPS/TLS en tránsito, contraseñas cifradas con algoritmos de hash
          seguros (bcrypt), control de acceso por roles, copias de seguridad cifradas y
          autenticación multifactor disponible para administradores. Aun así, ningún
          sistema es infalible; si detectas alguna actividad sospechosa, por favor
          contáctanos de inmediato.
        </p>
      </Section>

      <Section id="derechos" title="11. Tus derechos (ARCO y protección de datos)">
        <p>
          Como titular de tus datos personales, tienes los siguientes derechos conforme a
          la legislación aplicable:
        </p>
        <List>
          <li>
            <strong>Acceso:</strong> conocer qué datos tenemos sobre ti y cómo los
            tratamos.
          </li>
          <li>
            <strong>Rectificación:</strong> corregir datos inexactos o incompletos.
          </li>
          <li>
            <strong>Cancelación (eliminación):</strong> solicitar la eliminación de tu
            cuenta. Los datos fiscales descritos arriba se conservarán durante el plazo
            legal aplicable.
          </li>
          <li>
            <strong>Oposición:</strong> oponerte a tratamientos específicos, por ejemplo
            a la publicación de tus fotos finales en el muro de inspiración.
          </li>
          <li>
            <strong>Portabilidad:</strong> solicitar una copia de tus datos en un
            formato estructurado y de uso común.
          </li>
          <li>
            <strong>Revocación del consentimiento:</strong> retirar el consentimiento
            otorgado a Google Sign-In o Google Calendar en cualquier momento.
          </li>
        </List>
        <p>
          Para ejercerlos, escríbenos a la dirección indicada en la sección
          &quot;Contáctenos&quot;. Responderemos en un plazo máximo de <strong>20 días
          hábiles</strong>. Si consideras que tus derechos no han sido atendidos, puedes
          acudir a la autoridad de protección de datos competente.
        </p>
      </Section>

      <Section id="google-revocacion" title="12. Cómo revocar los permisos de Google">
        <p>
          Puedes revocar en cualquier momento el acceso del Servicio a tu cuenta de
          Google desde{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-600 underline hover:text-pink-700"
          >
            myaccount.google.com/permissions
          </a>
          . Tras la revocación, dejaremos de recibir nuevos datos de Google y borraremos
          los tokens asociados a tu cuenta. Los datos ya recibidos se conservarán según
          los plazos indicados en la sección 8.
        </p>
      </Section>

      <Section id="menores" title="13. Privacidad de menores">
        <p>
          El Servicio no está dirigido a menores de 13 años. No recopilamos
          intencionalmente datos personales de menores. Si eres padre, madre o
          representante legal y crees que un menor nos ha proporcionado datos, por
          favor contáctanos para eliminarlos.
        </p>
      </Section>

      <Section id="cookies" title="14. Cookies y tecnologías similares">
        <p>
          Utilizamos cookies estrictamente necesarias para autenticación (sesión) y
          preferencias (idioma). No usamos cookies de publicidad ni de seguimiento de
          terceros. Puedes bloquear o eliminar las cookies desde la configuración de tu
          navegador, pero algunas funcionalidades del Servicio pueden dejar de estar
          disponibles.
        </p>
      </Section>

      <Section id="cambios" title="15. Cambios a esta Política de Privacidad">
        <p>
          Podemos modificar esta política para reflejar cambios legales, técnicos o de
          funcionamiento. Publicaremos la versión actualizada en esta misma URL junto
          con la fecha de última actualización. Si los cambios son significativos, te
          avisaremos por correo electrónico o mediante un aviso visible dentro del
          Servicio antes de que entren en vigencia.
        </p>
      </Section>

      <Section id="contacto" title="16. Contáctenos">
        <p>
          Si tienes preguntas, quejas o quieres ejercer tus derechos, puedes
          contactarnos por cualquiera de estos medios:
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
          <Link
            href="/condiciones"
            className="text-pink-600 underline hover:text-pink-700"
          >
            Condiciones de Servicio
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