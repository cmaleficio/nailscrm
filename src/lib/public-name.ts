/**
 * El muro de inspiración y el formulario de reseña son públicos y sin sesión.
 * AGENTS.md fija la regla de "privacidad por defecto: solo nombre de pila", y
 * el truncado va aquí, en el servidor, para que el nombre completo nunca viaje
 * en la respuesta: si se hiciera en el componente, el dato ya habría salido
 * del servidor y bastaría con abrir las devtools para leerlo.
 *
 * Se separa por cualquier espacio en blanco, no solo por `" "`, porque los
 * nombres guardados vienen de formularios y de Google y pueden traer tabs,
 * saltos de línea o espacios dobles.
 */
export function publicFirstName(fullName: string | null | undefined): string | null {
  if (typeof fullName !== "string") return null;
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first.length > 0 ? first : null;
}
