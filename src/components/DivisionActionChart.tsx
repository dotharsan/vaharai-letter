import React, { useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Compass,
  EyeOff,
  Building2,
  Layers,
  Filter,
  FileSpreadsheet,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { Letter, LetterAction, User } from '../types';
import { DIVISIONS } from '../data/initialData';
import { exportLettersToExcel, printLandscapeReport, ensureStringArray } from '../utils/helpers';

interface DivisionActionChartProps {
  letters: Letter[];
  allUsers: User[];
  currentUser: User;
  onFilterByStatus?: (status: string) => void;
  onFilterByDivision?: (division: string) => void;
  currentStatusFilter?: string;
}

export const DivisionActionChart: React.FC<DivisionActionChartProps> = ({
  letters,
  allUsers,
  currentUser,
  onFilterByStatus,
  onFilterByDivision,
  currentStatusFilter = 'All',
}) => {
  const usersMap = new Map<string, User>(allUsers.map((u) => [u.User_ID, u]));

  // Default selected division based on user role
  const defaultDiv =
    currentUser.Role === 'Normal' || currentUser.Role === 'User'
      ? currentUser.Division
      : currentUser.Role === 'Luxury' && currentUser.assignedDivisions?.length
      ? currentUser.assignedDivisions[0]
      : 'All Divisions';

  const [selectedDivision, setSelectedDivision] = useState<string>(defaultDiv);
  const [viewMode, setViewMode] = useState<'single' | 'matrix'>('single');

  // Filter letters for selected division
  const divisionLetters =
    selectedDivision === 'All Divisions'
      ? letters
      : letters.filter(
          (l) =>
            l.division === selectedDivision ||
            ensureStringArray(l.forwardedDivisions).includes(selectedDivision) ||
            ensureStringArray(l.forwardedTo).some((uid) => usersMap.get(uid)?.Division === selectedDivision)
        );

  const getCounts = (letterList: Letter[]) => {
    const counts: Record<string, number> = {
      'Action Taken': 0,
      'Action Not Taken': 0,
      'Under Investigation': 0,
      'Not Yet Viewed': 0,
    };

    letterList.forEach((l) => {
      if (l.action === 'Action Taken' || l.action === 'நடவடிக்கை எடுக்கப்பட்டது') {
        counts['Action Taken']++;
      } else if (l.action === 'Action Not Taken' || l.action === 'நடவடிக்கை எடுக்கப்படவில்லை') {
        counts['Action Not Taken']++;
      } else if (l.action === 'Under Investigation' || l.action === 'கள ஆய்வில்') {
        counts['Under Investigation']++;
      } else {
        counts['Not Yet Viewed']++;
      }
    });

    return counts;
  };

  const counts = getCounts(divisionLetters);
  const totalInDiv = divisionLetters.length;

  const statusConfigs = [
    {
      key: 'Action Taken',
      label: 'Action Taken',
      tamilLabel: 'நடவடிக்கை எடுக்கப்பட்டது',
      count: counts['Action Taken'],
      color: 'bg-emerald-600',
      bgLight: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-800',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    },
    {
      key: 'Action Not Taken',
      label: 'Action Not Taken',
      tamilLabel: 'நடவடிக்கை எடுக்கப்படவில்லை',
      count: counts['Action Not Taken'],
      color: 'bg-rose-600',
      bgLight: 'bg-rose-50',
      borderColor: 'border-rose-200',
      textColor: 'text-rose-800',
      icon: <XCircle className="h-4 w-4 text-rose-600" />,
    },
    {
      key: 'Under Investigation',
      label: 'Under Investigation',
      tamilLabel: 'கள ஆய்வில்',
      count: counts['Under Investigation'],
      color: 'bg-amber-500',
      bgLight: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-800',
      icon: <Compass className="h-4 w-4 text-amber-600" />,
    },
    {
      key: 'Not Yet Viewed',
      label: 'Not Yet Viewed',
      tamilLabel: 'இன்னும் பார்க்கவில்லை',
      count: counts['Not Yet Viewed'],
      color: 'bg-blue-600',
      bgLight: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      icon: <EyeOff className="h-4 w-4 text-blue-600" />,
    },
  ];

  // List of selectable divisions
  const allowedDivisions =
    currentUser.Role === 'Luxury' && currentUser.assignedDivisions?.length
      ? currentUser.assignedDivisions
      : currentUser.Role === 'Normal' || currentUser.Role === 'User'
      ? [currentUser.Division]
      : ['All Divisions', ...DIVISIONS];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs mb-6">
      {/* Header with Division Selector and Views */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2.5 text-blue-800 shadow-2xs">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">
                Division Status Analytics & Progress Graph
              </h3>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                {selectedDivision}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Live status breakdown of incoming mail and action taken across divisional departments.
            </p>
          </div>
        </div>

        {/* Division Dropdown Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {allowedDivisions.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Building2 className="h-4 w-4 text-gray-500" />
              <select
                value={selectedDivision}
                onChange={(e) => {
                  setSelectedDivision(e.target.value);
                  onFilterByDivision?.(e.target.value);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:border-blue-600 focus:outline-hidden"
              >
                {allowedDivisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                viewMode === 'single'
                  ? 'bg-white text-blue-900 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Summary Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`rounded px-2.5 py-1 font-semibold transition ${
                viewMode === 'matrix'
                  ? 'bg-white text-blue-900 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Divisions Grid
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              exportLettersToExcel(divisionLetters, usersMap, `${selectedDivision.replace(/\s+/g, '_')}_Status`)
            }
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition"
            title="Download Division Excel Report"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            type="button"
            onClick={() =>
              printLandscapeReport(
                `${selectedDivision} Mail Status Report`,
                divisionLetters,
                usersMap
              )
            }
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-900 transition"
            title="Print Official A4 Landscape Report (10pt font)"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print (10pt)</span>
          </button>
        </div>
      </div>

      {/* Main Single Division View Cards */}
      {viewMode === 'single' ? (
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {statusConfigs.map((cfg) => {
            const percentage = totalInDiv > 0 ? Math.round((cfg.count / totalInDiv) * 100) : 0;
            const isFilterActive = currentStatusFilter === cfg.key;

            return (
              <div
                key={cfg.key}
                onClick={() => onFilterByStatus?.(isFilterActive ? 'All' : cfg.key)}
                className={`cursor-pointer rounded-xl border ${cfg.borderColor} ${
                  cfg.bgLight
                } p-4 transition hover:shadow-md ${
                  isFilterActive ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {cfg.icon}
                    <span className={cfg.textColor}>{cfg.label}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-500">{percentage}%</span>
                </div>

                <div className="my-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-gray-900">{cfg.count}</span>
                    <span className="ml-1.5 text-xs font-semibold text-gray-500">letters</span>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-700 hover:underline">
                    {isFilterActive ? 'Clear Filter' : 'Filter by this'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.color}`}
                    style={{ width: `${Math.max(4, percentage)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Matrix View: Breakdown across all divisions */
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-bold">
                <th className="py-2.5 px-3">Division / Department</th>
                <th className="py-2.5 px-3 text-center">Total Mail</th>
                <th className="py-2.5 px-3 text-center text-emerald-700">Action Taken</th>
                <th className="py-2.5 px-3 text-center text-rose-700">Action Not Taken</th>
                <th className="py-2.5 px-3 text-center text-amber-700">Under Investigation</th>
                <th className="py-2.5 px-3 text-center text-blue-700">Not Yet Viewed</th>
                <th className="py-2.5 px-3 text-right">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {DIVISIONS.map((divName) => {
                const divLtrs = letters.filter(
                  (l) =>
                    l.division === divName ||
                    ensureStringArray(l.forwardedDivisions).includes(divName) ||
                    ensureStringArray(l.forwardedTo).some((uid) => usersMap.get(uid)?.Division === divName)
                );
                const divCounts = getCounts(divLtrs);
                const rate =
                  divLtrs.length > 0
                    ? Math.round((divCounts['Action Taken'] / divLtrs.length) * 100)
                    : 0;

                return (
                  <tr
                    key={divName}
                    onClick={() => {
                      setSelectedDivision(divName);
                      setViewMode('single');
                      onFilterByDivision?.(divName);
                    }}
                    className="hover:bg-blue-50/50 cursor-pointer transition"
                  >
                    <td className="py-2.5 px-3 font-semibold text-gray-900 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-gray-500" />
                      <span>{divName}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-gray-800">
                      {divLtrs.length}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-700 bg-emerald-50/40">
                      {divCounts['Action Taken']}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-700 bg-rose-50/40">
                      {divCounts['Action Not Taken']}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-700 bg-amber-50/40">
                      {divCounts['Under Investigation']}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-blue-700 bg-blue-50/40">
                      {divCounts['Not Yet Viewed']}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-gray-700">{rate}%</span>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-emerald-600"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
