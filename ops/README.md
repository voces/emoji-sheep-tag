# Deploy config

Each deploy installs these files on the prod box through w3xio's root-owned
installer (`w3xio/ops/install_app_config.py`), which validates them first and
reloads only what changed:

- `emojist.service` → `/etc/systemd/system/emojist.service`
- `nginx/est.w3x.io.conf` → `/etc/nginx/sites-enabled/est.w3x.io.conf`

The installer rejects units that run as anyone but `ubuntu` or use keys outside
its allowlist, and sites that make nginx open files outside `/var/log/nginx` and
`/etc/letsencrypt`. Check its rules before adding directives here.

Secrets stay out of the repo. The unit loads them from `/etc/emojist/env`
(root-owned, 0600); `emojist.env.example` lists the keys.
