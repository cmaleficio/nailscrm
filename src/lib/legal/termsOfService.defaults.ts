import type { TermsOfServiceValues } from "./termsOfService.types";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const TERMS_OF_SERVICE_DEFAULTS: TermsOfServiceValues = {
  companyName: "Tu Salón",
  siteUrl: "https://example.com",
  effectiveDate: todayIso(),
  country: "tu país",
  governingLaw: "las leyes de tu país",
  contactEmail: "contacto@example.com",
  contactPhone: null,
  contactUrl: null,
  contactAddress: "tu dirección completa",
  content: `## Política de Retrasos

Con el fin de respetar el tiempo de nuestros clientes y de nuestro personal, le pedimos que llegue puntualmente a su cita. Lamentablemente no podremos atender a aquellos clientes que lleguen con más de 15 minutos de retraso a su cita. Disculpe las molestias.

## Política de Cancelaciones

Entendemos que las emergencias y los imprevistos ocurren. Si necesita cancelar su cita, simplemente le pedimos que nos notifique cualquier cancelación con al menos 24 horas de anticipación.

Para mantener el buen funcionamiento del centro, a aquellos clientes que cancelen su cita más de una vez con menos de 24 horas de anticipación se les hará un recargo del 50% del servicio reservado en su próxima cita.

## Citas Olvidadas

En caso de faltar a su cita sin previo aviso, no se le permitirá reservar de nuevo una cita a menos que abone por adelantado el 100% del valor del próximo servicio reservado.

## Garantía del Servicio

La satisfacción de nuestros clientes es nuestra mayor prioridad. Si no queda satisfecho con el servicio que le hemos ofrecido, por favor comuníquenoslo dentro de las 24 horas posteriores. Nos comprometemos a hacer las correcciones necesarias, y en caso de que haya un fallo por nuestra parte, a ofrecerle un reembolso de la cantidad abonada.

## Ficha de Salud

Para su comodidad y seguridad, por favor notifique a nuestros esteticistas si tiene alergias, problemas físicos o discapacidades o si se encuentra embarazada. Si experimenta molestias o cualquier otro síntoma durante el tratamiento, por favor comuníquelo a nuestro personal inmediatamente.

## Derecho a Rechazar el Servicio

Nuestro personal tiene derecho a negarse a ofrecer un servicio a cualquier persona que se comporte de manera inapropiada o cuyo estado de salud pueda influir en los efectos del servicio.

## Normas Adicionales

- No se permite el ingreso de mascotas al establecimiento.
- Por favor mantenga el silencio durante los tratamientos.
- No consuma alimentos o bebidas dentro del salón.
- Los niños deben estar bajo supervisión constante de un adulto.`,
};
