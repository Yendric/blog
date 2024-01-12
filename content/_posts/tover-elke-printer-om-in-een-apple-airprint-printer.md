---
template: post
title: Tover elke printer om in een Apple AirPrint printer
description: Deze guide toont hoe je elke printer kan omtoveren tot Apple Airprint printer.
date: 2021-07-23
author: Yendric
---

Om te beginnen moet je printer verbonden zijn aan een Windows computer. Op deze computer moet je de printer delen op het netwerk:

1. Open instellingen en klik op **apparaten**
2. Klik op de gewenste printer  
   ![Printer instellingen](/assets/img/instellingen-printer.webp)
3. Klik op **printereigenschappen**
4. Open het tabblad **delen** en deel de printer  
   ![Printer eigenschappen](/assets/img/printer-eigenschappen.png)

Als je geen iTunes hebt, moet je Bonjour Print Services downloaden van: <https://support.apple.com/kb/DL999>

Download vervolgens [dit bestand](/assets/uploads/airprint_installer.exe) en extract het.
<sub><sup>Ik ben niet verantwoordelijk voor mogelijke schade die deze software aanricht. Software is gemaakt door www.elpamsoft.com.</sup></sub>

1. Start “AirPrint_Installer.exe” en klik vervolgens op “Install AirPrint Service”.  
   ![Airprint installer](/assets/img/airprint-installer.webp)
2. Voer Registry fix.reg uit
3. Keer terug naar “AirPrint_Installer.exe” en zorg ervoor dat “Service Startup” op “Auto” staat en druk op “Start”
4. Herstart je computer

Klaar! Je kan nu draadloos afdrukken vanaf Apple toestellen op je printer. (De computer met AirPrint moet wel aanstaan)

Laat je vragen achter in de comments!
