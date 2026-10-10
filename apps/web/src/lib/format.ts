export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

/** Un día sin hora (`AAAA-MM-DD`) como "9 oct 2026". Se arma al mediodía para que no cambie con la zona horaria. */
export const formatDay = (isoDay: string) =>
  new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${isoDay}T12:00:00`),
  );
