import type { PrivacyPolicyValues } from "./privacyPolicy.types";
import Link from "next/link";

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(d);
}

export function renderPrivacyPolicy(values: PrivacyPolicyValues): React.ReactNode {
  return (
    <article className="prose prose-gray mx-auto max-w-3xl">
      <h1>Política de Privacidad</h1>
      <p className="text-sm text-gray-500">Actualizado el {fmtDate(values.effectiveDate)}</p>

      <p>
        <strong>{values.companyName}</strong> (&quot;nosotros&quot;, &quot;nuestro&quot; o &quot;nos&quot;) se
        compromete a proteger su privacidad. Esta Política de privacidad explica
        cómo recopila, usa y divulga su información personal.
      </p>

      <p>
        Esta Política de privacidad se aplica a nuestro sitio web, y sus
        subdominios asociados (colectivamente, nuestro &quot;Servicio&quot;) junto con
        nuestra aplicación. Al acceder o utilizar nuestro Servicio, usted
        indica que ha leído, comprendido y aceptado nuestra recopilación,
        almacenamiento, uso y divulgación de su información personal como se
        describe en esta Política de privacidad y en nuestros Términos de
        servicio.
      </p>

      <h2>Definiciones y Términos Clave</h2>
      <p>
        Para ayudar a explicar las cosas de la manera más clara posible en
        esta Política de privacidad, cada vez que se hace referencia a
        cualquiera de estos términos, se definen estrictamente como:
      </p>

      <ul>
        <li><strong>Cookie:</strong> pequeña cantidad de datos generados por un sitio web y guardados por su navegador web. Se utiliza para identificar su navegador, proporcionar análisis, recordar información sobre usted, como su preferencia de idioma o información de inicio de sesión.</li>
        <li><strong>Compañía:</strong> cuando esta política menciona &quot;Compañía&quot;, &quot;nosotros&quot;, &quot;nos&quot; o &quot;nuestro&quot;, se refiere a <strong>{values.companyName}</strong>, que es responsable de su información en virtud de esta Política de privacidad.</li>
        <li><strong>Plataforma:</strong> sitio web de Internet, aplicación web o aplicación digital de cara al público de <strong>{values.companyName}</strong>.</li>
        <li><strong>País:</strong> donde se encuentra <strong>{values.companyName}</strong> o los propietarios / fundadores de <strong>{values.companyName}</strong>; en este caso es <strong>{values.country}</strong>.</li>
        <li><strong>Cliente:</strong> se refiere a la empresa, organización o persona que se registra para utilizar el Servicio para gestionar las relaciones con sus consumidores o usuarios del servicio.</li>
        <li><strong>Dispositivo:</strong> cualquier dispositivo conectado a Internet, como un teléfono, tablet, computadora o cualquier otro dispositivo que se pueda usar para visitar y usar los servicios.</li>
        <li><strong>Dirección IP:</strong> a cada dispositivo conectado a Internet se le asigna un número conocido como dirección de protocolo de Internet (IP). Estos números generalmente se asignan en bloques geográficos. A menudo, se puede utilizar una dirección IP para identificar la ubicación desde la que un dispositivo se conecta a Internet.</li>
        <li><strong>Personal:</strong> se refiere a aquellas personas que son empleadas por o están bajo contrato para realizar un servicio en nombre de una de las partes.</li>
        <li><strong>Datos personales:</strong> cualquier información que directa, indirectamente o en conexión con otra información, incluido un número de identificación personal, permita la identificación de una persona física.</li>
        <li><strong>Servicio:</strong> se refiere al servicio brindado por <strong>{values.companyName}</strong> como se describe en los términos relativos (si están disponibles) y en esta plataforma.</li>
        <li><strong>Terceros:</strong> se refiere a anunciantes, patrocinadores de concursos, socios promocionales y de marketing, y otros que brindan nuestro contenido o cuyos productos o servicios creemos que pueden interesarle.</li>
        <li><strong>Sitio web:</strong> el sitio de <strong>{values.companyName}</strong>, al que se puede acceder a través de esta URL: <a href={values.siteUrl}>{values.siteUrl}</a>.</li>
        <li><strong>Usted:</strong> una persona o entidad que está registrada con <strong>{values.companyName}</strong> para utilizar los Servicios.</li>
      </ul>

      <h2>Información recopilada automáticamente</h2>
      <p>
        Existe cierta información como su dirección de Protocolo de Internet
        (IP) y/o las características del navegador y del dispositivo, que se
        recopila automáticamente cuando visita nuestra plataforma. Esta
        información se puede utilizar para conectar su computadora a Internet.
        Otra información recopilada automáticamente podría ser un inicio de
        sesión, dirección de correo electrónico, contraseña, información de la
        computadora y la conexión, como los tipos y versiones de complementos
        del navegador y la configuración de la zona horaria, los sistemas
        operativos y las plataformas, el historial de compras (a veces
        agregamos información similar de otros usuarios), el flujo de clics
        completo del Localizador uniforme de recursos (URL) hacia, a través y
        desde nuestro sitio web que puede incluir la fecha y la hora; número
        de cookie; partes del sitio que vio o buscó; y el número de teléfono
        que utilizó para llamar a nuestro Servicio de atención al cliente.
        También podemos utilizar datos del navegador como cookies, cookies
        Flash (también conocidas como objetos compartidos locales Flash) o
        datos similares en ciertas partes de nuestro sitio web para la
        prevención del fraude y otros fines. Durante sus visitas, podemos
        utilizar herramientas de software como JavaScript para medir y
        recopilar información de la sesión, incluidos los tiempos de
        respuesta de la página, los errores de descarga, la duración de las
        visitas a determinadas páginas, la información de interacción de la
        página (como el desplazamiento, los clics y el desplazamiento del
        mouse) y métodos utilizados para navegar fuera de la página. También
        podemos recopilar información técnica para ayudarnos a identificar su
        dispositivo con fines de prevención y diagnóstico de fraude.
      </p>
      <p>
        Recopilamos automáticamente cierta información cuando visita, usa o
        navega por la plataforma. Esta información no revela su identidad
        específica (como su nombre o información de contacto), pero puede
        incluir información de uso y dispositivo, como su dirección IP,
        navegador y características del dispositivo, sistema operativo,
        preferencias de idioma, URL de referencia, nombre del dispositivo,
        país, ubicación, información sobre quién y cuándo utiliza nuestra
        información y otra información técnica. Esta información es
        principalmente necesaria para mantener la seguridad y el
        funcionamiento de nuestra plataforma, y para nuestros fines de
        análisis e informes internos.
      </p>

      <h2>¿Qué información recopilamos?</h2>
      <p>
        Recopilamos información suya cuando visita nuestra plataforma, se
        registra en nuestro sitio, realiza un pedido, se suscribe a nuestro
        boletín, responde a una encuesta o completa un formulario.
      </p>
      <ul>
        <li>Nombre / nombre de usuario</li>
        <li>Números de teléfono</li>
        <li>Correos electrónicos</li>
        <li>Direcciones de correo</li>
        <li>Títulos de trabajo</li>
        <li>Direcciones de facturación</li>
        <li>Números de tarjetas de débito / crédito</li>
        <li>Edad</li>
        <li>Contraseña</li>
      </ul>
      <p>
        También recopilamos información de dispositivos móviles para una
        mejor experiencia de usuario, aunque estas funciones son
        completamente opcionales:
      </p>
      <ul>
        <li><strong>Ubicación (GPS):</strong> los datos de ubicación ayudan a crear una representación precisa de sus intereses, y esto se puede utilizar para llevar anuncios más específicos y relevantes a los clientes potenciales.</li>
        <li><strong>Agenda telefónica (lista de contactos):</strong> su lista de contactos permite que la plataforma sea mucho más fácil de usar por parte del usuario, ya que acceder a sus contactos desde la aplicación le permite ahorrar toneladas de tiempo.</li>
        <li><strong>Cámara (imágenes):</strong> otorgar permiso a la cámara le permite al usuario cargar cualquier imagen directamente desde la plataforma, puede denegar de manera segura los permisos de la cámara para esta plataforma.</li>
        <li><strong>Galería de fotos (imágenes):</strong> Otorgar acceso a la galería de fotos permite al usuario cargar cualquier imagen de su galería de fotos. Puede denegar el acceso a la galería de fotos de manera segura para esta plataforma.</li>
      </ul>

      <h2>¿Cuándo usa la información del usuario final de terceros?</h2>
      <p>
        <strong>{values.companyName}</strong> recopilará los datos del
        usuario final necesarios para proporcionar los servicios de
        <strong> {values.companyName}</strong> a nuestros clientes:
      </p>
      <p>
        Los usuarios finales pueden proporcionarnos voluntariamente la
        información que han puesto a disposición en los sitios web de las
        redes sociales. Si nos proporciona dicha información, podemos
        recopilar información disponible públicamente de los sitios web de
        redes sociales que ha indicado. Puede controlar la cantidad de
        información que los sitios web de redes sociales hacen pública
        visitando estos sitios web y cambiando su configuración de
        privacidad.
      </p>

      <h2>¿Cuándo usa la información del cliente de terceros?</h2>
      <p>
        Recibimos información de terceros cuando se comunica con nosotros.
        Por ejemplo, cuando nos envía su dirección de correo electrónico
        para mostrar interés en convertirse en cliente de
        <strong> {values.companyName}</strong>, recibimos información de un
        tercero que brinda servicios automáticos de detección de fraude a
        <strong> {values.companyName}</strong>. Ocasionalmente, también
        recopilamos información que se pone a disposición del público en los
        sitios web de redes sociales. Puede controlar la cantidad de
        información que los sitios web de redes sociales hacen pública
        visitando estos sitios web y cambiando su configuración de
        privacidad.
      </p>

      <h2>¿Compartimos la información que recopilamos con terceros?</h2>
      <p>
        Podemos compartir la información que recopilamos, tanto personal
        como no personal, con terceros como anunciantes, patrocinadores de
        concursos, socios promocionales y de marketing, y otros que
        proporcionan nuestro contenido o cuyos productos o servicios
        creemos que pueden interesarle. También podemos compartirlo con
        nuestras compañías afiliadas y socios comerciales actuales y
        futuros, y si estamos involucrados en una fusión, venta de activos
        u otra reorganización comercial, también podemos compartir o
        transferir su información personal y no personal a nuestros
        sucesores en interés.
      </p>
      <p>
        Podemos contratar proveedores de servicios de terceros de confianza
        para que realicen funciones y nos brinden servicios, como el
        alojamiento y el mantenimiento de nuestros servidores y la
        plataforma, almacenamiento y administración de bases de datos,
        administración de correo electrónico, marketing de almacenamiento,
        procesamiento de tarjetas de crédito, servicio y cumplimiento de
        pedidos de productos y servicios que puede comprar a través de la
        plataforma. Es probable que compartamos su información personal, y
        posiblemente alguna información no personal, con estos terceros
        para permitirles realizar estos servicios para nosotros y para
        usted.
      </p>
      <p>
        Podemos compartir partes de los datos de nuestro archivo de
        registro, incluidas las direcciones IP, con fines analíticos con
        terceros, como socios de análisis web, desarrolladores de
        aplicaciones y redes publicitarias. Si se comparte su dirección IP,
        se puede utilizar para estimar la ubicación general y otros datos
        tecnológicos, como la velocidad de conexión, si ha visitado la
        plataforma en una ubicación compartida y el tipo de dispositivo
        utilizado para visitar la plataforma. Pueden agregar información
        sobre nuestra publicidad y lo que ve en la plataforma y luego
        proporcionar auditorías, investigaciones e informes para nosotros y
        nuestros anunciantes.
      </p>
      <p>
        También podemos divulgar información personal y no personal sobre
        usted al gobierno, a funcionarios encargados de hacer cumplir la
        ley o a terceros privados, según consideremos, a nuestro exclusivo
        criterio, necesario o apropiado para responder a reclamos, procesos
        legales (incluidas citaciones), para proteger nuestros derechos e
        intereses o los de un tercero, la seguridad del público o de
        cualquier persona, para prevenir o detener cualquier actividad
        ilegal, poco ética o legalmente procesable, o para cumplir con las
        órdenes judiciales, leyes, reglas y regulaciones aplicables.
      </p>

      <h2>¿Cómo usamos la información que recopilamos?</h2>
      <p>
        Cualquiera de la información que recopilamos de usted puede usarse
        de una de las siguientes maneras:
      </p>
      <ul>
        <li>Para personalizar su experiencia (su información nos ayuda a responder mejor a sus necesidades individuales).</li>
        <li>Para mejorar nuestra plataforma (nos esforzamos continuamente por mejorar lo que ofrece nuestra plataforma en función de la información y los comentarios que recibimos de usted).</li>
        <li>Para mejorar el servicio al cliente (su información nos ayuda a responder de manera más efectiva a sus solicitudes de servicio al cliente y necesidades de soporte).</li>
        <li>Para procesar transacciones.</li>
        <li>Para administrar un concurso, promoción, encuesta u otra característica del sitio.</li>
        <li>Para enviar correos electrónicos periódicos.</li>
      </ul>

      <h2>¿Cómo utilizamos su dirección de correo electrónico?</h2>
      <p>
        Al enviar su dirección de correo electrónico en esta plataforma,
        acepta recibir nuestros correos electrónicos. Puede cancelar su
        participación en cualquiera de estas listas de correo electrónico en
        cualquier momento haciendo clic en el enlace de exclusión
        voluntaria u otra opción para cancelar la suscripción que se incluye
        en el correo electrónico respectivo. Solo enviamos correos
        electrónicos a personas que nos han autorizado a contactarlos, ya
        sea directamente o a través de un tercero. No enviamos correos
        electrónicos comerciales no solicitados, porque odiamos el spam
        tanto como usted. Al enviar su dirección de correo electrónico,
        también acepta permitirnos usar su dirección de correo electrónico
        para la orientación de la audiencia del cliente en sitios como
        Facebook, donde mostramos publicidad personalizada a personas
        específicas que han optado por recibir nuestras comunicaciones. Las
        direcciones de correo electrónico enviadas solo a través de la
        página de procesamiento de pedidos se utilizarán con el único
        propósito de enviarle información y actualizaciones relacionadas
        con su pedido. Sin embargo, si nos ha proporcionado el mismo correo
        electrónico a través de otro método, podemos usarlo para
        cualquiera de los fines establecidos en esta Política. Nota: Si en
        algún momento desea cancelar la suscripción para no recibir
        correos electrónicos futuros, incluimos instrucciones detalladas
        para cancelar la suscripción en la parte inferior de cada correo
        electrónico.
      </p>

      <h2>¿Cuánto tiempo conservamos su información?</h2>
      <p>
        Conservamos su información solo mientras la necesitemos para
        proporcionarle y cumplir con los propósitos descritos en esta
        política. Este también es el caso de cualquier persona con la que
        compartamos su información y que lleve a cabo servicios en nuestro
        nombre. Cuando ya no necesitemos usar su información y no sea
        necesario que la conservemos para cumplir con nuestras obligaciones
        legales o reglamentarias, la eliminaremos de nuestros sistemas o la
        despersonalizaremos para que no podamos identificarlo.
      </p>

      <h2>¿Cómo protegemos su información?</h2>
      <p>
        Implementamos una variedad de medidas de seguridad para mantener la
        seguridad de su información personal cuando realiza un pedido,
        ingresa, envía o accede a su información personal. Ofrecemos el uso
        de un servidor seguro. Toda la información confidencial / crediticia
        suministrada se transmite a través de la tecnología Secure Socket
        Layer (SSL) y luego se encripta en nuestra base de datos de
        proveedores de pasarela de pago solo para que sea accesible por
        aquellos autorizados con derechos especiales de acceso a dichos
        sistemas, y deben mantener la información confidencial. Después de
        una transacción, su información privada (tarjetas de crédito,
        números de seguro social, finanzas, etc.) nunca se archiva. Sin
        embargo, no podemos garantizar la seguridad absoluta de la
        información que transmita a <strong>{values.companyName}</strong> ni
        garantizar que su información en el servicio no sea accedida,
        divulgada, alterada o destruida por una infracción de cualquiera de
        nuestras condiciones físicas, salvaguardias técnicas o de gestión.
      </p>

      <h2>¿Podría transferirse mi información a otros países?</h2>
      <p>
        <strong>{values.companyName}</strong> está incorporada en {values.country}. La
        información recopilada a través de nuestro sitio web, a través de
        interacciones directas con usted o del uso de nuestros servicios de
        ayuda puede transferirse de vez en cuando a nuestras oficinas o
        personal, o a terceros, ubicados en todo el mundo, y puede verse y
        alojarse en cualquier lugar del mundo, incluidos los países que
        pueden no tener leyes de aplicación general que regulen el uso y la
        transferencia de dichos datos. En la mayor medida permitida por la
        ley aplicable, al utilizar cualquiera de los anteriores, usted
        acepta voluntariamente la transferencia transfronteriza y el
        alojamiento de dicha información.
      </p>

      <h2>¿La información recopilada a través del Servicio es segura?</h2>
      <p>
        Tomamos precauciones para proteger la seguridad de su información.
        Contamos con procedimientos físicos, electrónicos y administrativos
        para ayudar a salvaguardar, prevenir el acceso no autorizado,
        mantener la seguridad de los datos y usar correctamente su
        información. Sin embargo, ni las personas ni los sistemas de
        seguridad son infalibles, incluidos los sistemas de cifrado.
        Además, las personas pueden cometer delitos intencionales, cometer
        errores o no seguir las políticas. Por lo tanto, aunque hacemos
        todos los esfuerzos razonables para proteger su información
        personal, no podemos garantizar su seguridad absoluta. Si la ley
        aplicable impone algún deber irrenunciable de proteger su
        información personal, usted acepta que la mala conducta
        intencional serán los estándares utilizados para medir nuestro
        cumplimiento con ese deber.
      </p>

      <h2>¿Puedo actualizar o corregir mi información?</h2>
      <p>
        Los derechos que tienes para solicitar actualizaciones o
        correcciones de la información que <strong>{values.companyName}</strong>
        recopila dependen de tu relación con
        <strong> {values.companyName}</strong>. El personal puede actualizar o
        corregir su información según se detalla en nuestras políticas de
        empleo internas de la empresa.
      </p>
      <p>
        Los clientes tienen derecho a solicitar la restricción de ciertos
        usos y divulgaciones de información de identificación personal de
        la siguiente manera. Puede comunicarse con nosotros para (1)
        actualizar o corregir su información de identificación personal,
        (2) cambiar sus preferencias con respecto a las comunicaciones y
        otra información que recibe de nosotros, o (3) eliminar la
        información de identificación personal que se mantiene sobre usted
        en nuestro sistema (sujeto al siguiente párrafo), cancelando su
        cuenta. Dichas actualizaciones, correcciones, cambios y
        eliminaciones no tendrán ningún efecto sobre otra información que
        mantenemos o información que hayamos proporcionado a terceros de
        acuerdo con esta Política de privacidad antes de dicha
        actualización, corrección, cambio o eliminación. Para proteger su
        privacidad y seguridad, podemos tomar medidas razonables (como
        solicitar una contraseña única) para verificar su identidad antes
        de otorgarle acceso a su perfil o hacer correcciones. Usted es
        responsable de mantener en secreto su contraseña única y la
        información de su cuenta en todo momento.
      </p>
      <p>
        Debe tener en cuenta que tecnológicamente no es posible eliminar
        todos y cada uno de los registros de la información que nos ha
        proporcionado de nuestro sistema. La necesidad de realizar copias
        de seguridad de nuestros sistemas para proteger la información de
        pérdidas involuntarias significa que puede existir una copia de su
        información en una forma que no se pueda borrar y que será difícil
        o imposible de localizar para nosotros. Inmediatamente después de
        recibir su solicitud, toda la información personal almacenada en
        las bases de datos que usamos activamente y otros medios
        fácilmente buscables se actualizará, corregirá, cambiará o
        eliminará, según corresponda, tan pronto como y en la medida en que
        sea razonable y técnicamente posible.
      </p>
      <p>
        Si es un usuario final y desea actualizar, eliminar o recibir
        cualquier información que tengamos sobre usted, puede hacerlo
        poniéndose en contacto con la organización de la que es cliente.
      </p>

      <h2>Personal</h2>
      <p>
        Si es un trabajador o solicitante de
        <strong> {values.companyName}</strong>, recopilamos la información
        que nos proporciona voluntariamente. Usamos la información
        recopilada con fines de recursos humanos para administrar los
        beneficios a los trabajadores y seleccionar a los solicitantes.
      </p>
      <p>
        Puede comunicarse con nosotros para (1) actualizar o corregir su
        información, (2) cambiar sus preferencias con respecto a las
        comunicaciones y otra información que reciba de nosotros, o (3)
        recibir un registro de la información que tenemos relacionada con
        usted. Dichas actualizaciones, correcciones, cambios y
        eliminaciones no tendrán ningún efecto sobre otra información que
        mantenemos o información que hayamos proporcionado a terceros de
        acuerdo con esta Política de privacidad antes de dicha
        actualización, corrección, cambio o eliminación.
      </p>

      <h2>Venta de Negocio</h2>
      <p>
        Nos reservamos el derecho de transferir información a un tercero en
        el caso de una venta, fusión u otra transferencia de todos o
        sustancialmente todos los activos de
        <strong> {values.companyName}</strong> o cualquiera de sus afiliadas
        corporativas (como se define en este documento), o la porción de
        <strong> {values.companyName}</strong> o cualquiera de sus
        afiliadas corporativas con las que se relaciona el Servicio, o en
        el caso de que discontinuemos nuestro negocio o presentemos una
        petición o hayamos presentado una petición contra nosotros en caso
        de quiebra, reorganización o procedimiento similar, siempre que el
        tercero acepte adherirse a los términos de esta Política de
        privacidad.
      </p>

      <h2>Afiliados</h2>
      <p>
        Podemos divulgar información (incluida la información personal)
        sobre usted a nuestros afiliados corporativos. Para los propósitos
        de esta Política de Privacidad, &quot;Afiliado Corporativo&quot; significa
        cualquier persona o entidad que directa o indirectamente controla,
        está controlada por o está bajo control común con
        <strong> {values.companyName}</strong>, ya sea por propiedad o de
        otra manera. Cualquier información relacionada con usted que
        proporcionemos a nuestros afiliados corporativos será tratada por
        dichos afiliados corporativos de acuerdo con los términos de esta
        política de privacidad.
      </p>

      <h2>Ley que Rige</h2>
      <p>
        Esta Política de privacidad se rige por {values.governingLaw}, sin
        tener en cuenta su disposición sobre conflicto de leyes. Usted
        acepta la jurisdicción exclusiva de los tribunales en relación con
        cualquier acción o disputa que surja entre las partes en virtud de
        esta Política de privacidad o en relación con ella, excepto
        aquellas personas que puedan tener derecho a presentar
        reclamaciones en virtud del Escudo de privacidad o el marco
        suizo-estadounidense. Las leyes de {values.country}, excluyendo sus
        conflictos de leyes, regirán este Acuerdo y su uso de la
        plataforma. Su uso de la plataforma también puede estar sujeto a
        otras leyes locales, estatales, nacionales o internacionales.
      </p>
      <p>
        Al usar <strong>{values.companyName}</strong> o comunicarse con
        nosotros directamente, significa que acepta esta Política de
        privacidad. Si no está de acuerdo con esta Política de privacidad,
        no debe interactuar con nuestro sitio web ni utilizar nuestros
        servicios. El uso continuo del sitio web, la interacción directa
        con nosotros o después de la publicación de cambios en esta
        Política de privacidad que no afecten significativamente el uso o
        divulgación de su información personal significará que acepta esos
        cambios.
      </p>

      <h2>Tu consentimiento</h2>
      <p>
        Hemos actualizado nuestra Política de privacidad para brindarle
        total transparencia sobre lo que se establece cuando visita nuestro
        sitio y cómo se utiliza. Al utilizar nuestra plataforma, registrar
        una cuenta o realizar una compra, por la presente acepta nuestra
        Política de privacidad y acepta sus términos.
      </p>

      <h2>Enlaces a otros Sitios Web</h2>
      <p>
        Esta Política de privacidad se aplica solo a los Servicios. Los
        Servicios pueden contener enlaces a otros sitios web que
        <strong> {values.companyName}</strong> no opera ni controla. No
        somos responsables por el contenido, la exactitud o las opiniones
        expresadas en dichos sitios web, y dichos sitios web no son
        investigados, monitoreados o verificados por nuestra precisión o
        integridad. Recuerde que cuando utiliza un enlace para ir desde
        los Servicios a otro sitio web, nuestra Política de privacidad
        deja de estar en vigor. Su navegación e interacción en cualquier
        otro sitio web, incluidos aquellos que tienen un enlace en
        nuestra plataforma, están sujetos a las propias reglas y políticas
        de ese sitio web. Dichos terceros pueden utilizar sus propias
        cookies u otros métodos para recopilar información sobre usted.
      </p>

      <h2>Publicidad</h2>
      <p>
        Esta plataforma puede contener anuncios de terceros y enlaces a
        sitios de terceros.
      </p>
      <p>
        <strong>{values.companyName}</strong> no hace ninguna
        representación en cuanto a la exactitud o idoneidad de la
        información contenida en esos anuncios o sitios y no acepta
        ninguna responsabilidad u obligación por la conducta o el
        contenido de esos anuncios y sitios y las ofertas realizadas por
        los terceros.
      </p>
      <p>
        La publicidad mantiene a <strong>{values.companyName}</strong> y
        muchos de los sitios web y servicios que usted utiliza de forma
        gratuita. Trabajamos arduamente para asegurarnos de que los
        anuncios sean seguros, discretos y lo más relevantes posible.
      </p>
      <p>
        Los anuncios de terceros y los enlaces a otros sitios donde se
        anuncian bienes o servicios no son respaldos ni recomendaciones
        de <strong>{values.companyName}</strong> de los sitios, bienes o
        servicios de terceros.
      </p>
      <p>
        <strong>{values.companyName}</strong> no asume ninguna
        responsabilidad por el contenido de los anuncios, las promesas
        hechas o la calidad / confiabilidad de los productos o servicios
        ofrecidos en todos los anuncios.
      </p>

      <h2>Cookies para Publicidad</h2>
      <p>
        Estas cookies recopilan información a lo largo del tiempo sobre su
        actividad en línea en la plataforma y otros servicios en línea
        para hacer que los anuncios en línea sean más relevantes y
        efectivos para usted. Esto se conoce como publicidad basada en
        intereses. También realizan funciones como evitar que el mismo
        anuncio vuelva a aparecer continuamente y garantizar que los
        anuncios se muestren correctamente a los anunciantes. Sin
        cookies, es muy difícil para un anunciante llegar a su audiencia o
        saber cuántos anuncios se mostraron y cuántos clics recibieron.
      </p>

      <h2>Cookies</h2>
      <p>
        <strong>{values.companyName}</strong> utiliza &quot;cookies&quot; para
        identificar las áreas de nuestro sitio web que ha visitado. Una
        cookie es una pequeña porción de datos que su navegador web
        almacena en su computadora o dispositivo móvil. Usamos cookies
        para mejorar el rendimiento y la funcionalidad de nuestra
        plataforma, pero no son esenciales para su uso. Sin embargo, sin
        estas cookies, es posible que ciertas funciones, como los videos,
        no estén disponibles o se le solicitará que ingrese sus datos de
        inicio de sesión cada vez que visite la plataforma, ya que no
        podríamos recordar que había iniciado sesión anteriormente. La
        mayoría de los navegadores web se pueden configurar para
        desactivar el uso de cookies. Sin embargo, si desactiva las
        cookies, es posible que no pueda acceder a la funcionalidad de
        nuestro sitio web correctamente o en absoluto. Nunca colocamos
        información de identificación personal en cookies.
      </p>

      <h2>Bloquear y deshabilitar Cookies y tecnologías similares</h2>
      <p>
        Donde sea que se encuentre, también puede configurar su navegador
        para bloquear cookies y tecnologías similares, pero esta acción
        puede bloquear nuestras cookies esenciales e impedir que nuestro
        sitio web funcione correctamente, y es posible que no pueda
        utilizar todas sus funciones y servicios por completo. También
        debe tener en cuenta que también puede perder información
        guardada (por ejemplo, detalles de inicio de sesión guardados,
        preferencias del sitio) si bloquea las cookies en su navegador.
        Los distintos navegadores ponen a su disposición distintos
        controles. Deshabilitar una cookie o una categoría de cookie no
        elimina la cookie de su navegador, deberá hacerlo usted mismo
        desde su navegador, debe visitar el menú de ayuda de su navegador
        para obtener más información.
      </p>

      <h2>Servicios de Remarketing</h2>
      <p>
        Usamos servicios de remarketing. ¿Qué es el remarketing? En
        marketing digital, el remarketing (o retargeting) es la práctica
        de publicar anuncios en Internet a personas que ya han visitado
        su sitio web. Permite que su empresa parezca que está &quot;siguiendo&quot;
        a las personas en Internet mediante la publicación de anuncios en
        los sitios web y las plataformas que más utilizan.
      </p>

      <h2>Detalles del Pago</h2>
      <p>
        Con respecto a cualquier tarjeta de crédito u otros detalles de
        procesamiento de pagos que nos haya proporcionado, nos
        comprometemos a que esta información confidencial se almacene de
        la manera más segura posible.
      </p>

      <h2>Privacidad de los Niños</h2>
      <p>
        Recopilamos información de niños menores de 13 años solo para
        mejorar nuestros servicios. Si usted es padre o tutor y sabe que
        su hijo nos ha proporcionado datos personales sin su permiso,
        comuníquese con nosotros. Si nos damos cuenta de que hemos
        recopilado datos personales de cualquier persona menor de 13 años
        sin la verificación del consentimiento de los padres, tomamos
        medidas para eliminar esa información de nuestros servidores.
      </p>

      <h2>Cambios en nuestra Política de Privacidad</h2>
      <p>
        Podemos cambiar nuestro Servicio y nuestras políticas, y es
        posible que debamos realizar cambios en esta Política de
        privacidad para que reflejen con precisión nuestro Servicio y
        nuestras políticas. A menos que la ley exija lo contrario, le
        notificaremos (por ejemplo, a través de nuestro Servicio) antes de
        realizar cambios en esta Política de privacidad y le daremos la
        oportunidad de revisarlos antes de que entren en vigencia. Luego,
        si continúa utilizando el Servicio, estará sujeto a la Política
        de privacidad actualizada. Si no desea aceptar esta o cualquier
        Política de privacidad actualizada, puede eliminar su cuenta.
      </p>

      <h2>Servicios de terceros</h2>
      <p>
        Podemos mostrar, incluir o poner a disposición contenido de
        terceros (incluidos datos, información, aplicaciones y otros
        servicios de productos) o proporcionar enlaces a sitios web o
        servicios de terceros (&quot;Servicios de terceros&quot;).
      </p>
      <p>
        Usted reconoce y acepta que
        <strong> {values.companyName}</strong> no será responsable de
        ningún Servicio de terceros, incluida su precisión, integridad,
        puntualidad, validez, cumplimiento de los derechos de autor,
        legalidad, decencia, calidad o cualquier otro aspecto de los
        mismos. <strong>{values.companyName}</strong> no asume ni tendrá
        ninguna obligación o responsabilidad ante usted o cualquier otra
        persona o entidad por los Servicios de terceros.
      </p>
      <p>
        Los Servicios de terceros y los enlaces a los mismos se brindan
        únicamente para su conveniencia y usted accede a ellos y los usa
        completamente bajo su propio riesgo y sujeto a los términos y
        condiciones de dichos terceros.
      </p>

      <h2>Facebook Pixel</h2>
      <p>
        Facebook pixel es una herramienta de análisis que le permite
        medir la efectividad de su publicidad al comprender las acciones
        que las personas realizan en su sitio web. Puede utilizar el píxel
        para asegurarse de que sus anuncios se muestren a las personas
        adecuadas. Facebook Pixel puede recopilar información de su
        dispositivo cuando utiliza el servicio. Facebook pixel recopila
        información que se guarda de acuerdo con su Política de
        privacidad.
      </p>

      <h2>Tecnologías de Seguimiento</h2>

      <h3>API de Google Maps</h3>
      <p>
        La API de Google Maps es una herramienta sólida que se puede
        utilizar para crear un mapa personalizado, un mapa de búsqueda,
        funciones de registro, mostrar la sincronización de datos en vivo
        con la ubicación, planificar rutas o crear un mashup, solo por
        nombrar algunos.
      </p>
      <p>
        La API de Google Maps puede recopilar información suya y de su
        dispositivo por motivos de seguridad.
      </p>
      <p>
        La API de Google Maps recopila información que se mantiene de
        acuerdo con su Política de privacidad.
      </p>

      <h3>Cookies</h3>
      <p>
        Usamos Cookies para mejorar el rendimiento y la funcionalidad de
        nuestra plataforma, pero no son esenciales para su uso. Sin
        embargo, sin estas cookies, es posible que ciertas funciones,
        como los videos, no estén disponibles o se le solicitará que
        ingrese sus datos de inicio de sesión cada vez que visite la
        plataforma, ya que no podríamos recordar que había iniciado
        sesión anteriormente.
      </p>

      <h3>Almacenamiento Local</h3>
      <p>
        El almacenamiento local, a veces conocido como almacenamiento DOM,
        proporciona a las aplicaciones web métodos y protocolos para
        almacenar datos del lado del cliente. El almacenamiento web
        admite el almacenamiento de datos persistente, similar a las
        cookies, pero con una capacidad muy mejorada y sin información
        almacenada en el encabezado de solicitud HTTP.
      </p>

      <h3>Sesiones</h3>
      <p>
        <strong>{values.companyName}</strong> utiliza &quot;Sesiones&quot; para
        identificar las áreas de nuestro sitio web que ha visitado. Una
        sesión es un pequeño fragmento de datos que su navegador web
        almacena en su computadora o dispositivo móvil.
      </p>

      <h2>Información sobre el Reglamento general de protección de datos (RGPD)</h2>
      <p>
        Es posible que recopilemos y utilicemos información suya si
        pertenece al Espacio Económico Europeo (EEE), y en esta sección
        de nuestra Política de privacidad vamos a explicar exactamente
        cómo y por qué se recopilan estos datos, y cómo los mantenemos
        bajo protección contra la replicación o el uso incorrecto.
      </p>

      <h3>¿Qué es RGPD?</h3>
      <p>
        RGPD es una ley de privacidad y protección de datos en toda la UE
        que regula cómo las empresas protegen los datos de los residentes
        de la UE y mejora el control que los residentes de la UE tienen
        sobre sus datos personales.
      </p>
      <p>
        El RGPD es relevante para cualquier empresa que opere a nivel
        mundial y no solo para las empresas con sede en la UE y los
        residentes de la UE. Los datos de nuestros clientes son
        importantes independientemente de dónde se encuentren, por lo
        que hemos implementado controles RGPD como nuestro estándar de
        referencia para todas nuestras operaciones en todo el mundo.
      </p>

      <h3>¿Qué son los Datos Personales?</h3>
      <p>
        Cualquier dato que se relacione con un individuo identificable o
        identificable. El RGPD cubre un amplio espectro de información
        que podría usarse por sí sola o en combinación con otras piezas
        de información para identificar a una persona. Los datos
        personales van más allá del nombre o la dirección de correo
        electrónico de una persona. Algunos ejemplos incluyen información
        financiera, opiniones políticas, datos genéticos, datos
        biométricos, direcciones IP, dirección física, orientación
        sexual y origen étnico.
      </p>

      <p>Los principios de protección de datos incluyen requisitos tales como:</p>
      <ul>
        <li>Los datos personales recopilados deben procesarse de manera justa, legal y transparente y solo deben usarse de la manera que una persona esperaría razonablemente.</li>
        <li>Los datos personales solo deben recopilarse para cumplir con un propósito específico y solo deben usarse para ese propósito. Las organizaciones deben especificar por qué necesitan los datos personales cuando los recopilan.</li>
        <li>Los datos personales no deben conservarse más tiempo del necesario para cumplir con su propósito.</li>
        <li>Las personas cubiertas por el RGPD tienen derecho a acceder a sus propios datos personales. También pueden solicitar una copia de sus datos y que sus datos se actualicen, eliminen, restrinjan o muevan a otra organización.</li>
      </ul>

      <h3>¿Por qué es importante el RGPD?</h3>
      <p>
        RGPD agrega algunos requisitos nuevos con respecto a cómo las
        empresas deben proteger los datos personales de las personas que
        recopilan y procesan. También aumenta las apuestas para el
        cumplimiento al aumentar la aplicación e imponer mayores multas
        por incumplimiento. Más allá de estos hechos, es simplemente lo
        correcto. En <strong>{values.companyName}</strong> creemos
        firmemente que la privacidad de sus datos es muy importante y ya
        contamos con prácticas sólidas de seguridad y privacidad que van
        más allá de los requisitos de esta nueva regulación.
      </p>

      <h2>Contáctenos</h2>
      <p>No dude en contactarnos si tiene alguna pregunta.</p>
      <ul>
        <li>A través de correo electrónico: <a href={`mailto:${values.contactEmail}`}>{values.contactEmail}</a></li>
        {values.contactPhone && (
          <li>A través del número de teléfono: {values.contactPhone}</li>
        )}
        {values.contactUrl && (
          <li>A través de este enlace: <a href={values.contactUrl}>{values.contactUrl}</a></li>
        )}
        <li>A través de esta dirección: {values.contactAddress}</li>
      </ul>

      <hr />
      <p className="text-sm text-gray-500">
        Última actualización: {fmtDate(values.effectiveDate)} ·{" "}
        <Link href="/">Volver al inicio</Link>
      </p>
    </article>
  );
}