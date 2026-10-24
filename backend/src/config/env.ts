export function readPort(value: string | undefined = process.env.PORT): number {
  if (value === undefined) return 3001;
  if (!/^\d+$/.test(value)) {
    throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
  }
  return port;
}
