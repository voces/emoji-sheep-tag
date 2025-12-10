FROM denoland/deno:debian AS builder

WORKDIR /app

# Copy source files needed for compilation
COPY deno.json deno.lock ./
COPY server/ server/
COPY shared/ shared/

# Compile the shard binary
RUN deno compile -A --output shard server/shard.ts

FROM debian:bookworm-slim

# Install CA certificates for HTTPS
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from builder
COPY --from=builder /app/shard /usr/local/bin/shard

# Set environment variables (can be overridden at runtime)
ENV SHARD_PORT=8080
ENV PRIMARY_SERVER=wss://est.w3x.io

# Expose the shard port
EXPOSE 8080

# Run the shard
CMD ["/usr/local/bin/shard"]
