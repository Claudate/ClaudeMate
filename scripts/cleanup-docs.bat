@echo off
echo ====================================
echo 清理重复的文档文件
echo ====================================
echo.

echo 正在删除重复文件...
echo.

if exist "START_HERE.md" (
    del "START_HERE.md"
    echo [OK] 已删除 START_HERE.md
) else (
    echo [SKIP] START_HERE.md 不存在
)

if exist "HOW_TO_START.md" (
    del "HOW_TO_START.md"
    echo [OK] 已删除 HOW_TO_START.md
) else (
    echo [SKIP] HOW_TO_START.md 不存在
)

if exist "FINAL_SUMMARY.md" (
    del "FINAL_SUMMARY.md"
    echo [OK] 已删除 FINAL_SUMMARY.md
) else (
    echo [SKIP] FINAL_SUMMARY.md 不存在
)

if exist "DEVELOPMENT_STARTED.md" (
    del "DEVELOPMENT_STARTED.md"
    echo [OK] 已删除 DEVELOPMENT_STARTED.md
) else (
    echo [SKIP] DEVELOPMENT_STARTED.md 不存在
)

if exist "PROJECT_SUMMARY.md" (
    del "PROJECT_SUMMARY.md"
    echo [OK] 已删除 PROJECT_SUMMARY.md
) else (
    echo [SKIP] PROJECT_SUMMARY.md 不存在
)

echo.
echo ====================================
echo 文档清理完成！
echo ====================================
echo.
echo 保留的核心文档：
echo - README.md (项目主文档)
echo - QUICKSTART.md (快速开始 - 已整合)
echo - SETUP.md (环境设置)
echo - ARCHITECTURE.md (架构设计)
echo - IMPLEMENTATION_GUIDE.md (实现指南)
echo - INDEXEDDB_INTEGRATION.md (数据库集成)
echo - docs/ (专题文档目录)
echo.
pause
