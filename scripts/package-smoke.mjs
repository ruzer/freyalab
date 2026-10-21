import { readdir, mkdtemp, mkdir, cp, stat, writeFile, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const release = resolve('release')
const temp = await mkdtemp(join(tmpdir(), 'freyalab-package-'))
const results = []
const files = await readdir(release)
const run = (file, args, options = {}) => execFileSync(file, args, { stdio: 'inherit', timeout: 600_000, ...options })
const smoke = executable => {
  run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], { env: { ...process.env, FREYALAB_EXECUTABLE: executable } })
}
const linuxSandbox = async folder => {
  const helper = join(folder, 'chrome-sandbox')
  if (process.env.CI === 'true') {
    await stat(helper)
    run('sudo', ['chown', 'root:root', helper])
    run('sudo', ['chmod', '4755', helper])
  }
}
try {
  if (process.platform === 'darwin') {
    const images = files.filter(name => name.endsWith('.dmg'))
    if (!images.length) throw new Error('Missing DMG')
    for (const name of images) {
      const mount = join(temp, 'mount')
      await mkdir(mount, { recursive: true })
      run('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, join(release, name)])
      let install
      try {
        const app = (await readdir(mount)).find(value => value.endsWith('.app'))
        if (!app) throw new Error('DMG contains no application')
        install = join(temp, 'installed', app)
        await cp(join(mount, app), install, { recursive: true, verbatimSymlinks: true })
      } finally { run('hdiutil', ['detach', mount]) }
      smoke(join(install, 'Contents', 'MacOS', 'FreyaLab'))
      results.push({ artifact: name, extractionOrInstallation: 'passed: copied application with preserved symlinks; source DMG detached before launch', packagedExecution: 'passed', userGatekeeperTest: 'pending manual check; no commercial signature/notarization' })
    }
  } else if (process.platform === 'win32') {
    const installers = files.filter(name => name.endsWith('.exe') && !name.toLowerCase().includes('uninstall'))
    if (!installers.length) throw new Error('Missing NSIS installer')
    for (const name of installers) {
      const install = join(temp, 'installed')
      run(join(release, name), ['/S', `/D=${install}`])
      const executable = join(install, 'FreyaLab.exe')
      await stat(executable)
      smoke(executable)
      const uninstall = (await readdir(install)).find(value => /^uninstall.*\.exe$/i.test(value))
      if (!uninstall) throw new Error('Missing uninstaller')
      run(join(install, uninstall), ['/S'])
      results.push({ artifact: name, extractionOrInstallation: 'passed: silent installation and uninstallation in temporary directory', packagedExecution: 'passed', userSmartScreenTest: 'pending manual check; unsigned alpha' })
    }
  } else if (process.platform === 'linux') {
    const image = files.find(name => name.endsWith('.AppImage'))
    const deb = files.find(name => name.endsWith('.deb'))
    if (!image || !deb) throw new Error('Expected AppImage and DEB')
    run(join(release, image), ['--appimage-extract'], { cwd: temp })
    const extracted = join(temp, 'squashfs-root')
    await linuxSandbox(extracted)
    smoke(join(extracted, 'freyalab'))
    results.push({ artifact: image, extractionOrInstallation: 'passed: AppImage extraction', packagedExecution: 'passed', desktopIntegration: 'pending manual desktop check' })
    if (process.env.CI !== 'true') throw new Error('DEB installation runs only on disposable CI runners; run the candidate workflow')
    run('sudo', ['apt-get', 'install', '-y', join(release, deb)])
    try {
      smoke('/opt/FreyaLab/freyalab')
      results.push({ artifact: deb, extractionOrInstallation: 'passed: apt installation', packagedExecution: 'passed', desktopIntegration: 'pending manual desktop check' })
    } finally { run('sudo', ['apt-get', 'remove', '-y', 'freyalab']) }
  } else throw new Error(`Unsupported platform ${process.platform}`)
} finally {
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/package-smoke.json', JSON.stringify({ platform: process.platform, arch: process.arch, results, completedAt: new Date().toISOString() }, null, 2))
  await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
