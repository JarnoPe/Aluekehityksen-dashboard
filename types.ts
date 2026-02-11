import React from 'react';

export interface YearlyData {
  year: number;
  Halsua: number;
  Kaustinen: number;
  Toholampi: number;
  Lestijärvi: number;
  Veteli: number;
  [key: string]: number; // Allow dynamic access by municipality name
}

export type PopulationData = YearlyData;

export type Municipality = 'Halsua' | 'Kaustinen' | 'Toholampi' | 'Lestijärvi' | 'Veteli';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  inverseTrend?: boolean; // When true, a negative trend value is colored green, and positive is red.
}