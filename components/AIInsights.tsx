import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { analyzePopulationTrend } from '../services/geminiService';
import { YearlyData, Municipality } from '../types';

interface AIInsightsProps {
  popData: YearlyData[];
  empData: YearlyData[];
  unempData: YearlyData[];
  busData: YearlyData[];
  selectedMunicipalities: Municipality[];
}

export const AIInsights: React.FC<AIInsightsProps> = ({ popData, empData, unempData, busData, selectedMunicipalities }) => {
  const [insight, setInsight] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const fetchInsight = async () => {
      setIsLoading(true);
      const result = await analyzePopulationTrend(popData, empData, unempData, busData, selectedMunicipalities);
      if (isMounted) {
        setInsight(result);
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
        fetchInsight();
    }, 800);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [popData, empData, unempData, busData, selectedMunicipalities]);

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-brand-50 rounded-xl p-6 border border-indigo-100 shadow-sm relative overflow-hidden h-full">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles size={64} className="text-indigo-600" />
      </div>
      
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={20} className="text-indigo-600" />
          <h3 className="text-lg font-semibold text-indigo-900">Tekoälyn tilannekuva</h3>
        </div>
        
        {isLoading ? (
          <div className="flex items-center gap-3 text-indigo-600/70 py-2 flex-grow">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Analysoidaan dataa...</span>
          </div>
        ) : (
          <p className="text-indigo-900/80 text-sm leading-relaxed flex-grow">
            {insight}
          </p>
        )}
      </div>
    </div>
  );
};