# M3 · Lanza un proceso dentro de un AppContainer de Windows con un objeto de trabajo (Job Object) que limita la memoria y mata el árbol al cerrar.
#   powershell -NoProfile -File appcontainer.ps1 -Exe <ruta> -Arguments '<línea de órdenes sin el ejecutable>' -WorkDir <carpeta con escritura> `
#       -ReadDirs <carpeta1>,<carpeta2> -MemoryLimitMB 1024 -TimeoutSec 120 -ResultFile <json> [-Relay]
# Con -Relay, stdin y stdout del proceso confinado son tuberías anónimas que este script reenvía a su propia stdin/stdout (un worker persistente
# con protocolo por líneas); stderr sigue yendo a WorkDir\stderr.txt.
# Un AppContainer no tiene red (sin la capacidad internetClient) y solo ve los archivos cuyo ACL lo permite: se concede escritura a WorkDir y lectura a ReadDirs.
# stdout y stderr del proceso se redirigen a WorkDir\stdout.txt y WorkDir\stderr.txt. Escribe en ResultFile {exitCode, timedOut, sid, ...}.
param(
  [Parameter(Mandatory)][string]$Exe,
  [Parameter(Mandatory)][string]$Arguments,
  [Parameter(Mandatory)][string]$WorkDir,
  [string[]]$ReadDirs = @(),
  [int]$MemoryLimitMB = 0,
  [int]$TimeoutSec = 120,
  [Parameter(Mandatory)][string]$ResultFile,
  [string[]]$ExtraEnv = @(),
  [string]$ProfileName = 'freyalab.m3.helper',
  [switch]$Relay
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.IO;
using Microsoft.Win32.SafeHandles;

public static class FreyaAppContainer
{
    const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
    const uint CREATE_SUSPENDED = 0x00000004;
    const uint CREATE_NO_WINDOW = 0x08000000;
    const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
    const int PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES = 0x00020009;
    const uint STARTF_USESTDHANDLES = 0x00000100;
    const uint GENERIC_READ = 0x80000000, GENERIC_WRITE = 0x40000000, FILE_SHARE_READ = 1, FILE_SHARE_WRITE = 2, CREATE_ALWAYS = 2, OPEN_EXISTING = 3;
    const uint JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    const int JobObjectExtendedLimitInformation = 9;
    const uint WAIT_TIMEOUT = 0x102;
    const uint HANDLE_FLAG_INHERIT = 1;

    [StructLayout(LayoutKind.Sequential)] struct SECURITY_CAPABILITIES { public IntPtr AppContainerSid; public IntPtr Capabilities; public uint CapabilityCount; public uint Reserved; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO { public int cb; public string lpReserved; public string lpDesktop; public string lpTitle; public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute; public uint dwFlags; public short wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError; }
    [StructLayout(LayoutKind.Sequential)] struct STARTUPINFOEX { public STARTUPINFO StartupInfo; public IntPtr lpAttributeList; }
    [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }
    [StructLayout(LayoutKind.Sequential)] struct SECURITY_ATTRIBUTES { public int nLength; public IntPtr lpSecurityDescriptor; [MarshalAs(UnmanagedType.Bool)] public bool bInheritHandle; }
    [StructLayout(LayoutKind.Sequential)] struct JOBOBJECT_BASIC_LIMIT_INFORMATION { public long PerProcessUserTimeLimit, PerJobUserTimeLimit; public uint LimitFlags; public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass, SchedulingClass; }
    [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS { public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount; }
    [StructLayout(LayoutKind.Sequential)] struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION { public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation; public IO_COUNTERS IoInfo; public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed; }

    [DllImport("userenv.dll", CharSet = CharSet.Unicode)] static extern int CreateAppContainerProfile(string name, string displayName, string description, IntPtr capabilities, uint capabilityCount, out IntPtr sid);
    [DllImport("userenv.dll", CharSet = CharSet.Unicode)] static extern int DeriveAppContainerSidFromAppContainerName(string name, out IntPtr sid);
    [DllImport("userenv.dll", CharSet = CharSet.Unicode)] static extern int DeleteAppContainerProfile(string name);
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool ConvertSidToStringSid(IntPtr sid, out string text);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr h);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool CreateProcessW(string app, StringBuilder commandLine, IntPtr processAttrs, IntPtr threadAttrs, [MarshalAs(UnmanagedType.Bool)] bool inheritHandles, uint flags, IntPtr environment, string currentDirectory, ref STARTUPINFOEX startup, out PROCESS_INFORMATION info);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern IntPtr CreateFileW(string name, uint access, uint share, ref SECURITY_ATTRIBUTES attrs, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObjectW(IntPtr attrs, string name);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, int size);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll", SetLastError = true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr handle, uint ms);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool CreatePipe(out IntPtr read, out IntPtr write, ref SECURITY_ATTRIBUTES attrs, uint size);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetHandleInformation(IntPtr h, uint mask, uint flags);

    public static string EnsureProfile(string name)
    {
        IntPtr sid;
        int hr = CreateAppContainerProfile(name, name, "FreyaLab M3 experiment", IntPtr.Zero, 0, out sid);
        if (hr != 0) { Marshal.ThrowExceptionForHR(DeriveAppContainerSidFromAppContainerName(name, out sid)); }
        string text; if (!ConvertSidToStringSid(sid, out text)) throw new Win32Exception();
        return text;
    }

    public static void RemoveProfile(string name) { DeleteAppContainerProfile(name); }

    static IntPtr Open(string path, uint access, uint disposition)
    {
        var sa = new SECURITY_ATTRIBUTES { nLength = Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)), bInheritHandle = true };
        IntPtr h = CreateFileW(path, access, FILE_SHARE_READ | FILE_SHARE_WRITE, ref sa, disposition, 0, IntPtr.Zero);
        if (h == new IntPtr(-1)) throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateFile " + path);
        return h;
    }

    // Devuelve {exitCode, timedOut}. env: pares KEY=VALUE que se añaden al bloque de entorno heredado.
    public static string Run(string sidText, string exe, string arguments, string workDir, string stdoutPath, string stderrPath, string[] extraEnv, int memoryLimitMB, int timeoutSec, bool relay)
    {
        IntPtr sid; ConvertStringSidToSidW(sidText, out sid);
        var caps = new SECURITY_CAPABILITIES { AppContainerSid = sid, Capabilities = IntPtr.Zero, CapabilityCount = 0, Reserved = 0 };
        IntPtr capsPtr = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(SECURITY_CAPABILITIES)));
        Marshal.StructureToPtr(caps, capsPtr, false);
        IntPtr size = IntPtr.Zero;
        InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref size);
        IntPtr list = Marshal.AllocHGlobal(size);
        if (!InitializeProcThreadAttributeList(list, 1, 0, ref size)) throw new Win32Exception();
        if (!UpdateProcThreadAttribute(list, 0, new IntPtr(PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES), capsPtr, new IntPtr(Marshal.SizeOf(typeof(SECURITY_CAPABILITIES))), IntPtr.Zero, IntPtr.Zero)) throw new Win32Exception();

        var si = new STARTUPINFOEX();
        si.StartupInfo.cb = Marshal.SizeOf(typeof(STARTUPINFOEX));
        si.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
        IntPtr parentWrite = IntPtr.Zero, parentRead = IntPtr.Zero, childIn = IntPtr.Zero, childOut = IntPtr.Zero;
        if (relay)
        {
            var pipeAttrs = new SECURITY_ATTRIBUTES { nLength = Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)), bInheritHandle = true };
            if (!CreatePipe(out childIn, out parentWrite, ref pipeAttrs, 0)) throw new Win32Exception(Marshal.GetLastWin32Error(), "CreatePipe stdin");
            if (!CreatePipe(out parentRead, out childOut, ref pipeAttrs, 0)) throw new Win32Exception(Marshal.GetLastWin32Error(), "CreatePipe stdout");
            SetHandleInformation(parentWrite, HANDLE_FLAG_INHERIT, 0); SetHandleInformation(parentRead, HANDLE_FLAG_INHERIT, 0);
            si.StartupInfo.hStdInput = childIn; si.StartupInfo.hStdOutput = childOut;
        }
        else
        {
            si.StartupInfo.hStdInput = Open("NUL", GENERIC_READ, OPEN_EXISTING);
            si.StartupInfo.hStdOutput = Open(stdoutPath, GENERIC_WRITE, CREATE_ALWAYS);
        }
        si.StartupInfo.hStdError = Open(stderrPath, GENERIC_WRITE, CREATE_ALWAYS);
        si.lpAttributeList = list;

        // Entorno: el del proceso actual con TEMP/TMP apuntando a la carpeta de trabajo y las variables extra.
        var env = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (System.Collections.DictionaryEntry e in Environment.GetEnvironmentVariables()) env[(string)e.Key] = (string)e.Value;
        env["TEMP"] = workDir; env["TMP"] = workDir;
        foreach (var pair in extraEnv) { int i = pair.IndexOf('='); if (i > 0) env[pair.Substring(0, i)] = pair.Substring(i + 1); }
        var block = new StringBuilder();
        foreach (var kv in env) block.Append(kv.Key).Append('=').Append(kv.Value).Append('\0');
        block.Append('\0');
        IntPtr envPtr = Marshal.StringToHGlobalUni(block.ToString());

        IntPtr job = CreateJobObjectW(IntPtr.Zero, null);
        var limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | (memoryLimitMB > 0 ? JOB_OBJECT_LIMIT_PROCESS_MEMORY : 0);
        if (memoryLimitMB > 0) limits.ProcessMemoryLimit = new UIntPtr((ulong)memoryLimitMB * 1024UL * 1024UL);
        int limitsSize = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
        IntPtr limitsPtr = Marshal.AllocHGlobal(limitsSize);
        Marshal.StructureToPtr(limits, limitsPtr, false);
        if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, limitsPtr, limitsSize)) throw new Win32Exception(Marshal.GetLastWin32Error(), "SetInformationJobObject");

        var command = new StringBuilder("\"" + exe + "\" " + arguments);
        PROCESS_INFORMATION pi;
        if (!CreateProcessW(exe, command, IntPtr.Zero, IntPtr.Zero, true, EXTENDED_STARTUPINFO_PRESENT | CREATE_SUSPENDED | CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT, envPtr, workDir, ref si, out pi))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateProcess");
        if (!AssignProcessToJobObject(job, pi.hProcess)) { int err = Marshal.GetLastWin32Error(); TerminateJobObject(job, 1); throw new Win32Exception(err, "AssignProcessToJobObject"); }
        ResumeThread(pi.hThread);
        Thread pumpOut = null;
        if (relay)
        {
            CloseHandle(childIn); CloseHandle(childOut); // el padre solo conserva sus extremos: así se detecta el cierre del hijo
            var pumpIn = new Thread(() => { try { using (var src = Console.OpenStandardInput()) using (var dst = new FileStream(new SafeFileHandle(parentWrite, true), FileAccess.Write, 1, false)) { var buf = new byte[65536]; int n; while ((n = src.Read(buf, 0, buf.Length)) > 0) { dst.Write(buf, 0, n); dst.Flush(); } } } catch { } });
            pumpIn.IsBackground = true; pumpIn.Start();
            pumpOut = new Thread(() => { try { using (var src = new FileStream(new SafeFileHandle(parentRead, true), FileAccess.Read, 1, false)) using (var dst = Console.OpenStandardOutput()) { var buf = new byte[65536]; int n; while ((n = src.Read(buf, 0, buf.Length)) > 0) { dst.Write(buf, 0, n); dst.Flush(); } } } catch { } });
            pumpOut.IsBackground = true; pumpOut.Start();
        }
        bool timedOut = WaitForSingleObject(pi.hProcess, (uint)(timeoutSec * 1000)) == WAIT_TIMEOUT;
        if (timedOut) TerminateJobObject(job, 1);
        uint code; GetExitCodeProcess(pi.hProcess, out code);
        if (pumpOut != null) pumpOut.Join(3000);
        CloseHandle(pi.hThread); CloseHandle(pi.hProcess); CloseHandle(job);
        DeleteProcThreadAttributeList(list);
        return code + "|" + (timedOut ? "1" : "0");
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool ConvertStringSidToSidW(string text, out IntPtr sid);
}
'@
# Con -File, una lista separada por comas llega como UNA cadena: se separa aquí.
$ReadDirs = @($ReadDirs | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$ExtraEnv = @($ExtraEnv | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$sid = [FreyaAppContainer]::EnsureProfile($ProfileName)
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
$grants = @()
$grantTimer = [Diagnostics.Stopwatch]::StartNew()
# icacls escribe en stderr si algo falla: con ErrorActionPreference=Stop eso sería terminante, así que cada concesión se registra con su código de salida.
# Si la concesión ya existe (p. ej. de un arranque anterior o del instalador) no se repite: icacls recorre todo el árbol y una carpeta de Node con npm tarda más de 90 s.
function HasGrant($dir, $who) {
  try { foreach ($rule in (Get-Acl -LiteralPath $dir).Access) { if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -eq $who) { return $true } } } catch { }
  return $false
}
function Grant($dir, $who, $permission, $label, $inherit) {
  $timer = [Diagnostics.Stopwatch]::StartNew()
  if ($who -ne $sid -and (HasGrant $dir $who)) { $script:grants += "$label $dir => ya concedido"; return }
  try { $text = (& icacls $dir /grant "*${who}:${inherit}($permission)" 2>&1 | Out-String).Trim(); $script:grants += "$label $dir => $LASTEXITCODE ($([int]$timer.Elapsed.TotalMilliseconds) ms)$(if ($LASTEXITCODE -ne 0) { ' ' + $text })" }
  catch { $script:grants += "$label $dir => error $($_.Exception.Message)" }
}
# Escritura en la carpeta de trabajo: solo para ESTE AppContainer.
Grant $WorkDir $sid 'M' 'escritura' '(OI)(CI)'
# Lectura de los programas: a «TODOS LOS PAQUETES DE APLICACIÓN» (S-1-15-2-1), como Archivos de programa. Conceder solo el SID de este paquete hace que Electron >= 44
# se niegue a arrancar («its ACL has an entry for an AppContainer package SID but none for ALL APPLICATION PACKAGES»).
$AAP = 'S-1-15-2-1'
$ancestors = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($dir in $ReadDirs) {
  if (-not $dir -or -not (Test-Path -LiteralPath $dir)) { $grants += "lectura $dir => no existe en disco"; continue }
  Grant $dir $AAP 'RX' 'lectura' $(if (Test-Path -LiteralPath $dir -PathType Container) { '(OI)(CI)' } else { '' })
}
# Node resuelve la ruta real con lstat de cada componente desde la raíz de la unidad; un AppContainer no puede ni leer los atributos de «D:\» ni de sus carpetas.
# Se concede lectura SOLO a la carpeta (sin herencia) en cada ancestro de lo que se lee y de la carpeta de trabajo.
foreach ($path in @($ReadDirs) + @($WorkDir)) {
  if (-not $path) { continue }
  $parent = [System.IO.Path]::GetDirectoryName($path)
  while ($parent) { [void]$ancestors.Add($parent); $parent = [System.IO.Path]::GetDirectoryName($parent) }
}
foreach ($ancestor in $ancestors) { if (Test-Path -LiteralPath $ancestor -PathType Container) { Grant $ancestor $AAP 'RX' 'travesia' '' } }
$grantTimer.Stop()
$stdout = Join-Path $WorkDir 'stdout.txt'; $stderr = Join-Path $WorkDir 'stderr.txt'
$sw = [Diagnostics.Stopwatch]::StartNew()
try { $raw = [FreyaAppContainer]::Run($sid, $Exe, $Arguments, $WorkDir, $stdout, $stderr, $ExtraEnv, $MemoryLimitMB, $TimeoutSec, [bool]$Relay); $parts = $raw.Split('|'); $result = @{ exitCode = [uint32]$parts[0]; timedOut = ($parts[1] -eq '1'); error = $null } }
catch { $result = @{ exitCode = $null; timedOut = $false; error = $_.Exception.Message } }
$result.grants = $grants; $result.grantsSeconds = [math]::Round($grantTimer.Elapsed.TotalSeconds, 2); $result.sid = $sid; $result.seconds = [math]::Round($sw.Elapsed.TotalSeconds, 2); $result.memoryLimitMB = $MemoryLimitMB
$result | ConvertTo-Json | Set-Content -Encoding UTF8 -Path $ResultFile
[FreyaAppContainer]::RemoveProfile($ProfileName)
