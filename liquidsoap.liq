#!/usr/bin/liquidsoap

# KULZZY RADIO AUDIO ENGINE

set("log.level", 3)

# LIVE PRESENTER CONNECTION
live = input.harbor(
    "KULZZY LIVE",
    port=8005,
    password="CHANGE_THIS_LIVE_PASSWORD",
    icy=true
)

# AUTOMATIC SILENCE WHEN NO PRESENTER IS CONNECTED
radio = fallback(
    track_sensitive=false,
    [live, blank()]
)

# SEND AUDIO TO ICECAST
output.icecast(
    %mp3(bitrate=128, stereo=true),
    host="127.0.0.1",
    port=8000,
    password="CHANGE_THIS_SOURCE_PASSWORD",
    mount="/kulzzy.mp3",
    name="KULZZY RADIO",
    description="CELEBRATING LIVES EVERYDAY",
    genre="Radio",
    radio
)
