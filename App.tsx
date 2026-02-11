import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Users, TrendingDown, TrendingUp, MapPin, CheckSquare, Square, Briefcase, Scale, Activity, Building2, Baby, ArrowRight, Loader2 } from 'lucide-react';

import { allMunicipalities, municipalityColors } from './data';
import { fetchKuntienAvainluvut, fetchEducationData, fetchEnterprisesData, fetchBirthsData, fetchProjectionsData, fetchDepRatioProjections } from './services/statfinService';
import { YearlyData, Municipality } from './types';
import { StatCard } from './components/StatCard';
import { AIInsights } from './components/AIInsights';

type ViewMode = 'regional' | 'executive';

// Lineaarinen regressio ennusteen laskemista varten (Yrityskannan 5v ennuste)
const generateEnterpriseForecast = (dataArr: YearlyData[], muni: Municipality, lastYear: number) => {
  const points = dataArr
    .filter(d => d[muni] != null)
    .map(d => ({ x: d.year, y: d[muni] as number }));

  if (points.length < 2) return [];

  const n = points.length;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const forecast = [];
  for (let i = 1; i <= 5; i++) {
    const targetYear = lastYear + i;
    const val = Math.round(slope * targetYear + intercept);
    // Varmistetaan, ettei lukumäärä mene epäloogisesti alle nollan
    forecast.push({ year: targetYear, value: Math.max(0, val) });
  }
  return forecast;
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('regional');
  const [selectedMuni, setSelectedMuni] = useState<Municipality[]>(allMunicipalities);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [execMuni, setExecMuni] = useState<Municipality>('Kaustinen');
  const [isLoading, setIsLoading] = useState(true);

  // States for all API data
  const [popData, setPopData] = useState<YearlyData[]>([]);
  const [empData, setEmpData] = useState<YearlyData[]>([]); 
  const [unempData, setUnempData] = useState<YearlyData[]>([]);
  const [depData, setDepData] = useState<YearlyData[]>([]); 
  const [depProjData, setDepProjData] = useState<YearlyData[]>([]); 
  const [eduData, setEduData] = useState<YearlyData[]>([]); 
  const [busData, setBusData] = useState<YearlyData[]>([]);
  const [birthsData, setBirthsData] = useState<YearlyData[]>([]);
  const [projData, setProjData] = useState<Record<string, YearlyData[]>>({});

  useEffect(() => {
    let mounted = true;

    const loadRealData = async () => {
      setIsLoading(true);
      const [liveData, eduLiveData, busLiveData, birthsLiveData, projLiveData, depProjLiveData] = await Promise.all([
        fetchKuntienAvainluvut(),
        fetchEducationData(),
        fetchEnterprisesData(),
        fetchBirthsData(),
        fetchProjectionsData(),
        fetchDepRatioProjections()
      ]);

      if (mounted) {
        if (liveData) {
          const labels = Object.keys(liveData);
          
          const popKey = labels.find(l => l.toLowerCase() === 'väkiluku');
          
          // Etsitään mieluiten 18-64v työllisyysaste, poissuljetaan "muutos"
          const empKey = labels.find(l => l.toLowerCase().includes('työllisyysaste') && l.includes('%') && (l.includes('18') || l.includes('64')) && !l.toLowerCase().includes('muutos')) 
                      || labels.find(l => l.toLowerCase().includes('työllisyysaste') && l.includes('%') && !l.toLowerCase().includes('muutos'));
          
          // Etsitään mieluiten 18-64v työttömyysaste, poissuljetaan "muutos"
          const unempKey = labels.find(l => l.toLowerCase().includes('työttöm') && l.includes('%') && (l.includes('18') || l.includes('64')) && !l.toLowerCase().includes('muutos'))
                        || labels.find(l => l.toLowerCase().includes('työttöm') && l.includes('%') && !l.toLowerCase().includes('muutos'));
          
          const depKey = labels.find(l => l === 'Väestöllinen huoltosuhde') 
                      || labels.find(l => l.toLowerCase().includes('huoltosuhde') && !l.toLowerCase().includes('muutos') && l.toLowerCase().includes('väestö'));

          if (popKey) {
            setPopData(liveData[popKey]);
            setSelectedYear(liveData[popKey][liveData[popKey].length - 1].year); 
          }
          if (empKey) setEmpData(liveData[empKey]);
          if (unempKey) setUnempData(liveData[unempKey]);
          if (depKey) setDepData(liveData[depKey]);
        }
        
        if (eduLiveData) setEduData(eduLiveData);
        if (busLiveData) setBusData(busLiveData);
        if (birthsLiveData) setBirthsData(birthsLiveData);
        if (projLiveData) setProjData(projLiveData);
        if (depProjLiveData) setDepProjData(depProjLiveData);
        
        setIsLoading(false);
      }
    };

    loadRealData();
    return () => { mounted = false; };
  }, []);

  const availableYears = useMemo(() => popData.map(d => d.year), [popData]);

  // Hakee kyseisen vuoden datan (tai pykälää vanhemman jos uusinta ei ole julkaistu)
  const getLatestValue = (dataArr: YearlyData[], muni: Municipality, targetYear: number) => {
    if (!dataArr || dataArr.length === 0) return null;
    for (let y = targetYear; y >= 2020; y--) {
      const row = dataArr.find(d => d.year === y);
      if (row && row[muni] != null) return row[muni];
    }
    return null;
  };

  const getLatestValid = (dataArr: YearlyData[], muni: Municipality, startYear: number) => {
    if (!dataArr || dataArr.length === 0) return { value: null, year: null };
    for (let y = startYear; y >= 2020; y--) {
      const row = dataArr.find(d => d.year === y);
      if (row && row[muni] != null) return { value: row[muni], year: y };
    }
    return { value: null, year: null };
  };

  const combinedPopData = useMemo(() => {
    const hist = [...popData];
    const maxHistYear = hist.length > 0 ? Math.max(...hist.map(d => d.year)) : 2024;
    const proj = (projData['vaesto_e24'] || []).filter(d => d.year > maxHistYear);
    return [...hist, ...proj].sort((a, b) => a.year - b.year);
  }, [popData, projData]);

  const toggleMunicipality = (muni: Municipality) => {
    setSelectedMuni(prev => 
      prev.includes(muni) ? prev.filter(m => m !== muni) : [...prev, muni]
    );
  };

  const toggleAll = () => {
    if (selectedMuni.length === allMunicipalities.length) {
      setSelectedMuni([]);
    } else {
      setSelectedMuni(allMunicipalities);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm">
          <p className="font-semibold mb-2">{label > 2024 ? `${label} (Ennuste)` : label}</p>
          {payload.map((entry: any, index: number) => {
            // Vain ne datapisteet, joiden nimessä on %, saavat peräänsä %-merkin tulostuksessa.
            const isPercentage = entry.name.includes('%');
            return (
              <div key={index} className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} />
                <span className="text-slate-600">{entry.name}:</span>
                <span className="font-medium">
                  {typeof entry.value === 'number' && entry.value % 1 !== 0 ? entry.value.toFixed(1) : entry.value}
                  {isPercentage ? ' %' : ''}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // --- REGIONAL DATA ---
  const regionalStats = useMemo(() => {
    if (selectedMuni.length === 0 || popData.length === 0) return null;
    const currentYearData = popData.find(d => d.year === selectedYear) || popData[0];
    const firstYearData = popData[0];

    const currentTotal = selectedMuni.reduce((sum, muni) => sum + (currentYearData[muni] || 0), 0);
    const initialTotal = selectedMuni.reduce((sum, muni) => sum + (firstYearData[muni] || 0), 0);
    const pctChange = initialTotal > 0 ? ((currentTotal - initialTotal) / initialTotal) * 100 : 0;

    let largest = selectedMuni[0];
    selectedMuni.forEach(muni => {
      if ((currentYearData[muni] || 0) > (currentYearData[largest] || 0)) largest = muni;
    });

    return { currentTotal, pctChange: pctChange.toFixed(1), largest };
  }, [selectedMuni, selectedYear, popData]);

  const regionalTableData = useMemo(() => {
    if (selectedMuni.length === 0 || popData.length === 0) return null;

    const rows = selectedMuni.map(muni => {
      const pop = getLatestValue(popData, muni, selectedYear) || 0;
      const emp = getLatestValue(empData, muni, selectedYear);
      const unemp = getLatestValue(unempData, muni, selectedYear);
      const edu = getLatestValue(eduData, muni, selectedYear);
      const bus = getLatestValue(busData, muni, selectedYear);
      const births = getLatestValue(birthsData, muni, selectedYear);

      return {
        name: muni,
        population: pop,
        employment: emp,
        unemployment: unemp,
        education: edu,
        business: bus,
        births: births,
        color: municipalityColors[muni]
      };
    });

    const safeSum = (arr: any[], key: string) => arr.reduce((sum, r) => sum + (r[key] || 0), 0);
    
    // Suora matemaattinen keskiarvo prosenteille valituista kunnista
    const validEmpRows = rows.filter(r => r.employment != null);
    const avgEmp = validEmpRows.length > 0 ? validEmpRows.reduce((sum, r) => sum + r.employment!, 0) / validEmpRows.length : 0;
    
    const validUnempRows = rows.filter(r => r.unemployment != null);
    const avgUnemp = validUnempRows.length > 0 ? validUnempRows.reduce((sum, r) => sum + r.unemployment!, 0) / validUnempRows.length : 0;
    
    return {
      rows: rows.sort((a, b) => b.population - a.population),
      totals: {
        population: safeSum(rows, 'population'),
        employment: avgEmp,
        unemployment: avgUnemp,
        education: safeSum(rows, 'education'),
        business: safeSum(rows, 'business'),
        births: safeSum(rows, 'births')
      }
    };
  }, [selectedMuni, selectedYear, popData, empData, unempData, eduData, busData, birthsData]);

  // --- EXECUTIVE DATA ---
  const execData = useMemo(() => {
    if (popData.length === 0) return null;
    
    const popCur = getLatestValid(popData, execMuni, selectedYear);
    const popPrev = popCur.year != null ? getLatestValid(popData, execMuni, popCur.year - 1) : { value: null, year: null };

    const empCur = getLatestValid(empData, execMuni, selectedYear);
    const empPrev = empCur.year != null ? getLatestValid(empData, execMuni, empCur.year - 1) : { value: null, year: null };

    const unempCur = getLatestValid(unempData, execMuni, selectedYear);
    const unempPrev = unempCur.year != null ? getLatestValid(unempData, execMuni, unempCur.year - 1) : { value: null, year: null };

    const busCur = getLatestValid(busData, execMuni, selectedYear);
    const busPrev = busCur.year != null ? getLatestValid(busData, execMuni, busCur.year - 1) : { value: null, year: null };

    const current = {
      pop: popCur.value || 0,
      emp: empCur.value,
      unemp: unempCur.value,
      bus: busCur.value,
    };

    const trends = {
        pop: popPrev.value && current.pop ? Number(((current.pop - popPrev.value) / popPrev.value * 100).toFixed(1)) : undefined,
        emp: empPrev.value && current.emp ? Number((current.emp - empPrev.value).toFixed(1)) : undefined,
        unemp: unempPrev.value && current.unemp ? Number((current.unemp - unempPrev.value).toFixed(1)) : undefined,
        bus: busPrev.value && current.bus ? Number(((current.bus - busPrev.value) / busPrev.value * 100).toFixed(1)) : undefined,
    };

    const formatTrendLabel = (curYear: number | null, prevYear: number | null, unit: string) => {
       if (!curYear || !prevYear) return '';
       return curYear === selectedYear ? `vs ${prevYear} ${unit}` : `${curYear} vs ${prevYear} ${unit}`;
    };

    const trendLabels = {
       pop: formatTrendLabel(popCur.year, popPrev.year, '(%)'),
       emp: formatTrendLabel(empCur.year, empPrev.year, '(%yks)'),
       unemp: formatTrendLabel(unempCur.year, unempPrev.year, '(%yks)'),
       bus: formatTrendLabel(busCur.year, busPrev.year, '(%)')
    };

    // YRITYSTEN ENNUSTE-LOGIIKKA
    const lastHistoricalBusYear = busData.length > 0 ? Math.max(...busData.map(d => d.year)) : 2024;
    const busForecast = generateEnterpriseForecast(busData, execMuni, lastHistoricalBusYear);
    
    const enterpriseChartYears = Array.from(new Set([
      ...availableYears,
      ...busForecast.map(f => f.year)
    ])).sort((a,b) => a - b);

    const enterpriseChartData = enterpriseChartYears.map(year => {
      const histBus = busData.find(d => d.year === year)?.[execMuni];
      const projBus = busForecast.find(f => f.year === year)?.value;
      
      let toteuma = undefined;
      let ennuste = undefined;

      if (year <= lastHistoricalBusYear) {
         toteuma = histBus != null ? histBus : undefined;
         if (year === lastHistoricalBusYear) {
             ennuste = histBus; // Silta historiasta ennusteeseen
         }
      } else {
         ennuste = projBus;
      }

      return {
        year,
        'Yritykset (Toteuma)': toteuma,
        'Yritykset (Ennuste)': ennuste
      };
    });

    const empUnempChartData = availableYears.filter(y => y <= 2024).map(year => ({
      year,
      'Työllisyysaste (%)': empData.find(d => d.year === year)?.[execMuni],
      'Työttömyysaste (%)': unempData.find(d => d.year === year)?.[execMuni]
    }));

    const proj2030 = {
      pop: projData['vaesto_e24']?.find(d => d.year === 2030)?.[execMuni] || 0,
      netMigration: projData['vm4243_e24']?.find(d => d.year === 2030)?.[execMuni] || 0,
      births: projData['vm01_e24']?.find(d => d.year === 2030)?.[execMuni] || 0,
      popChange: projData['valisays_e24']?.find(d => d.year === 2030)?.[execMuni] || 0,
    };

    return {
      current,
      trends,
      trendLabels,
      enterpriseChartData,
      lastHistoricalBusYear,
      empUnempChartData,
      proj2030
    };
  }, [execMuni, selectedYear, availableYears, popData, empData, unempData, busData, projData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-brand-500 w-12 h-12 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Haetaan virallista dataa Tilastokeskukselta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Tabs */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Aluekehityksen Dashboard</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live API
              </span>
            </div>
            <p className="text-slate-500 mt-1">Elinvoima, väestö ja työllisyys Keski-Pohjanmaalla</p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="global-year-select" className="text-sm font-medium text-slate-600 hidden md:block">Tarkasteluvuosi:</label>
            <select 
              id="global-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-4 py-2 text-sm bg-white font-medium shadow-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </header>

        {/* View Mode Switcher */}
        <div className="flex space-x-1 bg-slate-200/60 p-1.5 rounded-xl w-fit">
          <button 
            onClick={() => setViewMode('regional')} 
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'regional' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Alueellinen yleisnäkymä
          </button>
          <button 
            onClick={() => setViewMode('executive')} 
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'executive' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Kuntajohdon työpöytä
          </button>
        </div>

        {/* ======================================= */}
        {/* VIEW 1: REGIONAL (ALUEELLINEN)          */}
        {/* ======================================= */}
        {viewMode === 'regional' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Controls & AI Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin size={20} className="text-brand-500" />
                  Valitse Kunnat
                </h2>
                <div className="space-y-3 flex-grow">
                  <button onClick={toggleAll} className="w-full flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors mb-2">
                    {selectedMuni.length === allMunicipalities.length ? <><CheckSquare size={16} /> Poista kaikki valinnat</> : <><Square size={16} /> Valitse kaikki</>}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {allMunicipalities.map(muni => (
                      <label key={muni} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${selectedMuni.includes(muni) ? 'bg-brand-50 border-brand-200 text-brand-900' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'}`}>
                        <input type="checkbox" className="hidden" checked={selectedMuni.includes(muni)} onChange={() => toggleMunicipality(muni)} />
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: municipalityColors[muni], opacity: selectedMuni.includes(muni) ? 1 : 0.3 }} />
                        <span className="font-medium text-sm">{muni}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <AIInsights popData={popData} empData={empData} unempData={unempData} busData={busData} selectedMunicipalities={selectedMuni} />
              </div>
            </div>

            {/* Stats Grid */}
            {regionalStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title={`Yhteisväkiluku (${selectedYear})`} 
                  value={regionalStats.currentTotal.toLocaleString('fi-FI')} 
                  icon={<Users size={24} />}
                  trend={{ value: parseFloat(regionalStats.pctChange), label: `vs ${availableYears[0]} (%)` }}
                />
                <StatCard 
                  title={`Suurin kunta (${selectedYear})`} 
                  value={regionalStats.largest} 
                  icon={<MapPin size={24} />}
                />
                <StatCard 
                  title="Väestökehityksen suunta" 
                  value={parseFloat(regionalStats.pctChange) > 0 ? "Kasvava" : "Laskeva"} 
                  icon={parseFloat(regionalStats.pctChange) > 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                />
              </div>
            )}

            {selectedMuni.length > 0 ? (
              <>
                {/* Data Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200 flex justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold">Alueellinen Yhteenveto ({selectedYear})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700">Kunta / Alue</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Väkiluku</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Työllisyysaste 18-64v (%)</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Työttömyysaste (%)</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Yritykset</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Koulutushakijat</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Syntyneet</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {regionalTableData?.rows.map((row) => (
                          <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                                <span className="font-medium text-slate-800">{row.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-600">{row.population != null ? row.population.toLocaleString('fi-FI') : '-'}</td>
                            <td className="px-6 py-4 text-right text-slate-600 font-medium">
                              {row.employment != null ? `${row.employment.toFixed(1)} %` : '-'}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-600 font-medium">
                              {row.unemployment != null ? `${row.unemployment.toFixed(1)} %` : '-'}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-600">{row.business != null ? row.business : '-'}</td>
                            <td className="px-6 py-4 text-right">
                              {row.education != null ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                  {row.education}
                                </span>
                              ) : <span className="text-slate-400">-</span>}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-600">
                               {row.births != null ? row.births : <span className="text-slate-400">-</span>}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-brand-50/50 border-t-2 border-brand-200 font-semibold">
                          <td className="px-6 py-4 text-brand-900">Valitut alueet yhteensä</td>
                          <td className="px-6 py-4 text-right text-brand-900">{regionalTableData?.totals.population.toLocaleString('fi-FI')}</td>
                          <td className="px-6 py-4 text-right text-brand-900">
                            {regionalTableData?.totals.employment > 0 ? (
                              <div className="flex flex-col items-end">
                                <span>{regionalTableData.totals.employment.toFixed(1)} %</span>
                                <span className="text-[10px] font-normal opacity-70">(Keskiarvo)</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-brand-900">
                            {regionalTableData?.totals.unemployment > 0 ? (
                               <div className="flex flex-col items-end">
                                 <span>{regionalTableData.totals.unemployment.toFixed(1)} %</span>
                                 <span className="text-[10px] font-normal opacity-70">(Keskiarvo)</span>
                               </div>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-brand-900">{regionalTableData?.totals.business}</td>
                          <td className="px-6 py-4 text-right text-brand-900">{regionalTableData?.totals.education}</td>
                          <td className="px-6 py-4 text-right text-brand-900">{regionalTableData?.totals.births}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Population Line Chart with Projections */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px]">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <Users size={18} className="text-brand-500" /> Väestönkehitys ja Ennuste (2045)
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={combinedPopData} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                        <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <ReferenceLine x={2024} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'top', value: 'Ennuste ->', fill: '#94a3b8', fontSize: 12 }} />
                        {selectedMuni.map(muni => (
                          <Line key={muni} type="monotone" dataKey={muni} stroke={municipalityColors[muni]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Enterprise Bar Chart */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px]">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <Building2 size={18} className="text-brand-500" /> Yrityskanta ({selectedYear})
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={regionalTableData?.rows} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                        <Bar dataKey="business" fill="#f59e0b" name="Yritykset" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
                <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-medium text-slate-700">Ei kuntia valittuna</h3>
                <p className="text-slate-500 mt-2">Valitse vähintään yksi kunta yllä olevasta valikosta nähdäksesi dataa.</p>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW 2: EXECUTIVE (KUNTAJOHDON TYÖPÖYTÄ)*/}
        {/* ======================================= */}
        {viewMode === 'executive' && execData && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{execMuni}</h2>
                <p className="text-slate-500">Kuntajohdon elinvoimakatsaus ({selectedYear})</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <label className="text-sm font-medium text-slate-600">Vaihda kuntaa:</label>
                <select 
                  value={execMuni}
                  onChange={(e) => setExecMuni(e.target.value as Municipality)}
                  className="border-2 border-brand-200 rounded-lg px-4 py-2 text-brand-900 font-semibold bg-brand-50 focus:ring-2 focus:ring-brand-500 focus:outline-none flex-grow sm:flex-grow-0"
                >
                  {allMunicipalities.map(muni => (
                    <option key={muni} value={muni}>{muni}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main KPI Grid - 4 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <StatCard 
                title="Väkiluku" 
                value={execData.current.pop != null ? execData.current.pop.toLocaleString('fi-FI') : '-'} 
                icon={<Users size={24} />}
                trend={execData.trends.pop !== undefined ? { value: execData.trends.pop, label: execData.trendLabels.pop } : undefined}
              />
              <StatCard 
                title="Työllisyysaste" 
                value={execData.current.emp != null ? `${execData.current.emp.toFixed(1)} %` : '-'} 
                icon={<Briefcase size={24} />}
                trend={execData.trends.emp !== undefined ? { value: execData.trends.emp, label: execData.trendLabels.emp } : undefined}
              />
              <StatCard 
                title="Työttömyysaste" 
                value={execData.current.unemp != null ? `${execData.current.unemp.toFixed(1)} %` : '-'} 
                icon={<TrendingDown size={24} />}
                trend={execData.trends.unemp !== undefined ? { value: execData.trends.unemp, label: execData.trendLabels.unemp } : undefined}
                inverseTrend={true}
              />
              <StatCard 
                title="Yritykset" 
                value={execData.current.bus != null ? execData.current.bus : '-'} 
                icon={<Building2 size={24} />}
                trend={execData.trends.bus !== undefined ? { value: execData.trends.bus, label: execData.trendLabels.bus } : undefined}
              />
            </div>

            {/* Projection Section (2030) */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-xl">
               <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                 <ArrowRight size={20} className="text-indigo-500" /> Tulevaisuuden näkymät (Väestöennuste 2030)
               </h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-50/50">
                     <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Ennustettu Väkiluku</p>
                     <p className="text-2xl font-bold text-slate-800">{execData.proj2030.pop.toLocaleString('fi-FI')}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-50/50">
                     <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Väestönlisäys</p>
                     <p className={`text-2xl font-bold ${execData.proj2030.popChange > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {execData.proj2030.popChange > 0 ? '+' : ''}{execData.proj2030.popChange}
                     </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-50/50">
                     <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Nettomuutto</p>
                     <p className={`text-2xl font-bold ${execData.proj2030.netMigration > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {execData.proj2030.netMigration > 0 ? '+' : ''}{execData.proj2030.netMigration}
                     </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-50/50">
                     <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Syntyneet (2030)</p>
                     <div className="flex items-center gap-2">
                         <Baby size={20} className="text-brand-500" />
                         <p className="text-2xl font-bold text-slate-800">{execData.proj2030.births}</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Exec Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Työllisyys- ja Työttömyysaste 2020-2024 */}
              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[450px]">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Briefcase size={18} className="text-brand-500" /> Työllisyys- ja työttömyysaste (2020-2024)
                </h3>
                <p className="text-sm text-slate-500 mb-6">18-64-vuotiaiden osuus</p>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={execData.empUnempChartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} domain={['auto', 'auto']} width={40} />
                    
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    
                    <Line type="monotone" name="Työllisyysaste (%)" dataKey="Työllisyysaste (%)" stroke="#0ea5e9" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={true} />
                    <Line type="monotone" name="Työttömyysaste (%)" dataKey="Työttömyysaste (%)" stroke="#f43f5e" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={true} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Enterprise Trend Chart WITH 5 YEAR FORECAST */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[450px] flex flex-col">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Building2 size={18} className="text-brand-500" /> Yrityskannan trendi ja ennuste
                </h3>
                <p className="text-sm text-slate-500 mb-6">Yritysten lukumäärä + 5 vuoden ennuste</p>
                <div className="flex-grow">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={execData.enterpriseChartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                        <defs>
                          <linearGradient id="colorBus" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorBusProj" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                        <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        
                        <ReferenceLine x={execData.lastHistoricalBusYear} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'top', value: 'Ennuste ->', fill: '#94a3b8', fontSize: 12 }} />
                        
                        <Area type="monotone" name="Yritykset (Toteuma)" dataKey="Yritykset (Toteuma)" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorBus)" connectNulls={true} />
                        <Area type="monotone" name="Yritykset (Ennuste)" dataKey="Yritykset (Ennuste)" stroke="#f59e0b" strokeWidth={3} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorBusProj)" connectNulls={true} />
                      </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;