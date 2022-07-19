---
title: Hoe maak je een gratis SSL certificaat?
date: 2021-07-23
author: Yendric
---

Deze tutorial gaat ervan uit dat je een nginx webserver hebt lopen op een linuxsysteem. Hier is Ubuntu 20.04 gebruikt.

Om een gratis ssl certificaat te maken maken we gebruik van certbot, om dit te installeren doe je het volgende:

```
sudo apt install certbot
service nginx stop
```

Na de installatie kunnen we meteen beginnen, je kan ‘domeinnaam.be’ vervangen door jouw domeinnaam en domeinnamen toevoegen met -d.

```
certbot certonly -d domeinnaam.be
service nginx start
```

Om een wildcard (\*) certificaat te maken doe je het volgende:

```
certbot certonly --manual -d "*.domeinnaam.be" -d domeinnaam.be --preferred-challenges dns-01 --server https://acme-v02.api.letsencrypt.org/directory
service nginx start
```

Om je ssl certificaten te verlengen doe je het volgende:

```
certbot renew
```
