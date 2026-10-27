# Builds web-rust with Trunk (the app, its sound engine's worklet and the
# docs) and serves it with nginx on $PORT (8080 unless the host sets it, as
# Railway does). Build from the repo's root, which holds the crates, docs and
# images it reads:
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
COPY web-react/public/docs web-react/public/docs
COPY web-react/public/screenshot.png web-react/public/
COPY sound-engine sound-engine
COPY web-rust web-rust
WORKDIR /studio/web-rust
# No cache mounts: builders such as Railway's refuse them without an id tied
# to the service.
RUN trunk build --release

FROM nginx:1.29-alpine
# nginx's image fills in ${PORT} from the environment as it starts.
ENV PORT=8080
COPY web-rust/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /studio/web-rust/dist /usr/share/nginx/html
EXPOSE 8080
