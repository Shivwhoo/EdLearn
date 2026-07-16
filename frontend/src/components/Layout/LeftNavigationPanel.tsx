import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Calendar, CheckCircle2, ChevronRight, GraduationCap, Award, Compass, Zap, HelpCircle, Key, LogOut, X, Lock, RefreshCw } from 'lucide-react';
import axios from 'axios';
import BadgeDetailModal from '@/components/Document/BadgeDetailModal';
import type { Badge } from '@/store/workspaceStore';

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
    completedDays,
    badges,
  } = useWorkspaceStore();

  // How many days of the active roadmap are done (for the progress caption).
  const totalDays = roadmap?.days.length ?? 0;
  const completedCount = roadmap
    ? roadmap.days.filter((d) => completedDays.has(d.id)).length
    : 0;

  const [viewBadge, setViewBadge] = React.useState<Badge | null>(null);
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
    <aside className="print:hidden w-full h-full bg-white p-6 flex flex-col justify-between overflow-y-auto">
      <div>
        <div className="flex items-center space-x-2 mb-8">
          <GraduationCap className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold tracking-wider text-slate-900">EdLearn</span>
        </div>

        {/* Selected Roadmap Daily Checklist */}
        <div className="mb-8">
          <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>Roadmap Progress</span>
            </span>
            {totalDays > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded normal-case tracking-normal ${
                completedCount >= totalDays
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {completedCount}/{totalDays} done
              </span>
            )}
          </h3>
          <div className="space-y-2">
            {roadmap.days.map((day) => {
              const isSelected = currentDay?.id === day.id;
              const hasContent = (day.topics?.length ?? 0) > 0;
              const isScrollCompleted = completedDays.has(day.id);
              return (
                <button
                  key={day.id}
                  onClick={() => selectDay(day)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : isScrollCompleted
                      ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-slate-700'
                      : hasContent
                      ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {isScrollCompleted ? (
                      // Fully scrolled through — solid filled check circle
                      <div className={`h-5 w-5 flex-shrink-0 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-blue-500' : 'bg-emerald-500'
                      }`}>
                        <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    ) : hasContent ? (
                      // Notes generated but not yet read through — outline check
                      <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${
                        isSelected ? 'text-blue-400' : 'text-slate-400'
                      }`} />
                    ) : (
                      // No content yet — empty circle
                      <div className={`h-5 w-5 flex-shrink-0 rounded-full border-2 ${
                        isSelected ? 'border-blue-500' : 'border-slate-300'
                      }`} />
                    )}
                    <div>
                      <div className="text-xs text-slate-500">Day {day.dayNumber}</div>
                      <div className="text-sm font-medium line-clamp-1">{day.title}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isScrollCompleted && !isSelected && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded uppercase tracking-wide">Done</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pedagogical Modes Selector */}
        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">Pedagogical Modes</h3>
          <p className="text-xs text-slate-500 italic leading-normal bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
            Modes have been suspended to focus entirely on high-quality study notes.
          </p>

          {/* Duo Podcast — always available */}
          <button
            onClick={() => setActiveMode(7)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
              activeMode === 7
                ? 'bg-violet-50 border-violet-300 text-violet-700'
                : 'bg-slate-50 border-slate-200 hover:bg-violet-50 hover:border-violet-200 text-slate-500 hover:text-violet-700'
            }`}
          >
            <span className="text-lg">🎙️</span>
            <div>
              <div className="text-xs font-semibold tracking-wide">Duo Podcast</div>
              <div className="text-[10px] text-slate-500">AI host &amp; expert dialogue</div>
            </div>
            {activeMode === 7 && (
              <span className="ml-auto text-[10px] font-semibold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded uppercase tracking-wide">Active</span>
            )}
          </button>
        </div>

        {/* Earned Badges shelf — course-completion rewards saved to the DB */}
        <div className="border-t border-slate-200 pt-5 mt-5">
          <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-3 flex items-center space-x-1">
            <Award className="h-4 w-4 text-amber-500" />
            <span>My Badges</span>
          </h3>
          {badges.length === 0 ? (
            <p className="text-xs text-slate-500 italic leading-normal bg-slate-50 p-3 rounded-lg border border-slate-200">
              Complete all days of a roadmap to earn your first course badge.
            </p>
          ) : (
            <div className="space-y-2">
              {badges.map((badge) => (
                <button
                  key={badge.id}
                  onClick={() => setViewBadge(badge)}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg bg-gradient-to-br from-amber-50 to-white border border-amber-100 hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer"
                  title="View badge details"
                >
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-sm">
                    <Award className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{badge.title}</div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(badge.earnedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* User profile capsule */}
      <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center font-semibold text-blue-600 border border-blue-100">
            {(user?.fullName || userProfile?.fullName)?.[0] || 'S'}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 max-w-[110px] truncate">{user?.fullName || userProfile?.fullName || 'Student'}</div>
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
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Change Password"
          >
            <Key className="h-4 w-4" />
          </button>
          <button
            onClick={logout}
            className="p-2 hover:bg-rose-50 rounded-lg text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-slate-100 rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Lock className="h-4.5 w-4.5 text-blue-600" />
                Change Password
              </h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs">
                {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 text-xs">
                {modalSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 letter, 1 number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold tracking-[0.01em] shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
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

      {/* Badge detail popup (opens when a badge card is clicked) */}
      <BadgeDetailModal badge={viewBadge} onClose={() => setViewBadge(null)} />
    </aside>
  );
};
export default LeftNavigationPanel;
