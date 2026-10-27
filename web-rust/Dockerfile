# syntax=docker/dockerfile:1
# Builds web-rust with Trunk (the app, its sound engine's worklet and the
# docs) and serves it with nginx on port 8080. Build from the repo's root,
# which holds the crates, docs and images it reads:
#   docker build -f web-rust/Dockerfile -t studio-web-rust .
#   docker run --rm -p 8080:8080 studio-web-rust

# The full image, not -slim: it has curl and CA certificates, so the build
# needs nothing from apt.
FROM rust:1.97 AS build
ARG TRUNK_VERSION=0.22.1
RUN rustup target add wasm32-unknown-unknown
RUN curl -fsSL "https://github.com/trunk-rs/trunk/releases/download/v${TRUNK_VERSION}/trunk-$(uname -m)-unknown-linux-gnu.tar.gz" \
  | tar -xz -C /usr/local/bin trunk
WORKDIR /studio
COPY README.md ./
COPY docs docs
COPY public/docs public/docs
COPY public/screenshot.png public/
COPY sound-engine sound-engine
COPY web-rust web-rust
WORKDIR /studio/web-rust
# The caches keep crates, both crates' builds and the tools Trunk fetches
# (Tailwind, wasm-bindgen, wasm-opt) from one build to the next.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
  --mount=type=cache,target=/root/.cache/trunk \
  --mount=type=cache,target=/studio/web-rust/target \
  --mount=type=cache,target=/studio/sound-engine/worklet/target \
  trunk build --release

FROM nginx:1.29-alpine
COPY web-rust/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /studio/web-rust/dist /usr/share/nginx/html
EXPOSE 8080
