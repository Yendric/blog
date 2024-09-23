---
template: post
title: Using nginx with HTTP3 Quic
description: This short guide shows you how you can install the new nginx version with http3 module and configure it.
date: 2023-06-27
author: Yendric
---

Hello there!
It's been a while since I wrote a blog post, but today I was feeling it again.

This short guide shows you how you can install the new nginx version with http3 module and configure it. I used ubuntu 22.04, but it should work identically on other debian systems.

## Installing nginx with http3

First of all you need to check if your current nginx install was compiled with the http3 module. If this is the case you can skip the steps below.

To check this you need to run `nginx -V` and check if it contains `--with-http_v3_module`. If this is not the case we will install it.

To do this we need to add the nginx repository containing the updated version to our package manager.

```bash
sudo add-apt-repository ppa:ondrej/nginx-mainline
```

Then we update the package index:

```bash
sudo apt update
```

and install nginx:

```bash
sudo apt install nginx
```

> **NOTE:** The use of `http2` in the listen directive of server blocks is deprecated in this new version. You can omit it and replace it with the new `http2 on;` directive.

## Creating a server block with http3

Creation of a server block has remained unchanged. You need a server block with TLSv1.3, if you need help with this, please visit [this blogpost](/creating-nginx-server-blocks/). Keep in mind that: `listen 443 ssl http2;` becomes `listen 443 ssl; http2 on;`

Now we need to add the listen directives for http3. This can look as follows:

```diff
  listen 443 ssl;
+ listen 443 quic reuseport;
  listen [::]:443 ssl;
+ listen [::]:443 quic reuseport;
  http2 on;
```

> **NOTE:** `reuseport` can only be used once per interface:poort combination.

We also need to instruct the client that the server is capable of http3. We do this using a header, which we can add to our server block:

```nginx
add_header Alt-Svc 'h3=":$server_port"; ma=86400'
```

For extra performance you can enable the `ssl_early_data` directive:

```nginx
ssl_early_data on;
```

Finally we need to open UDP port 443 on the firewall, as http3 uses this (instead of only TCP 443 like http2). For ufw you can do this as follows:

```bash
sudo ufw allow 443/udp
```

You should now have a working http3 webserver. If you have questions or remarks, let them know below.
