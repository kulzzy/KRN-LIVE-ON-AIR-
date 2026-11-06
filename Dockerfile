FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm ffmpeg icecast2 ca-certificates && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY live-engine/package.json /app/live-engine/package.json
RUN cd /app/live-engine && npm install --omit=dev

COPY live-engine/ /app/live-engine/
COPY icecast.xml /etc/icecast2/icecast.xml
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

CMD ["/app/entrypoint.sh"]
