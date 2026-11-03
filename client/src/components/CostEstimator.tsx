import React from 'react';
import { DollarSign, Zap } from 'lucide-react';

interface CostEstimatorProps {
  quality: 'low' | 'medium' | 'high';
}

export const CostEstimator: React.FC<CostEstimatorProps> = ({ quality }) => {
  const getCostData = () => {
    switch (quality) {
      case 'low':
        return {
          total: '~$0.07',
          perImage: '~$0.006',
          speed: 'Fast (1-2 mins)',
          label: 'Testing & Drafts',
        };
      case 'high':
        return {
          total: '~$2.15',
          perImage: '~$0.211',
          speed: 'Fine detail (3-6 mins)',
          label: 'Final Presentation',
        };
      case 'medium':
      default:
        return {
          total: '~$0.55 – $0.65',
          perImage: '~$0.053',
          speed: 'Standard (2-4 mins)',
          label: 'Everyday Runs',
        };
    }
  };

  const cost = getCostData();

  return (
    <div className="flex items-center space-x-2 text-xs py-1.5 px-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300">
      <div className="flex items-center text-gold-400 font-semibold space-x-0.5">
        <DollarSign className="w-3.5 h-3.5" />
        <span>Estimated Cost:</span>
      </div>
      <span className="font-mono text-gold-300 font-bold">{cost.total}</span>
      <span className="text-zinc-500">•</span>
      <span className="text-zinc-400 hidden sm:inline">{cost.label}</span>
      <span className="text-zinc-500 hidden sm:inline">•</span>
      <div className="hidden sm:flex items-center text-zinc-400 space-x-1">
        <Zap className="w-3 h-3 text-amber-400" />
        <span>{cost.speed}</span>
      </div>
    </div>
  );
};
