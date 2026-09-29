export const MAX_COMPLEMENTARY_SERVICES = 4;

export type ServiceRoleRow = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  durationMins: number;
  isActive: number | null;
  isGroup: number | null;
  isComplementary: number | null;
};

export type ComboResolution = {
  services: ServiceRoleRow[];
  principal: ServiceRoleRow | null;
  complementaries: ServiceRoleRow[];
  totalDurationMins: number;
  totalPrice: number;
  anchorServiceId: string;
  error: string | null;
};

export function parseComplementaryIds(
  input: string | string[] | null | undefined
): string[] {
  const raw: string[] = Array.isArray(input) ? input : input ? [input] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    for (const piece of String(entry).split(",")) {
      const id = piece.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function resolveBookingServices(
  services: ServiceRoleRow[],
  principalId: string | null | undefined,
  complementaryInput: string | string[] | null | undefined
): ComboResolution {
  const byId = new Map(services.map((s) => [s.id, s]));
  const complementaries = parseComplementaryIds(complementaryInput);
  const principal = principalId ? byId.get(principalId) ?? null : null;

  const fail = (error: string): ComboResolution => ({
    services: [],
    principal: null,
    complementaries: [],
    totalDurationMins: 0,
    totalPrice: 0,
    anchorServiceId: "",
    error,
  });

  if (principalId && !principal) return fail("El servicio principal no existe");

  if (!principal && complementaries.length === 0) {
    return fail("Elige al menos un servicio");
  }

  if (complementaries.length > MAX_COMPLEMENTARY_SERVICES) {
    return fail(
      `Puedes agregar hasta ${MAX_COMPLEMENTARY_SERVICES} servicios complementarios`
    );
  }

  if (principal) {
    if (!principal.isActive) return fail("El servicio principal está inactivo");
    if (principal.isComplementary) {
      return fail("Elige como principal un servicio que no sea complementario");
    }
    if (principal.isGroup && complementaries.length > 0) {
      // Un curso SOLO sí se puede agendar: hoy POST /api/appointments lo trata
      // como cualquier otro servicio (1 cita + 1 compra, sin inscripción; las
      // sesiones de grupo son de /api/course-sessions). Lo que se prohíbe es la
      // combinación, que es lo nuevo que introduce esta feature.
      return fail("Un curso no se puede combinar con servicios complementarios");
    }
    if (complementaries.includes(principal.id)) {
      return fail("El servicio principal no puede repetirse como complementario");
    }
  }

  const chosen: ServiceRoleRow[] = [];
  for (const id of complementaries) {
    const service = byId.get(id);
    if (!service) return fail("Uno de los servicios complementarios no existe");
    if (!service.isActive) {
      return fail(`El servicio "${service.name}" está inactivo`);
    }
    if (!service.isComplementary) {
      return fail(`"${service.name}" no es un servicio complementario`);
    }
    if (service.isGroup) {
      return fail("Un curso no se puede agregar como servicio complementario");
    }
    chosen.push(service);
  }

  const services_ = principal ? [principal, ...chosen] : chosen;
  const totalDurationMins = services_.reduce((acc, s) => acc + s.durationMins, 0);
  const totalPrice = services_.reduce((acc, s) => acc + s.price, 0);

  return {
    services: services_,
    principal: principal ?? null,
    complementaries: chosen,
    totalDurationMins,
    totalPrice,
    anchorServiceId: principal ? principal.id : chosen[0].id,
    error: null,
  };
}

export function formatServiceNames(names: string[]): string {
  return names.filter(Boolean).join(" + ");
}

/**
 * Qué hacer con el servicio que llega por `?serviceId=`. Es una decisión de
 * catálogo, no de UI: un complementario no puede ser principal (la API lo
 * rechaza), pero sí se puede ofrecer como "ya elegido" para agregar otro.
 */
export function classifyBookingEntry(
  service: { id: string; isComplementary?: number | null } | null | undefined,
  requestedId: string | null
): "principal" | "complementary" | "ignore" {
  if (!service || !requestedId || service.id !== requestedId) return "ignore";
  return service.isComplementary === 1 ? "complementary" : "principal";
}

/**
 * Reparte el catálogo. Con algo preseleccionado no se ofrecen principales:
 * la cita ya tiene su principal y, en un servidor con muchos servicios, la
 * lista completa de principales es lo que hace que el paso 1 se vea vacío.
 */
export function partitionBookingServices<
  T extends { id: string; isComplementary: number | null },
>(services: T[], preselectedId: string | null): { principal: T[]; complementary: T[] } {
  if (preselectedId) {
    return {
      principal: [],
      complementary: services.filter(
        (s) => s.isComplementary === 1 && s.id !== preselectedId
      ),
    };
  }
  return {
    principal: services.filter((s) => s.isComplementary !== 1),
    complementary: services.filter((s) => s.isComplementary === 1),
  };
}

/** Estado tras pulsar "Cambiar": la cita vuelve a no tener nada elegido. */
export function clearPreselected<T extends { id: string }>(
  selectedPrimary: T | null,
  selectedComplementaries: T[],
  preselectedId: string
): { primary: T | null; complementaries: T[] } {
  return {
    primary:
      selectedPrimary && selectedPrimary.id === preselectedId
        ? null
        : selectedPrimary,
    complementaries: selectedComplementaries.filter((s) => s.id !== preselectedId),
  };
}
