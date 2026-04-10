export type AuthRole = 'sales' | 'admin' | 'miner';

interface Credentials {
  username?: string;
  password?: string;
}

function resolveCredentialPair(
  primaryUser?: string,
  primaryPassword?: string,
  fallbackUser?: string,
  fallbackPassword?: string
): Credentials {
  if (primaryUser && primaryPassword) {
    return { username: primaryUser, password: primaryPassword };
  }
  return { username: fallbackUser, password: fallbackPassword };
}

export function getCredentials(role: AuthRole): Credentials {
  if (role === 'sales') {
    return {
      username: process.env.SALES_USER,
      password: process.env.SALES_PASSWORD,
    };
  }

  if (role === 'admin') {
    return resolveCredentialPair(
      process.env.ADMIN_USER,
      process.env.ADMIN_PASSWORD,
      process.env.SALES_USER,
      process.env.SALES_PASSWORD
    );
  }

  return resolveCredentialPair(
    process.env.MINER_USER,
    process.env.MINER_PASSWORD,
    process.env.SALES_USER,
    process.env.SALES_PASSWORD
  );
}

export function isConfigured(role: AuthRole): boolean {
  const { username, password } = getCredentials(role);
  return Boolean(username && password);
}

export function isValidCredentials(role: AuthRole, username: string, password: string): boolean {
  const configured = getCredentials(role);
  if (!configured.username || !configured.password) return false;
  return username === configured.username && password === configured.password;
}
