#define MyAppName "XXXECUTIVE"
#define MyAppVersion "1.0.1"
#define MyPublisher "BABEWARE"
#define MyAppExeName "XXXECUTIVE.exe"
#define MySourceDir AddBackslash(SourcePath) + "XXXECUTIVE_PORTABLE"

[Setup]
AppId={{A4B82A67-744A-4D17-AD4A-9F3D87C34171}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyPublisher}
DefaultDirName={autopf}\BABEWARE\XXXECUTIVE
DefaultGroupName=BABEWARE\XXXECUTIVE
OutputDir=Installer_Output
OutputBaseFilename=XXXECUTIVE_Setup_v1.0.1_CONSUMER
Compression=lzma2
SolidCompression=yes
WizardStyle=modern dark
WizardImageBackColor=#100810
SetupIconFile={#MySourceDir}\resources\app\babeware-assets\mascot.ico
UninstallDisplayIcon={app}\XXXECUTIVE.exe
VersionInfoVersion=1.0.1.0
VersionInfoProductVersion=1.0.1.0
VersionInfoProductName=XXXECUTIVE
VersionInfoDescription=XXXECUTIVE Setup
PrivilegesRequired=admin
CloseApplications=yes
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
Source: "{#MySourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\XXXECUTIVE"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\resources\app\babeware-assets\mascot.ico"
Name: "{autodesktop}\XXXECUTIVE"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\resources\app\babeware-assets\mascot.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch XXXECUTIVE"; Flags: nowait postinstall skipifsilent
