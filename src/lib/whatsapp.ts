import { getSalonName } from "./brand";

export function getWhatsAppUrl(
  phone: string,
  name: string,
  service: string,
  date: string,
  time: string
): string {
  const msg = `Hola ${name}, te recuerdo tu cita de ${service} el ${date} a las ${time} en ${getSalonName()}`;
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`;
}
