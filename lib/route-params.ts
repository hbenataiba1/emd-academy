/**
 * Route params arrive percent-encoded (a course id such as "test 2" is "test%202"),
 * so they must be decoded before they are used to look anything up.
 */
export function decodeRouteParam(value?: string) {
  if (!value) return '';

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
