---
title: Hoe maak je een HTTP3 quic nginx server?
description: Deze korte guide toont hoe je de nieuwe versie van nginx met http3 module kan installeren en hoe je deze kan configureren.
date: 2023-06-27
author: Yendric
---

Heyhey!
Lang geleden dat ik nog eens een blogpost maakte, maar vandaag heb ik er weer eens zin in :)

In deze korte guide leg ik je uit je de nieuwe versie van nginx met http3 module kan installeren en hoe je deze kan configureren.
Ik gebruikt hiervoor Ubuntu 20.04, maar alles zou identiek moeten werken op andere Debian-derivaten.

## Nginx met http3 installeren

Check allereerst of je huidige installatie van nginx de http3 module al bevat, in dat geval kan je onderstaande stappen overslaan.
Om dit te checken doe je het volgende: `nginx -V` en check je of deze `--with-http_v3_module` bevat. Als dit niet het geval is zullen we de nieuwere versie moeten installeren.

Hiervoor moeten we een repository aan onze package manager toevoegen dat deze up-to-date versie bevat:

```
sudo add-apt-repository ppa:ondrej/nginx-mainline
```

Nadien updaten we de package index:

```
sudo apt update
```

en installeren we nginx:

```
sudo apt install nginx
```

> **_OPMERKING:_** Het gebruik van `http2` in het listen directive van server blocks is in deze nieuwe versie deprecated. Je kan dit weglaten en vervangen door het nieuwe `http2 on;` directive.

## Een server block met http3 maken

Ziezo, de nieuwe versie van nginx is geïnstalleerd.

Het maken van een serverblock is onveranderd gebleven. Je hebt een server block nodig met TLSv1.3. Indien je hierbij hulp nodig hebt, raadpleeg dan [deze blogpost](/nginx-server-blocks-maken/). Houd wel rekening met bovenstaande opmerking: `listen 443 ssl http2;` wordt `listen 443 ssl; http2 on;`

Nu moeten de listen directives voor http3 toegevoegd worden. Een voorbeeldconfiguratie zal er als volgt uitzien (zonder de +):

```
  listen 443 ssl;
+ listen 443 quic reuseport;
  listen [::]:443 ssl;
+ listen [::]:443 quic reuseport;
  http2 on;
```

Het `reuseport` gedeelte is van belang. Het zorgt ervoor dat zowel http2 als http3 op dezelfde poort kunnen runnen. Als je dit niet toevoegt zal in dit geval http3 niet werken.

> **_OPMERKING:_** `reuseport` mag maar één keer voor elke interface:poort combinatie gebruikt worden, vanaf dan geldt ze voor alle plaatsen waar deze combinatie gebruikt wordt. Je moet dit dus enkel doen in je eerste http3 block.

We moeten ook aan de browser vertellen dat deze server http3 gebruikt. Dit doen we met behulp van een header, die we ook in het server block toevoegen:

```
add_header Alt-Svc 'h3=":$server_port"; ma=86400'
```

Voor extra snelheid is het aangeraden het `ssl_early_data` directive op on te zeten:

```
ssl_early_data on;
```

Tot slot moeten we op de firewall UDP poort 443 openen, gezien http3 hiervan gebruik maakt (ipv enkel TCP 443 waar http2 van gebruik maakt). Indien je ufw gebruikt kan dit als volgt:

```
sudo ufw allow 443/udp
```

Nu zou je een werkende http3 webserver moeten hebben. Indien je nog vragen of opmerkingen hebt, laat deze dan zeker hieronder achter!
