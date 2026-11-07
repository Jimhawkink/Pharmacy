@echo off
cd /d "E:\Res Pos\AlphaPharmacy"
echo === Staging all changes ===
git add -A
echo === Committing ===
git commit -m "feat: Premium Products page UI - exact mockup replica with live data, KPI cards, category sidebar, product table, pagination, stock alerts, inventory gauge, quick actions, and all modals"
echo === Pushing to origin ===
git push origin main
echo.
echo === DONE! Check Vercel for deployment ===
pause
