# 简单的NSIS自定义脚本

# 安装前检查
Function .onInit
    # 检查是否已在运行
    System::Call 'kernel32::CreateMutexA(i 0, i 0, t "ClaudateMutex") i .r1 ?e'
    Pop $R0
    StrCmp $R0 0 +3
        MessageBox MB_OK|MB_ICONEXCLAMATION "安装程序已在运行！"
        Abort
FunctionEnd

# 卸载完成消息
Function un.onUninstSuccess
    HideWindow
    MessageBox MB_ICONINFORMATION|MB_OK "${PRODUCT_NAME} 已成功从您的计算机卸载。"
FunctionEnd