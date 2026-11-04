type Request = (url: URL, options: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>
export function requireMainCI(env: NodeJS.ProcessEnv, request?: Request): Promise<string>
