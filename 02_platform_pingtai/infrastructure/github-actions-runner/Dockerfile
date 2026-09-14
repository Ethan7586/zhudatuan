FROM --platform=linux/amd64 ubuntu:24.04@sha256:224a1869083a311ef3f13648a154ba79832fbef6364d31493642ca03082da254

ARG RUNNER_VERSION=2.337.0
ARG RUNNER_SHA256=70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613

ENV DEBIAN_FRONTEND=noninteractive
ENV RUNNER_ALLOW_RUNASROOT=1
ENV HOME=/home/runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates curl git gh gzip jq openssh-client tar unzip xz-utils zstd \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /opt/actions-runner /runner-state \
  && curl -fsSLo /tmp/actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
  && echo "${RUNNER_SHA256}  /tmp/actions-runner.tar.gz" | sha256sum -c - \
  && tar -xzf /tmp/actions-runner.tar.gz -C /opt/actions-runner \
  && rm /tmp/actions-runner.tar.gz \
  && /opt/actions-runner/bin/installdependencies.sh \
  && useradd --uid 1001 --create-home --shell /bin/bash runner \
  && chown -R runner:runner /opt/actions-runner /runner-state

COPY runner-entrypoint.sh /usr/local/bin/zdt-runner
RUN chmod 0755 /usr/local/bin/zdt-runner

WORKDIR /runner-state
ENTRYPOINT ["/usr/local/bin/zdt-runner"]
CMD ["run"]
