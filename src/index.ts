interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * GISTEMP MCP — NASA Goddard Institute for Space Studies Surface Temperature
 * Analysis (free, no auth)
 *
 * Canonical NASA dataset for global surface temperature anomalies. Updated
 * monthly with a ~2-month lag, baseline 1951-1980. Different vintage from
 * HadCRUT5 (UK Met) and Berkeley Earth — pair across sources for any
 * climate bet whose resolution rule names a specific provider.
 *
 * Source: https://data.giss.nasa.gov/gistemp/
 * Tools:
 * - get_temperature_anomaly: monthly + annual anomaly time series for a region
 * - get_latest_anomaly:      most-recent month + rank-vs-history
 * - get_zonal_anomalies:     latitude-band annual anomalies (8 bands)
 */


const BASE = 'https://data.giss.nasa.gov/gistemp/tabledata_v4';

const REGION_FILES: Record<string, string> = {
  global_land_ocean: 'GLB.Ts+dSST.csv',
  global_land_only:  'GLB.Ts.csv',
  northern_hemisphere: 'NH.Ts+dSST.csv',
  southern_hemisphere: 'SH.Ts+dSST.csv',
};

const tools: McpToolExport['tools'] = [
  {
    name: 'get_temperature_anomaly',
    description:
      'NASA GISTEMP surface temperature anomaly time series (degrees C from 1951-1980 baseline). Pick a region (global_land_ocean, global_land_only, northern_hemisphere, southern_hemisphere) and get monthly + annual + seasonal values back. Use for climate bets ("will 2026 be the hottest year on record"), trend comparisons, or cross-source consistency checks against HadCRUT5/Berkeley Earth. Annual frequency returns one row per year (Jan-Dec mean); monthly returns Jan..Dec per year.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        region: {
          type: 'string',
          enum: Object.keys(REGION_FILES),
          description: 'Which region to fetch. Default global_land_ocean.',
        },
        frequency: {
          type: 'string',
          enum: ['annual', 'monthly'],
          description: 'annual (one row per year) or monthly (12 rows per year). Default annual.',
        },
        start_year: { type: 'number', description: 'First year to include (default 1880, the dataset start).' },
        end_year: { type: 'number', description: 'Last year to include (default current year).' },
      },
    },
  },
  {
    name: 'get_latest_anomaly',
    description:
      'Most recent NASA GISTEMP global land+ocean monthly anomaly, plus how it ranks against history. Returns the latest available month, the anomaly value (degrees C from 1951-1980 baseline), the rank of that value among all same-month observations since 1880, and a 12-month trailing mean. Cheaper than get_temperature_anomaly when you only need "what is the current reading and is it unusual."',
    inputSchema: {
      type: 'object' as const,
      properties: {
        region: {
          type: 'string',
          enum: Object.keys(REGION_FILES),
          description: 'Default global_land_ocean.',
        },
      },
    },
  },
  {
    name: 'get_zonal_anomalies',
    description:
      'NASA GISTEMP annual zonal anomalies (degrees C from 1951-1980 baseline) for 8 latitude bands: global, Northern Hemisphere, Southern Hemisphere, 24N-90N, 24S-24N (tropics), 90S-24S, 64N-90N (Arctic), 44S-24S, etc. Use for regional climate bets ("will the Arctic warm faster than the tropics in 2026") or bets framed around polar amplification.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        start_year: { type: 'number', description: 'First year to include (default 1880).' },
        end_year: { type: 'number', description: 'Last year to include (default current year).' },
      },
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_temperature_anomaly':
      return getTemperatureAnomaly(
        (args.region as string) ?? 'global_land_ocean',
        (args.frequency as string) ?? 'annual',
        args.start_year as number | undefined,
        args.end_year as number | undefined,
      );
    case 'get_latest_anomaly':
      return getLatestAnomaly((args.region as string) ?? 'global_land_ocean');
    case 'get_zonal_anomalies':
      return getZonalAnomalies(args.start_year as number | undefined, args.end_year as number | undefined);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Fetch + CF-cache. NASA updates these CSVs monthly; 6h edge cache is
// safe and dedupes identical queries across all users.
async function fetchCsv(filename: string): Promise<string> {
  const res = await fetch(`${BASE}/${filename}`, {
    cf: {
      cacheTtlByStatus: { '200-299': 21600, '400-499': 60, '500-599': 10 },
      cacheEverything: true,
    },
  } as RequestInit);
  if (!res.ok) throw new Error(`NASA GISS ${filename} HTTP ${res.status}`);
  return res.text();
}

// GISTEMP CSVs have ~2 header lines (region label + sources) then a column
// header row starting with "Year" and 17 columns: Year, Jan..Dec, J-D,
// D-N, DJF, MAM, JJA, SON. Missing values are "***". Values are degrees
// C anomaly with 2 decimal places.
function parseGistempTable(csv: string): {
  header: string[];
  rows: Array<{ year: number; values: Record<string, number | null> }>;
} {
  const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => /^Year\b/i.test(l));
  if (headerIdx === -1) throw new Error('GISTEMP CSV: no Year header found');
  const header = lines[headerIdx].split(',').map((s) => s.trim());
  const rows: Array<{ year: number; values: Record<string, number | null> }> = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.trim());
    const year = Number(parts[0]);
    if (!Number.isFinite(year)) continue;
    const values: Record<string, number | null> = {};
    for (let j = 1; j < header.length; j++) {
      const raw = parts[j];
      const num = raw && !/\*/.test(raw) ? Number(raw) : NaN;
      values[header[j]] = Number.isFinite(num) ? num : null;
    }
    rows.push({ year, values });
  }
  return { header, rows };
}

const MONTH_COLS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function getTemperatureAnomaly(
  region: string,
  frequency: string,
  startYear?: number,
  endYear?: number,
) {
  const file = REGION_FILES[region];
  if (!file) {
    return {
      error: 'unknown_region',
      hint: `region must be one of: ${Object.keys(REGION_FILES).join(', ')}`,
      requested: region,
    };
  }
  const csv = await fetchCsv(file);
  const { rows } = parseGistempTable(csv);
  const filtered = rows.filter((r) =>
    (startYear == null || r.year >= startYear) &&
    (endYear == null || r.year <= endYear),
  );

  if (frequency === 'monthly') {
    const observations: Array<{ year: number; month: number; anomaly_c: number | null }> = [];
    for (const r of filtered) {
      MONTH_COLS.forEach((col, idx) => {
        observations.push({ year: r.year, month: idx + 1, anomaly_c: r.values[col] ?? null });
      });
    }
    return {
      region,
      frequency,
      baseline: '1951-1980',
      source: 'NASA GISTEMP v4 (Goddard Institute for Space Studies)',
      source_url: `${BASE}/${file}`,
      total: observations.length,
      observations,
    };
  }

  const observations = filtered.map((r) => ({
    year: r.year,
    anomaly_c: r.values['J-D'] ?? null,
    seasonal: { DJF: r.values.DJF ?? null, MAM: r.values.MAM ?? null, JJA: r.values.JJA ?? null, SON: r.values.SON ?? null },
  }));
  return {
    region,
    frequency: 'annual',
    baseline: '1951-1980',
    source: 'NASA GISTEMP v4 (Goddard Institute for Space Studies)',
    source_url: `${BASE}/${file}`,
    total: observations.length,
    observations,
  };
}

async function getLatestAnomaly(region: string) {
  const file = REGION_FILES[region];
  if (!file) {
    return {
      error: 'unknown_region',
      hint: `region must be one of: ${Object.keys(REGION_FILES).join(', ')}`,
      requested: region,
    };
  }
  const csv = await fetchCsv(file);
  const { rows } = parseGistempTable(csv);
  let latestYear: number | null = null;
  let latestMonth: number | null = null;
  let latestValue: number | null = null;
  for (let i = rows.length - 1; i >= 0 && latestValue == null; i--) {
    for (let m = MONTH_COLS.length - 1; m >= 0; m--) {
      const v = rows[i].values[MONTH_COLS[m]];
      if (v != null) {
        latestYear = rows[i].year;
        latestMonth = m + 1;
        latestValue = v;
        break;
      }
    }
  }
  if (latestValue == null || latestMonth == null || latestYear == null) {
    return { error: 'no_data', hint: 'GISTEMP CSV parsed but contained no numeric anomalies.' };
  }
  // Rank latest reading vs all same-month observations since 1880 (higher
  // anomaly = warmer = higher rank, 1 = warmest).
  const sameMonthValues = rows
    .map((r) => ({ year: r.year, value: r.values[MONTH_COLS[latestMonth! - 1]] }))
    .filter((x) => x.value != null && Number.isFinite(x.value!))
    .sort((a, b) => (b.value as number) - (a.value as number));
  const rank = sameMonthValues.findIndex((x) => x.year === latestYear) + 1;
  // 12-month trailing mean: walk back from (latestYear, latestMonth)
  // collecting 12 monthly values.
  const trailing: number[] = [];
  let yi = rows.findIndex((r) => r.year === latestYear);
  let mi = latestMonth - 1;
  while (trailing.length < 12 && yi >= 0) {
    const v = rows[yi].values[MONTH_COLS[mi]];
    if (v != null) trailing.push(v);
    mi--;
    if (mi < 0) { mi = 11; yi--; }
  }
  const trailing12 = trailing.length > 0
    ? +(trailing.reduce((s, x) => s + x, 0) / trailing.length).toFixed(3)
    : null;

  return {
    region,
    latest: {
      year: latestYear,
      month: latestMonth,
      anomaly_c: latestValue,
    },
    rank_among_same_month_since_1880: rank,
    same_month_observations: sameMonthValues.length,
    trailing_12_month_mean_c: trailing12,
    baseline: '1951-1980',
    source: 'NASA GISTEMP v4',
    source_url: `${BASE}/${file}`,
  };
}

async function getZonalAnomalies(startYear?: number, endYear?: number) {
  const csv = await fetchCsv('ZonAnn.Ts+dSST.csv');
  const { header, rows } = parseGistempTable(csv);
  const bands = header.slice(1);
  const filtered = rows.filter((r) =>
    (startYear == null || r.year >= startYear) &&
    (endYear == null || r.year <= endYear),
  );
  return {
    bands,
    baseline: '1951-1980',
    source: 'NASA GISTEMP v4 (zonal annual)',
    source_url: `${BASE}/ZonAnn.Ts+dSST.csv`,
    total: filtered.length,
    observations: filtered.map((r) => ({
      year: r.year,
      by_band: Object.fromEntries(bands.map((b) => [b, r.values[b] ?? null])),
    })),
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
