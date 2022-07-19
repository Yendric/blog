---
title: Het eerste wat je moet doen als er iets niet werkt op je pc
date: 2021-07-23
author: Yendric
---

In deze blogpost leg ik uit hoe je sfc /scannow kan gebruiken om problemen op een windows computer op te lossen.

Oeps gelogen! Het allereerste dat je moet doen is natuurlijk je computer herstarten. Nadien kan je het volgende proberen:

1. Open cmd.exe als administrator.
2. Gebruik eerst de Deployment Image Servicing and Management tool als volgt:  
   `DISM.exe /Online /Cleanup-image /Restorehealth`
3. Nadien doe je dit:  
   `sfc /scannow`

Dat was het 🙂
