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

export function isRailway(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.RAILWAY_ENVIRONMENT ||
      env.RAILWAY_ENVIRONMENT_NAME ||
      env.RAILWAY_SERVICE_ID ||
      env.RAILWAY_PROJECT_ID ||
      env.RAILWAY_DEPLOYMENT_ID ||
      env.RAILWAY_STATIC_URL ||
      env.RAILWAY_PUBLIC_DOMAIN,
  );
}

export function isCloudDeployment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    env.RENDER ||
      env.RAILWAY_ENVIRONMENT ||
      env.RAILWAY_ENVIRONMENT_NAME ||
      env.RAILWAY_SERVICE_ID ||
      env.RAILWAY_PROJECT_ID ||
      env.RAILWAY_DEPLOYMENT_ID ||
      env.RAILWAY_STATIC_URL ||
      env.RAILWAY_PUBLIC_DOMAIN,
  );
}

export function readHost(env: NodeJS.ProcessEnv = process.env): string {
  const customHost = env.HOST?.trim();
  if (customHost) {
    return customHost;
  }
  if (isCloudDeployment(env)) {
    return '0.0.0.0';
  }
  return '127.0.0.1';
}
