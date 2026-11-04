export function withCleanup<T>(work: () => T | Promise<T>, cleanup: () => unknown): Promise<T>
export function stopWindowsPackage(directory: string): Promise<void>
export function removePackage(directory: string): Promise<void>
