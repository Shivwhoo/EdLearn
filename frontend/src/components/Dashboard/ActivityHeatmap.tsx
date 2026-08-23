'use client';

import React, { useState } from 'react';
import { Calendar, Activity, Info } from 'lucide-react';

interface HeatmapDay {
  date: string;
  count: number;
  level: number;
}

interface ActivityHeatmapProps {
  heatmapData: HeatmapDay[];
  totalCompletions: number;
}

const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-slate-100 border-slate-200/50',
  1: 'bg-emerald-200 border-emerald-300',
  2: 'bg-emerald-400 border-emerald-500',
  3: 'bg-emerald-600 border-emerald-700',
  4: 'bg-emerald-700 border-emerald-800',
};

export default function ActivityHeatmap({ heatmapData, totalCompletions }: ActivityHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  // Group 365 days into 53 weeks (columns of 7 days)
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < heatmapData.length; i += 7) {
    weeks.push(heatmapData.slice(i, i + 7));
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Study Activity Matrix</h3>
            <p className="text-xs text-slate-500">
              {totalCompletions} lessons & milestones completed over the past year
            </p>
          </div>
        </div>

        {/* Hovered day tooltip info */}
        <div className="h-6 flex items-center text-xs text-slate-600 font-medium">
          {hoveredDay ? (
            <span className="bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full text-slate-700">
              {hoveredDay.count === 0 ? 'No activity' : `${hoveredDay.count} completion${hoveredDay.count > 1 ? 's' : ''}`}{' '}
              on {new Date(hoveredDay.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          ) : (
            <span className="text-slate-400 text-[11px]">Hover over any square for daily details</span>
          )}
        </div>
      </div>

      {/* Heatmap Grid Container */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[680px]">
          {/* Month labels */}
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            {months.map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>

          {/* Days Grid: 7 rows x 53 cols */}
          <div className="grid grid-flow-col grid-rows-7 gap-1">
            {heatmapData.map((day, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`h-3 w-3 rounded-xs border transition-all cursor-pointer hover:scale-125 hover:z-10 ${
                  LEVEL_COLORS[day.level] || LEVEL_COLORS[0]
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-4 pt-4 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>Past 365 Days</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <div key={lvl} className={`h-2.5 w-2.5 rounded-xs border ${LEVEL_COLORS[lvl]}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
