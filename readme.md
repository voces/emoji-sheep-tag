A project to make Sheep Tag in the browser. Graphically uses just 2-D SVG images
to avoid getting bogged down in graphics, which has derailed previous progress.

Currently persistently hosted at https://est.w3x.io/ in Ohio.

## Development Setup

### Prerequisites

- [Deno 2.x](https://deno.com/manual@v2.0.0/getting_started/installation)

### Getting Started

1. Clone the repository
2. Set up git hooks (optional, for automatic formatting):
   ```bash
   deno task setup-hooks
   ```
3. Run tests:
   ```bash
   deno task test
   ```
4. Start development server:
   ```bash
   deno task dev
   ```

## Replays

Set `REPLAY_DIR` to have the server record every round (seed, setup, and each
player input with the tick it arrived on) as a gzipped JSONL file:

```bash
REPLAY_DIR=replays deno task dev
```

Re-run recordings headlessly, verify them against the state hashes recorded
live, and time the simulation:

```bash
deno task replay --repeat 3 --systems replays/*.jsonl.gz
```

Chat and ping messages are not recorded.
