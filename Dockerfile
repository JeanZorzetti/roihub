FROM node:22-alpine AS deps
WORKDIR /app
# o .npmrc entra junto: e ele que faz o npm ci aceitar o react do canal experimental
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# Motor editorial do autopublishing: roda por CLAUDE_CODE_OAUTH_TOKEN (claude setup-token).
# ripgrep é dependência nativa do CLI; HOME precisa ser gravável pro estado dele.
RUN apk add --no-cache git ripgrep \
  && npm install -g @anthropic-ai/claude-code \
  && mkdir -p /home/node/.claude && chown -R node:node /home/node
ENV HOME=/home/node
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# exports manuais de crawl stats lidos via fs em runtime (aba /infra)
COPY --from=build /app/docs ./docs
# insights.json gerado pelo ml/analyze.py, lido via fs em runtime (aba /insights)
COPY --from=build /app/data ./data
EXPOSE 3000
CMD ["node", "server.js"]
