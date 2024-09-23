---
template: post
title: First thing to do when something doesn't work on Windows
description: In this post I explain how you can use the DISM and sfc tools to solve problems with your Windows installation.
date: 2021-07-24
author: Yendric
---

In this post I explain how you can use the DISM and sfc tools to solve problems with your Windows installation.

First of all, did you reboot your PC? No but did you really? Because just turning it off and on again won't always suffise, as things like fast startup cause this not to do a full reboot.

Alright now that that's settled, let's get to what I wanted to show you today:

1. First, you need to open cmd.exe as administrator.
2. Then use the Deployment Image Servicing and Management tool as follows:  
   `DISM.exe /Online /Cleanup-image /Restorehealth`

    This will check and repair the Windows component store. This store holds cached copies of several important windows system files.

3. After running DISM we can try to repair said system files using the System File Checker:  
   `sfc /scannow`

Then you can try doing another reboot just to be sure. If your problem still isn't fixed, you're going to have to do some more research into the exact issue you're having.

Leave your Windows problem solving tips below!
