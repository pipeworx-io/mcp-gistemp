# @pipeworx/gistemp

NASA GISS surface temperature anomalies (degrees C from the 1951-1980 baseline): global, hemispheric and zonal series, monthly and annual, with the latest reading ranked against history.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1856+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

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

Both URLs reach the same gateway and the same 1856+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/get_temperature_anomaly \
  -H 'Content-Type: application/json' \
  -d '{"region":"global_land_ocean","frequency":"annual"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/get_temperature_anomaly`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Run it from npm

`@pipeworx/mcp-gistemp` is a local stdio bridge to the Pipeworx gateway: your MCP client
starts it with `npx`, and it forwards every call to the same
`https://gateway.pipeworx.io/gistemp/mcp` endpoint shown above. It needs network access;
there is no offline mode.

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

Without a key it calls anonymously, capped at 50 calls a day. A free account
raises that to 200 a day: get a key at https://pipeworx.io/signup and add
`"env": { "PIPEWORX_API_KEY": "<your key>" }` to the server entry.
The key is sent as a Bearer token, the same way a hosted connection sends it,
so calls are metered and billed exactly as they are there.

It lists **only** this pack's tools by default. Set `PIPEWORX_META_TOOLS=1` to
also list `ask_pipeworx` and the other gateway-wide tools.

Behind an HTTPS proxy: Node's built-in `fetch` does not read `HTTPS_PROXY` by
default. Newer Node releases honour it when `NODE_USE_ENV_PROXY=1` is set; check
your Node version's documentation.

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
