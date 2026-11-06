#!/bin/sh
set -eu

: "${ICECAST_SOURCE_PASSWORD:?Missing ICECAST_SOURCE_PASSWORD}"
: "${ICECAST_ADMIN_PASSWORD:?Missing ICECAST_ADMIN_PASSWORD}"
: "${BROADCAST_PASSWORD:?Missing BROADCAST_PASSWORD}"

sed "s|CHANGE_THIS_SOURCE_PASSWORD|${ICECAST_SOURCE_PASSWORD}|g; s|CHANGE_THIS_ADMIN_PASSWORD|${ICECAST_ADMIN_PASSWORD}|g" /etc/icecast2/icecast.xml > /tmp/icecast.xml

icecast2 -c /tmp/icecast.xml &

cd /app/live-engine
exec node Server.js
