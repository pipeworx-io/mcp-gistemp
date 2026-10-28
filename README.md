# @pipeworx/gistemp

NASA GISS surface temperature anomalies (degrees C from the 1951-1980 baseline): global, hemispheric and zonal series, monthly and annual, with the latest reading ranked against history.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1877+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

## Tools

- `get_temperature_anomaly(region?, frequency?, start_year?, end_year?)` - monthly or annual anomaly series for global land+ocean, global land only, or either hemisphere.
- `get_latest_anomaly(region?)` - the most recent month, its rank among the same month since 1880, and a 12-month trailing mean.
- `get_zonal_anomalies(start_year?, end_year?)` - annual anomalies by latitude band.

## Auth

Keyless.

## Data sources

- NASA Goddard Institute for Space Studies, GISTEMP surface temperature analysis (v4). US federal government work, public domain; no reuse grant is needed to store or serve it.

## Stored copy

NASA GISS refuses requests leaving some of our network egress, so calls are answered from a copy kept in the shared object store (five small tables plus a manifest, none in git and none in the gateway bundle). Every response carries `served_from` (`stored-copy`, `live`, or `stale-stored-copy`), `data_as_of` (latest observation month) and `copy_refreshed_at`. A copy older than 45 days sends the call to NASA first and falls back to the old copy, labelled, if NASA still refuses.

Refresh: `node mcps/gistemp/scripts/refresh-gistemp.mjs` from a US machine (it checks its own country and refuses otherwise). NASA publishes about monthly. The manifest is written last and only when every table was read, so `copy_refreshed_at` never claims a check that did not happen.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "gistemp": {
      "url": "https://gateway.pipeworx.io/gistemp/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/gistemp/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1877+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/get_temperature_anomaly \
  -H 'Content-Type: application/json' \
  -d '{"region":"global_land_ocean","frequency":"annual"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/get_temperature_anomaly`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "gistemp": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-gistemp"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-gistemp
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Gistemp data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
