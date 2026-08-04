# mcp-gistemp

GISTEMP MCP — NASA Goddard Institute for Space Studies Surface Temperature

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `get_temperature_anomaly` | NASA GISTEMP surface temperature anomaly time series (degrees C from 1951-1980 baseline). Pick a region (global_land_ocean, global_land_only, northern_hemisphere, southern_hemisphere) and get monthly + annual + seasonal values back. Use for climate bets ("will 2026 be the hottest year on record"), trend comparisons, or cross-source consistency checks against HadCRUT5/Berkeley Earth. Annual frequency returns one row per year (Jan-Dec mean); monthly returns Jan..Dec per year. |
| `get_latest_anomaly` | Most recent NASA GISTEMP global land+ocean monthly anomaly, plus how it ranks against history. Returns the latest available month, the anomaly value (degrees C from 1951-1980 baseline), the rank of that value among all same-month observations since 1880, and a 12-month trailing mean. Cheaper than get_temperature_anomaly when you only need "what is the current reading and is it unusual." |
| `get_zonal_anomalies` | NASA GISTEMP annual zonal anomalies (degrees C from 1951-1980 baseline) for 8 latitude bands: global, Northern Hemisphere, Southern Hemisphere, 24N-90N, 24S-24N (tropics), 90S-24S, 64N-90N (Arctic), 44S-24S, etc. Use for regional climate bets ("will the Arctic warm faster than the tropics in 2026") or bets framed around polar amplification. |

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Gistemp data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
