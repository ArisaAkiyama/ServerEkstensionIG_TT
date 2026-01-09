; Inno Setup Script for Media Downloader Server
; This script creates a Windows installer with bundled Node.js

#define MyAppName "Media Downloader Server"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Media Downloader"
#define MyAppExeName "MediaDownloaderServer.exe"

[Setup]
; NOTE: The value of AppId uniquely identifies this application.
AppId={{B8F3D2E1-4A5C-6B7D-8E9F-0A1B2C3D4E5F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
; Output settings
OutputDir=installer_output
OutputBaseFilename=MediaDownloaderSetup
; Use the cloud icon
SetupIconFile=icon\cloud.ico
; Compression
Compression=lzma2/ultra64
SolidCompression=yes
; UI settings
WizardStyle=modern
; Privileges
PrivilegesRequired=admin
; Uninstall icon
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Files]
; Main executable
Source: "MediaDownloaderServer.exe"; DestDir: "{app}"; Flags: ignoreversion
; Server files
Source: "server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: ".env"; DestDir: "{app}"; Flags: ignoreversion
; Directories
Source: "routes\*"; DestDir: "{app}\routes"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "icon\*"; DestDir: "{app}\icon"; Flags: ignoreversion recursesubdirs createallsubdirs
; Sub-projects (Required for routes)
Source: "ProjectDownloaderIG\*"; DestDir: "{app}\ProjectDownloaderIG"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "ProjectDownloaderTT\*"; DestDir: "{app}\ProjectDownloaderTT"; Flags: ignoreversion recursesubdirs createallsubdirs
; Bundled Node.js - PORTABLE VERSION
Source: "nodejs\node.exe"; DestDir: "{app}\nodejs"; Flags: ignoreversion
Source: "nodejs\node_modules\*"; DestDir: "{app}\nodejs\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "nodejs\npm"; DestDir: "{app}\nodejs"; Flags: ignoreversion
Source: "nodejs\npm.cmd"; DestDir: "{app}\nodejs"; Flags: ignoreversion
Source: "nodejs\npx"; DestDir: "{app}\nodejs"; Flags: ignoreversion
Source: "nodejs\npx.cmd"; DestDir: "{app}\nodejs"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon\cloud.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon\cloud.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop server before uninstall
Filename: "taskkill"; Parameters: "/F /IM node.exe"; Flags: runhidden
Filename: "taskkill"; Parameters: "/F /IM MediaDownloaderServer.exe"; Flags: runhidden
