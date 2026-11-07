@echo off
cd /d "E:\Res Pos\AlphaPharmacy"
echo === Staging all changes ===
git add src/app/dashboard/layout.tsx src/app/dashboard/products/page.tsx
echo === Committing ===
git commit -m "fix(ui): exact mockup replica - remove double header, realistic pharma packaging thumbnails, populated categories sidebar, crisp table headers and circular actions"
echo === Pushing to origin ===
git push origin main
echo.
echo ========================================================
echo   DONE! Changes pushed to GitHub!
echo   Vercel will auto-deploy in 1-2 minutes.
echo ========================================================
pause
