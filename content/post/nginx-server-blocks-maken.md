---
title: Nginx server blocks maken
description: Deze guide toont hoe je een nginx server block maakt voor een PHP 8.1 applicatie.
date: 2021-07-23
author: Yendric
---

Deze guide toont hoe je een nginx server block maakt voor een PHP applicatie. Ik ga ervanuit dat PHP8.1 al geïnstalleerd is en je een [geldig SSL certificaat](/hoe-maak-je-een-gratis-ssl-certificaat/) hebt.

Plaats het volgende in `/etc/nginx/sites-available/<website>.conf`

```
server {
    listen 80;
    listen [::]:80;
    server_name <website>;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name <website>;

    root /var/www/<website>;
    index index.php;

    access_log /var/log/nginx/<website>.app-access.log;
    error_log  /var/log/nginx/<website>.app-error.log error;

    # Uploads en script execution times
    client_max_body_size 100m;
    client_body_timeout 120s;

    sendfile off;

    # SSL
    ssl_certificate /etc/letsencrypt/live/<website>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<website>/privkey.pem;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384";
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=15768000; preload;";
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Content-Security-Policy "frame-ancestors 'self'";
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy same-origin;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param PHP_VALUE "upload_max_filesize = 100M \n post_max_size=100M";
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param HTTP_PROXY "";
        fastcgi_intercept_errors off;
        fastcgi_buffer_size 16k;
        fastcgi_buffers 4 16k;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_read_timeout 300;
        include /etc/nginx/fastcgi_params;
    }

    location ~ /\.ht {
        deny all;
    }
}
```

Het is handig om je sites-available aan je sites-enabled te linken.
Om dat te doen doe je het volgende:

```
sudo ln -s /etc/nginx/sites-available/<website>.conf /etc/nginx/sites-enabled/<website>.conf
```

Tenslotte raad ik je aan om `server_tokens `in `nginx.conf` op `off `te zetten. Dit zorgt ervoor dat je nginx versie niet getoond wordt in je HTTP headers.
