!include "nsProcess.nsh"

!macro customUnInit
  nsProcess::FindProcess "${PRODUCT_FILENAME}.exe" $R0
  ${If} $R0 == 0
    MessageBox MB_ICONQUESTION|MB_YESNO "检测到程序正在运行。是否强制退出并继续卸载？" IDYES kill IDNO stop
    kill:
      nsProcess::KillProcess "${PRODUCT_FILENAME}.exe" $R0
      Sleep 1000
      Goto end
    stop:
      Abort
    end:
  ${EndIf}
!macroend
