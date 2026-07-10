import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Calendar, CheckCircle2, ChevronRight, GraduationCap, Award, Compass, Zap, HelpCircle } from 'lucide-react';

export const LeftNavigationPanel: React.FC = () => {
  const {
    roadmap,
    currentDay,
    activeMode,
    selectDay,
    setActiveMode,
    userProfile,
  } = useWorkspaceStore();

  const modes = [
    { id: 1, name: 'Accelerator', desc: 'Pareto 80/20 & build task', icon: Zap },
    { id: 2, name: 'Socratic Practice', desc: 'Scenario code test', icon: HelpCircle },
    { id: 3, name: 'Concept Simplifier', desc: 'Kid analogy analogies', icon: Compass },
    { id: 4, name: 'Personalized Roadmap', desc: 'Manage your timeline', icon: Calendar },
    { id: 5, name: 'Gap Finder', desc: 'Brutal audit questions', icon: Award },
    { id: 6, name: 'Feynman Test', desc: 'Explain to a 10-year-old', icon: GraduationCap },
  ];

  if (!roadmap) return null;

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between h-[calc(100vh-80px)] overflow-y-auto">
      <div>
        <div className="flex items-center space-x-2 mb-8">
          <GraduationCap className="h-8 w-8 text-indigo-500" />
          <span className="text-xl font-bold tracking-wider bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent">EdLearn</span>
        </div>

        {/* Selected Roadmap Daily Checklist */}
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center space-x-1">
            <Calendar className="h-4 w-4 text-indigo-500" />
            <span>Roadmap Progress</span>
          </h3>
          <div className="space-y-2">
            {roadmap.days.map((day) => {
              const isSelected = currentDay?.id === day.id;
              return (
                <button
                  key={day.id}
                  onClick={() => selectDay(day)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-200'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className={`h-5 w-5 ${isSelected ? 'text-indigo-400' : 'text-slate-600'}`} />
                    <div>
                      <div className="text-xs text-slate-500">Day {day.dayNumber}</div>
                      <div className="text-sm font-medium line-clamp-1">{day.title}</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Pedagogical Modes Selector */}
        <div className="border-t border-slate-850 pt-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pedagogical Modes</h3>
          <p className="text-xs text-slate-500/80 italic leading-normal bg-slate-950/20 p-3 rounded-lg border border-slate-800/40">
            Modes have been suspended to focus entirely on high-quality study notes.
          </p>
        </div>
      </div>

      {/* User profile capsule */}
      <div className="pt-6 border-t border-slate-800 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400 border border-slate-700">
          {userProfile?.fullName?.[0] || 'S'}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-300">{userProfile?.fullName || 'Student'}</div>
          <div className="text-xs text-slate-500">{userProfile?.difficulty || 'Intermediate'}</div>
        </div>
      </div>
    </aside>
  );
};
export default LeftNavigationPanel;
