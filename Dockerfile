# Match package.json engines.node (26). Mismatched Node/npm versions between
# local lockfile generation and the image cause `npm ci` "Missing from lock file".
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# .env is dockerignored — pass these as build args / Railway variables so
# posthogConfig.publicKey is not baked in as an empty string.
ARG NUXT_PUBLIC_POSTHOG_KEY
ARG NUXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NUXT_PUBLIC_POSTHOG_KEY=$NUXT_PUBLIC_POSTHOG_KEY
ENV NUXT_PUBLIC_POSTHOG_HOST=$NUXT_PUBLIC_POSTHOG_HOST
RUN npm run build


FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
