export function isAuthorized(authHeader: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return false;
  }
  const expected = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`;
  return authHeader === expected;
}
