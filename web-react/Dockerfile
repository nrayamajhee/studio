# Builds web-react (the app and its Storybook, with the docs) and serves it
# with react-router-serve. Build from the repo's root, which holds the docs
# and README it reads:
#   docker build -f web-react/Dockerfile -t studio-web-react .
#   docker run --rm -p 3000:3000 studio-web-react

FROM node:24-alpine AS development-dependencies-env
COPY web-react/package.json web-react/package-lock.json /studio/web-react/
WORKDIR /studio/web-react
RUN npm ci

FROM node:24-alpine AS production-dependencies-env
COPY web-react/package.json web-react/package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine AS build-env
COPY README.md /studio/
COPY docs /studio/docs
COPY web-react /studio/web-react
COPY --from=development-dependencies-env /studio/web-react/node_modules /studio/web-react/node_modules
WORKDIR /studio/web-react
RUN npm run build

FROM node:24-alpine
COPY web-react/package.json web-react/package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /studio/web-react/build /app/build
WORKDIR /app
CMD ["npm", "run", "start"]
