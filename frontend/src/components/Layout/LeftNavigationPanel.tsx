import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Calendar, CheckCircle2, ChevronRight, GraduationCap, Award, Compass, Zap, HelpCircle, Key, LogOut, X, Lock, RefreshCw } from 'lucide-react';
import axios from 'axios';

export const LeftNavigationPanel: React.FC = () => {
  const {
    roadmap,
    currentDay,
    activeMode,
    selectDay,
    setActiveMode,
    userProfile,
    logout,
    user,
  } = useWorkspaceStore();

  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [modalError, setModalError] = React.useState('');
  const [modalSuccess, setModalSuccess] = React.useState('');
  const [modalLoading, setModalLoading] = React.useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setModalError('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 8) {
      setModalError('New password must be at least 8 characters long.');
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setModalError('New password must contain at least one letter and one number.');
      return;
    }

    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const res = await axios.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });

      if (res.data?.success) {
        setModalSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setTimeout(() => setShowPasswordModal(false), 1500);
      }
    } catch (err: any) {
      console.error(err);
      setModalError(err.response?.data?.error || 'Failed to change password. Please check your inputs.');
    } finally {
      setModalLoading(false);
    }
  };

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
    <aside className="print:hidden w-80 border-r border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between h-[calc(100vh-80px)] overflow-y-auto">
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
              const hasContent = (day.topics?.length ?? 0) > 0;
              return (
                <button
                  key={day.id}
                  onClick={() => selectDay(day)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-200'
                      : hasContent
                      ? 'bg-emerald-500/5 border-emerald-700/30 hover:bg-emerald-500/10 text-slate-300'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {hasContent ? (
                      <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${isSelected ? 'text-indigo-400' : 'text-emerald-500'}`} />
                    ) : (
                      <div className={`h-5 w-5 flex-shrink-0 rounded-full border-2 ${isSelected ? 'border-indigo-400' : 'border-slate-600'}`} />
                    )}
                    <div>
                      <div className="text-xs text-slate-500">Day {day.dayNumber}</div>
                      <div className="text-sm font-medium line-clamp-1">{day.title}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasContent && !isSelected && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase tracking-wide">Done</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  </div>
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
      <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400 border border-slate-700">
            {(user?.fullName || userProfile?.fullName)?.[0] || 'S'}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-300 max-w-[110px] truncate">{user?.fullName || userProfile?.fullName || 'Student'}</div>
            <div className="text-xs text-slate-500">{userProfile?.difficulty || 'Intermediate'}</div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              setModalError('');
              setModalSuccess('');
              setCurrentPassword('');
              setNewPassword('');
              setShowPasswordModal(true);
            }}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Change Password"
          >
            <Key className="h-4 w-4" />
          </button>
          <button
            onClick={logout}
            className="p-2 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Lock className="h-4.5 w-4.5 text-indigo-400" />
                Change Password
              </h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs">
                {modalSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 letter, 1 number"
                  className="w-full bg-slate-955/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {modalLoading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
export default LeftNavigationPanel;
