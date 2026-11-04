import { execFileSync } from 'node:child_process'
import { realpath, rm } from 'node:fs/promises'

export async function withCleanup(work, cleanup) {
  let failure
  try { return await work() }
  catch (error) { failure = error; throw error }
  finally {
    try { await cleanup() }
    catch (error) {
      if (!failure) throw error
      throw new AggregateError([failure, error], `Falló la prueba (${failure.message}) y su limpieza (${error.message}).`, { cause: failure })
    }
  }
}

export async function stopWindowsPackage(directory) {
  if (process.platform !== 'win32') return
  const canonical = await realpath(directory)
  // Playwright puede salir antes que Electron. Acotar el cierre a esta copia temporal.
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference = 'Stop'
    $prefixes = @($env:FREYALAB_PACKAGE_ROOT, $env:FREYALAB_PACKAGE_REAL_ROOT) |
      ForEach-Object { $_.TrimEnd([char]92) + [char]92 }
    $children = @(Get-Process | Where-Object {
      $path = $_.Path
      $path -and @($prefixes | Where-Object {
        $path.StartsWith($_, [StringComparison]::OrdinalIgnoreCase)
      }).Count -gt 0
    })
    foreach ($child in $children) {
      if (!$child.HasExited) {
        Write-Host "Cerrando proceso del paquete: $($child.Id)"
        try { Stop-Process -InputObject $child -Force }
        catch { if (!$child.HasExited) { throw } }
        if (!$child.WaitForExit(5000)) { throw "No se pudo cerrar el proceso del paquete: $($child.Id)" }
      }
    }
  `], {
    env: { ...process.env, FREYALAB_PACKAGE_ROOT: directory, FREYALAB_PACKAGE_REAL_ROOT: canonical },
    stdio: 'inherit',
    timeout: 30_000,
  })
}

export async function removePackage(directory) {
  await stopWindowsPackage(directory)
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
