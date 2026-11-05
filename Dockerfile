FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends icecast2 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY icecast.xml /etc/icecast2/icecast.xml

EXPOSE 8000

CMD ["icecast2", "-c", "/etc/icecast2/icecast.xml"]
