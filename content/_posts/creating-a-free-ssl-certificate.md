---
template: post
title: Creating a free SSL / TLS certificate.
description: In this post I explain how to use certbot to get a free Let's Encrypt SSL certificate.
date: 2021-07-23
author: Yendric
---

This tutorial expects you to have an nginx webserver running on a linux system compatible with certbot. The post is written for Debian systems, but will be analogous for other Linux based operating systems.

First of all, we need to install certbot, which we can do as follows. We immedately

> If you have a webserver running, it's best to stop it to prevent interferance with certbots automatic validation process (or use the flag specific to your webserver, like --nginx or --apache).

```bash
sudo apt install certbot
service nginx stop
```

After the installation we can immediately start creating certificates. Please replace 'domainname.be’ with your own domainname. Extra domainnames can be added using the -d flag. It's handy to log in to your domains DNS settings before running the command, as the instructions might ask to deploy a TXT record as a validation measure (unless you're using a webserver aided validation as noted above).

```
certbot certonly -d domainname.be
```

To create a wildcard (\*) certificate, you can run the following command. The resulting certificate will be valid for both the domain name itself as well as all direct subdomains.

```
certbot certonly --manual -d "*.domainname.be" -d domainname.be --preferred-challenges dns-01 --server https://acme-v02.api.letsencrypt.org/directory
```

You can manually renew your certificates using the following command:

```
certbot renew
```
