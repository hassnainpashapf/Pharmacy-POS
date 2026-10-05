!macro customInit
  StrCpy $R0 "0"
  StrCpy $R1 ""

  # 1. Check if executable exists in Program Files (64-bit)
  ${If} ${FileExists} "$PROGRAMFILES64\Optix MedSync\Optix MedSync.exe"
    StrCpy $R0 "1"
    StrCpy $R1 "$PROGRAMFILES64\Optix MedSync\Optix MedSync.exe"
  ${EndIf}

  # 2. Check if executable exists in Program Files (32-bit / standard)
  ${If} $R0 == "0"
    ${If} ${FileExists} "$PROGRAMFILES\Optix MedSync\Optix MedSync.exe"
      StrCpy $R0 "1"
      StrCpy $R1 "$PROGRAMFILES\Optix MedSync\Optix MedSync.exe"
    ${EndIf}
  ${EndIf}

  # 3. Check if executable exists in Local AppData Programs
  ${If} $R0 == "0"
    ${If} ${FileExists} "$LOCALAPPDATA\Programs\Optix MedSync\Optix MedSync.exe"
      StrCpy $R0 "1"
      StrCpy $R1 "$LOCALAPPDATA\Programs\Optix MedSync\Optix MedSync.exe"
    ${EndIf}
  ${EndIf}

  # 4. Check HKLM uninstall registry
  ${If} $R0 == "0"
    ReadRegStr $0 HKLM "${UNINSTALL_REGISTRY_KEY}" "InstallLocation"
    ${If} $0 != ""
      ${If} ${FileExists} "$0\Optix MedSync.exe"
        StrCpy $R0 "1"
        StrCpy $R1 "$0\Optix MedSync.exe"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  # 5. Check HKCU uninstall registry
  ${If} $R0 == "0"
    ReadRegStr $0 HKCU "${UNINSTALL_REGISTRY_KEY}" "InstallLocation"
    ${If} $0 != ""
      ${If} ${FileExists} "$0\Optix MedSync.exe"
        StrCpy $R0 "1"
        StrCpy $R1 "$0\Optix MedSync.exe"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  # 6. Check per-machine install folder from multiUser
  ${If} $R0 == "0"
    ${If} $hasPerMachineInstallation == "1"
      ${If} ${FileExists} "$perMachineInstallationFolder\Optix MedSync.exe"
        StrCpy $R0 "1"
        StrCpy $R1 "$perMachineInstallationFolder\Optix MedSync.exe"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  # 7. Check per-user install folder from multiUser
  ${If} $R0 == "0"
    ${If} $hasPerUserInstallation == "1"
      ${If} ${FileExists} "$perUserInstallationFolder\Optix MedSync.exe"
        StrCpy $R0 "1"
        StrCpy $R1 "$perUserInstallationFolder\Optix MedSync.exe"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  # If application is already installed, confirm with user
  ${If} $R0 == "1"
    ${IfNot} ${Silent}
      MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Optix MedSync pehle se installed hai!$\n$\nKya aap isko dobara install ya update karna chahte hain?$\n$\n• Yes: Reinstall ya Update karein$\n• No: Mojuda Optix MedSync open karein" IDYES proceed_with_install

      ${If} $R1 != ""
        ExecShell "" "$R1"
      ${EndIf}
      Quit

      proceed_with_install:
    ${EndIf}
  ${EndIf}
!macroend
