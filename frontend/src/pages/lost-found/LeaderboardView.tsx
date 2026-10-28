import React from 'react';
import type { UserStats, LeaderboardUser } from '@/types/lost-found';
import { Trophy, Award, Shield, HeartHandshake, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LeaderboardViewProps {
  stats: UserStats | null;
  leaderboard: LeaderboardUser[];
  isLoading: boolean;
}

export const getBadgeIcon = (badgeName: string) => {
  switch (badgeName) {
    case 'Campus Guardian':
      return Shield;
    case 'Top Contributor':
      return Award;
    case 'Helper':
      return HeartHandshake;
    default:
      return CheckCircle2;
  }
};

export const getBadgeColor = (badgeName: string) => {
  switch (badgeName) {
    case 'Campus Guardian':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Top Contributor':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Helper':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  stats,
  leaderboard,
  isLoading,
}) => {
  const BadgeIcon = stats?.badge ? getBadgeIcon(stats.badge) : CheckCircle2;

  return (
    <div className="space-y-6">
      {/* User Contribution Hero Card */}
      {stats && (
        <div className="bg-linear-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-800">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                <BadgeIcon className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Your Campus Standing
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeColor(stats.badge)}`}>
                    {stats.badge}
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight">
                  {stats.totalPoints} <span className="text-base font-normal text-slate-300">Points</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Earn points by reporting found items (+10) and safely completing verified handovers (+20).
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 w-full md:w-auto justify-around md:justify-end">
              <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10 min-w-[100px]">
                <div className="text-xl font-bold text-emerald-400">{stats.itemsReported}</div>
                <div className="text-[11px] text-slate-400">Found Items Logged</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10 min-w-[100px]">
                <div className="text-xl font-bold text-amber-400">{stats.itemsReturned}</div>
                <div className="text-[11px] text-slate-400">Verified Returns</div>
              </div>
            </div>
          </div>

          {/* Progress Bar to next tier */}
          {stats.badgeInfo && stats.badgeInfo.badge !== 'Campus Guardian' && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-xs mb-1.5 text-slate-300">
                <span>Next Tier: <b>{stats.badgeInfo.badge === 'Newcomer' ? 'Helper (10 pts)' : stats.badgeInfo.badge === 'Helper' ? 'Top Contributor (50 pts)' : 'Campus Guardian (100 pts)'}</b></span>
                <span className="font-semibold">{stats.badgeInfo.progressPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.badgeInfo.progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campus Leaderboard Table */}
      <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Campus Honor Roll</h3>
              <p className="text-xs text-slate-500">
                Top students and faculty contributing to safe and honest campus recovery
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading campus leaderboard...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No contributions recorded yet. Be the first to report a found item or complete a handover!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {leaderboard.map((user) => {
              const UserBadgeIcon = getBadgeIcon(user.badge);

              return (
                <div
                  key={user.userId}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Rank Pill */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        user.rank === 1
                          ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-200'
                          : user.rank === 2
                          ? 'bg-slate-300 text-slate-800 ring-2 ring-slate-200'
                          : user.rank === 3
                          ? 'bg-amber-700/80 text-white ring-2 ring-amber-600/30'
                          : 'bg-slate-100 text-slate-600 font-medium'
                      }`}
                    >
                      {user.rank}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-xs">
                          {user.name}
                        </span>
                        <Badge variant="outline" className={`text-[10px] py-0 ${getBadgeColor(user.badge)}`}>
                          <UserBadgeIcon className="w-2.5 h-2.5 mr-1 inline" />
                          {user.badge}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {user.department} &bull; {user.role}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-slate-900 text-sm">
                      {user.points}
                    </span>
                    <span className="text-[11px] text-slate-400 block">points</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gamification Explanation Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-border shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Helper Tier (10+ pts)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Earned upon logging your first verified found item or participating in campus returns.
            </p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-border shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Top Contributor (50+ pts)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Dedicated campus members with repeated successful handovers and resolved lost reports.
            </p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-border shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Campus Guardian (100+ pts)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Elite community recognition for campus integrity and helping peers recover essentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

