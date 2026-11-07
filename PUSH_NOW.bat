@echo off
echo ============================================
echo  PUSHING ALPHA PHARMACY UPDATES TO GITHUB / VERCEL
echo ============================================
cd /d "E:\Res Pos\AlphaPharmacy"
git push origin main
echo ============================================
echo  DONE! Check Vercel in ~1 minute:
echo  - https://pharmacy-sage-seven.vercel.app/dashboard/purchases
echo  - https://pharmacy-sage-seven.vercel.app/dashboard/sales
echo ============================================
pause
