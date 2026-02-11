import { YearlyData, Municipality } from '../types';

// ==========================================
// 1. KUNTIEN AVAINLUVUT
// ==========================================
export const fetchKuntienAvainluvut = async (): Promise<Record<string, YearlyData[]> | null> => {
  const url = 'https://pxdata.stat.fi/PxWeb/api/v1/fi/Kuntien_avainluvut/2025/kuntien_avainluvut_2025_aikasarja.px';
  
  const query = {
    "query": [
      {
        "code": "Alue",
        "selection": { "filter": "item", "values": ["KU074", "KU236", "KU421", "KU849", "KU924"] }
      },
      {
        "code": "Tiedot",
        // Käytetään turvallista kaikkien hakua estämään 400-virheet ja suodatetaan data frontendissä
        "selection": { "filter": "all", "values": ["*"] } 
      },
      {
        "code": "Vuosi",
        "selection": { "filter": "item", "values": ["2020", "2021", "2022", "2023", "2024"] }
      }
    ],
    "response": { "format": "json-stat2" }
  };

  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
    if (!response.ok) throw new Error(`StatFin API error: ${response.status}`);
    const data = await response.json();
    return parseJsonStat2(data);
  } catch (error) {
    console.error("Error fetching from StatFin:", error);
    return null;
  }
};

const parseJsonStat2 = (data: any): Record<string, YearlyData[]> => {
  const alueDict = data.dimension.Alue.category.label;
  const tiedotDict = data.dimension.Tiedot.category.label;
  const alueKeys = Object.keys(data.dimension.Alue.category.index);
  const tiedotKeys = Object.keys(data.dimension.Tiedot.category.index);
  const vuosiKeys = Object.keys(data.dimension.Vuosi.category.index);

  const result: Record<string, Record<string, YearlyData>> = {};
  tiedotKeys.forEach(tCode => {
    const tLabel = tiedotDict[tCode];
    result[tLabel] = {};
    vuosiKeys.forEach(v => {
      // Initialize without 0 to handle missing data gracefully
      result[tLabel][v] = { year: parseInt(v) } as YearlyData;
    });
  });

  const sizes = data.size; 
  const dimIds = data.id; 
  const values = data.value;

  const getCoords = (index: number, dims: number[]) => {
    let remaining = index;
    const coords = [];
    for (let i = dims.length - 1; i >= 0; i--) {
      coords[i] = remaining % dims[i];
      remaining = Math.floor(remaining / dims[i]);
    }
    return coords;
  };

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === null) continue;

    const coords = getCoords(i, sizes);
    let alueIdx = 0, tiedotIdx = 0, vuosiIdx = 0;
    dimIds.forEach((dim: string, j: number) => {
      if (dim === 'Alue') alueIdx = coords[j];
      if (dim === 'Tiedot') tiedotIdx = coords[j];
      if (dim === 'Vuosi') vuosiIdx = coords[j];
    });

    const alueCode = alueKeys[alueIdx];
    const tiedotCode = tiedotKeys[tiedotIdx];
    const vuosiCode = vuosiKeys[vuosiIdx];
    const muniName = alueDict[alueCode] as Municipality;
    const tLabel = tiedotDict[tiedotCode];

    if (result[tLabel] && result[tLabel][vuosiCode]) {
        result[tLabel][vuosiCode][muniName] = val; 
    }
  }

  const finalData: Record<string, YearlyData[]> = {};
  for (const tLabel in result) {
     finalData[tLabel] = Object.values(result[tLabel]).sort((a, b) => a.year - b.year);
  }
  return finalData;
};

// ==========================================
// 2. KOULUTUKSEEN HAKEUTUNEET
// ==========================================
export const fetchEducationData = async (): Promise<YearlyData[] | null> => {
  const url = 'https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/khak/statfin_khak_pxt_11fy.px';
  const query = {
    "query": [
      { "code": "Vuosi", "selection": { "filter": "item", "values": ["2020", "2021", "2022", "2023", "2024"] } },
      { "code": "Oppilaitoksen sijaintialue", "selection": { "filter": "item", "values": ["KU074", "KU236", "KU421", "KU849", "KU924"] } },
      { "code": "Jatko-opinnot", "selection": { "filter": "item", "values": ["1", "2", "5", "8", "9"] } }
    ],
    "response": { "format": "json-stat2" }
  };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
    if (!response.ok) throw new Error(`StatFin API error: ${response.status}`);
    return parseEducationData(await response.json(), 'Oppilaitoksen sijaintialue', 'Vuosi');
  } catch (error) {
    return null;
  }
};

// ==========================================
// 3. YRITYKSET (2020-2024)
// ==========================================
export const fetchEnterprisesData = async (): Promise<YearlyData[] | null> => {
  const url = 'https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/alyr/statfin_alyr_pxt_13wz.px';
  const query = {
    "query": [
      { "code": "Vuosi", "selection": { "filter": "item", "values": ["2020", "2021", "2022", "2023", "2024"] } },
      { "code": "Kunta", "selection": { "filter": "item", "values": ["KU074", "KU236", "KU421", "KU849", "KU924"] } }
    ],
    "response": { "format": "json-stat2" }
  };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
    if (!response.ok) throw new Error(`StatFin API error: ${response.status}`);
    return parseRobustData(await response.json(), 'Kunta', 'Vuosi', ['yritys', 'lukumäärä']);
  } catch (error) {
    return null;
  }
};

// ==========================================
// 4. SYNTYNEET (2024)
// ==========================================
export const fetchBirthsData = async (): Promise<YearlyData[] | null> => {
  const url = 'https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/synt/statfin_synt_pxt_14lh.px';
  const query = {
    "query": [
      { "code": "Vuosi", "selection": { "filter": "item", "values": ["2024"] } },
      { "code": "Alue", "selection": { "filter": "item", "values": ["KU074", "KU236", "KU421", "KU849", "KU924"] } }
    ],
    "response": { "format": "json-stat2" }
  };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
    if (!response.ok) throw new Error(`StatFin API error: ${response.status}`);
    return parseRobustData(await response.json(), 'Alue', 'Vuosi', ['elävänä syntyneet']);
  } catch (error) {
    return null;
  }
};

// ==========================================
// 5. VÄESTÖENNUSTE (2030, 2045)
// ==========================================
export const fetchProjectionsData = async (): Promise<Record<string, YearlyData[]> | null> => {
  const url = 'https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/vaenn/statfin_vaenn_pxt_14wy.px';
  const query = {
    "query": [
      { "code": "Alue", "selection": { "filter": "item", "values": ["KU074", "KU236", "KU421", "KU849", "KU924"] } },
      { "code": "Vuosi", "selection": { "filter": "item", "values": ["2024", "2025", "2030", "2045"] } },
      { "code": "Sukupuoli", "selection": { "filter": "item", "values": ["SSS", "1", "2"] } },
      { "code": "Tiedot", "selection": { "filter": "item", "values": ["vm01_e24", "vm4243_e24", "valisays_e24", "vaesto_e24"] } }
    ],
    "response": { "format": "json-stat2" }
  };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
    if (!response.ok) throw new Error(`StatFin API error: ${response.status}`);
    return parseProjectionsRobustData(await response.json());
  } catch (error) {
    return null;
  }
};

// ==========================================
// 6. HUOLTOSUHDENNUSTE (2024, 2025, 2030, 2045)
// ==========================================
export const fetchDepRatioProjections = async (): Promise<YearlyData[] | null> => {
  const url = 'https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/vaenn/statfin_vaenn_pxt_14wz.px';
  const query = {
    "query": [
      { "code": "Alue", "selection": { "filter": "item", "values": ["KU074", "KU236", "KU421", "KU849", "KU924"] } },
      { "code": "Vuosi", "selection": { "filter": "item", "values": ["2024", "2025", "2030", "2045"] } }
    ],
    "response": { "format": "json-stat2" }
  };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
    if (!response.ok) throw new Error(`StatFin API error: ${response.status}`);
    return parseRobustData(await response.json(), 'Alue', 'Vuosi', ['huoltosuhde']);
  } catch (error) {
    return null;
  }
};

// ==========================================
// PARSERS
// ==========================================

const getCoords = (index: number, sizes: number[]) => {
  let remaining = index;
  const coords = [];
  for (let i = sizes.length - 1; i >= 0; i--) {
    coords[i] = remaining % sizes[i];
    remaining = Math.floor(remaining / sizes[i]);
  }
  return coords;
};

const parseEducationData = (data: any, alueDimCode: string, vuosiDimCode: string): YearlyData[] => {
  const dimIds = data.id as string[];
  const sizes = data.size as number[];
  const values = data.value;

  const alueDim = dimIds.find(d => d === alueDimCode || d.toLowerCase().includes('alue'));
  const vuosiDim = dimIds.find(d => d === vuosiDimCode || d.toLowerCase().includes('vuosi'));
  if (!alueDim || !vuosiDim) return [];

  const alueDict = data.dimension[alueDim].category.label;
  const alueKeys = Object.keys(data.dimension[alueDim].category.index);
  const vuosiKeys = Object.keys(data.dimension[vuosiDim].category.index);

  const result: Record<string, YearlyData> = {};
  vuosiKeys.forEach(v => { result[v] = { year: parseInt(v) } as YearlyData; });

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === null) continue;

    const coords = getCoords(i, sizes);
    let alueIdx = 0, vuosiIdx = 0;
    dimIds.forEach((dim: string, j: number) => {
      if (dim === alueDim) alueIdx = coords[j];
      if (dim === vuosiDim) vuosiIdx = coords[j];
    });

    const muniName = alueDict[alueKeys[alueIdx]] as Municipality;
    const vCode = vuosiKeys[vuosiIdx];

    if (result[vCode]) {
        if (result[vCode][muniName] == null) result[vCode][muniName] = 0;
        result[vCode][muniName] += val; 
    }
  }
  return Object.values(result).sort((a, b) => a.year - b.year);
};

const parseRobustData = (data: any, alueDimCode: string, vuosiDimCode: string, targetTiedotKeywords: string[] = []): YearlyData[] => {
  const dimIds = data.id as string[];
  const sizes = data.size as number[];
  const values = data.value;

  const alueDim = dimIds.find(d => d === alueDimCode || d.toLowerCase().includes('alue') || d.toLowerCase().includes('kunta'));
  const vuosiDim = dimIds.find(d => d === vuosiDimCode || d.toLowerCase().includes('vuosi'));
  if (!alueDim || !vuosiDim) return [];

  const alueDict = data.dimension[alueDim].category.label;
  const alueKeys = Object.keys(data.dimension[alueDim].category.index);
  const vuosiKeys = Object.keys(data.dimension[vuosiDim].category.index);

  const validIndicesPerDim: Record<string, number> = {};
  dimIds.forEach(dim => {
    if (dim === alueDim || dim === vuosiDim) return;
    const cat = data.dimension[dim].category;
    const keys = Object.keys(cat.index);
    const labels = cat.label;
    
    if (dim.toLowerCase().includes('tiedot')) {
       const targetKey = keys.find(k => targetTiedotKeywords.some(t => labels[k].toLowerCase().includes(t.toLowerCase())));
       validIndicesPerDim[dim] = targetKey ? cat.index[targetKey] : 0;
    } else {
       const totalKey = keys.find(k => 
         k === 'SSS' || k === 'S' || k === 'YHT' || k === '0000' ||
         labels[k].toLowerCase().includes('yhteensä') || 
         labels[k].toLowerCase().includes('kaikki') ||
         labels[k].toLowerCase() === 'koko toimiala'
       );
       validIndicesPerDim[dim] = totalKey ? cat.index[totalKey] : 0;
    }
  });

  const result: Record<string, YearlyData> = {};
  vuosiKeys.forEach(v => { result[v] = { year: parseInt(v) } as YearlyData; });

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === null) continue;

    const coords = getCoords(i, sizes);
    let alueIdx = 0, vuosiIdx = 0;
    let isValidExtraDim = true;

    dimIds.forEach((dim: string, j: number) => {
      if (dim === alueDim) alueIdx = coords[j];
      else if (dim === vuosiDim) vuosiIdx = coords[j];
      else {
         if (coords[j] !== validIndicesPerDim[dim]) {
             isValidExtraDim = false;
         }
      }
    });

    if (!isValidExtraDim) continue; 

    const muniName = alueDict[alueKeys[alueIdx]] as Municipality;
    const vCode = vuosiKeys[vuosiIdx];

    if (result[vCode]) {
        result[vCode][muniName] = val; 
    }
  }

  return Object.values(result).sort((a, b) => a.year - b.year);
};

const parseProjectionsRobustData = (data: any): Record<string, YearlyData[]> => {
  const dimIds = data.id as string[];
  const sizes = data.size as number[];
  const values = data.value;

  const alueDim = dimIds.find(d => d === 'Alue' || d.toLowerCase().includes('alue'))!;
  const vuosiDim = dimIds.find(d => d === 'Vuosi' || d.toLowerCase().includes('vuosi'))!;
  const tiedotDim = dimIds.find(d => d === 'Tiedot' || d.toLowerCase().includes('tiedot'))!;

  const alueDict = data.dimension[alueDim].category.label;
  const alueKeys = Object.keys(data.dimension[alueDim].category.index);
  const vuosiKeys = Object.keys(data.dimension[vuosiDim].category.index);
  const tiedotKeys = Object.keys(data.dimension[tiedotDim].category.index);

  const validIndicesPerDim: Record<string, number> = {};
  dimIds.forEach(dim => {
    if (dim === alueDim || dim === vuosiDim || dim === tiedotDim) return;
    const cat = data.dimension[dim].category;
    const keys = Object.keys(cat.index);
    const labels = cat.label;
    const totalKey = keys.find(k => 
         k === 'SSS' || k === 'S' || k === 'YHT' || k === '0000' ||
         labels[k].toLowerCase().includes('yhteensä') || 
         labels[k].toLowerCase().includes('kaikki')
    );
    validIndicesPerDim[dim] = totalKey ? cat.index[totalKey] : 0;
  });

  const result: Record<string, Record<string, YearlyData>> = {};
  tiedotKeys.forEach(tCode => {
     result[tCode] = {};
     vuosiKeys.forEach(v => { result[tCode][v] = { year: parseInt(v) } as YearlyData; });
  });

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === null) continue;

    const coords = getCoords(i, sizes);
    let alueIdx = 0, vuosiIdx = 0, tiedotIdx = 0;
    let isValidExtraDim = true;

    dimIds.forEach((dim: string, j: number) => {
      if (dim === alueDim) alueIdx = coords[j];
      else if (dim === vuosiDim) vuosiIdx = coords[j];
      else if (dim === tiedotDim) tiedotIdx = coords[j];
      else {
         if (coords[j] !== validIndicesPerDim[dim]) {
             isValidExtraDim = false;
         }
      }
    });

    if (!isValidExtraDim) continue;

    const alueCode = alueKeys[alueIdx];
    const vuosiCode = vuosiKeys[vuosiIdx];
    const tiedotCode = tiedotKeys[tiedotIdx];
    const muniName = alueDict[alueCode] as Municipality;

    result[tiedotCode][vuosiCode][muniName] = val; 
  }

  const finalData: Record<string, YearlyData[]> = {};
  for (const tCode in result) {
     finalData[tCode] = Object.values(result[tCode]).sort((a, b) => a.year - b.year);
  }
  return finalData;
};