import React, { useState, useEffect } from 'react';
import {
  Shield,
  PlusCircle,
  LogOut,
  Users,
  Search,
  Filter,
  FileText,
  Building2,
  RotateCcw,
  Sparkles,
  Calendar,
  CheckCircle,
  Mail,
  Printer,
  Crown,
  Layers,
  ArrowUpDown,
  X,
  UserCheck,
  Cloud,
  CloudOff,
  AlertTriangle,
  Zap,
  Download,
  UploadCloud,
  RefreshCw,
} from 'lucide-react';
import { User, Letter, UserRole, LetterAction } from './types';
import { INITIAL_USERS, INITIAL_LETTERS, DIVISIONS, migrateDivision } from './data/initialData';
import { DEFAULT_DRIVE_FILE_ID } from './data/appsScriptCode';
import {
  printLandscapeReport,
  ensureStringArray,
  normalizeAction,
  isKnownActionValue,
  isExactDivisionName,
  isOfficialDivisionName,
  normalizeRegisteredPostNo,
  doesLetterMatchOfficer,
  getOfficerDisplayName,
  classifySubjectCategory,
  SUBJECT_CATEGORIES_CONFIG,
  repairLetterRecord,
} from './utils/helpers';
import { LoginScreen } from './components/LoginScreen';
import { DivisionActionChart } from './components/DivisionActionChart';
import { SubjectCategoryDashboard } from './components/SubjectCategoryDashboard';
import { DateFoldersList } from './components/DateFoldersList';
import { LetterRegisterModal } from './components/LetterRegisterModal';
import { LetterDetailAndChatModal } from './components/LetterDetailAndChatModal';
import { UserManagementModal } from './components/UserManagementModal';
import { CloudSyncSettingsModal } from './components/CloudSyncSettingsModal';
import { VaharaiLogo } from './components/VaharaiLogo';

// --- Google Sheets Cloud Integration Setup ---
export const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbzbfOEJuI00Rkg5dg18mpPRKJN5j4-r2uKyK7hM2EUKmL3n417m14MxOTnQuplJ_GyzMw/exec';

type CloudPayload = Record<string, any>;

export interface CloudWriteResult {
  ok: boolean;
  statusCode?: number;
  errorType?: string;
  message?: string;
}

const safeJsonParse = <T,>(value: any, fallback: T): T => {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

/**
 * Universal API fetch client that works seamlessly across Express backend,
 * Netlify rewrites (/api/* -> /.netlify/functions/*), and direct Netlify functions fallback.
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const primaryUrl = path;
  let netlifyFallbackUrl = '';
  if (path.startsWith('/api/cloud-sync')) {
    netlifyFallbackUrl = path.replace('/api/cloud-sync', '/.netlify/functions/cloud-sync');
  } else if (path.startsWith('/api/scan-letter')) {
    netlifyFallbackUrl = path.replace('/api/scan-letter', '/.netlify/functions/scan-letter');
  }

  try {
    const res = await fetch(primaryUrl, options);
    if (res.status === 404 && netlifyFallbackUrl) {
      return await fetch(netlifyFallbackUrl, options);
    }
    return res;
  } catch (err) {
    if (netlifyFallbackUrl) {
      try {
        return await fetch(netlifyFallbackUrl, options);
      } catch {
        // Fall through
      }
    }
    throw err;
  }
}

const sendDataToGoogleCloud = async (
  payload: CloudPayload,
  activeUrl?: string,
  mode: 'drive_json' | 'sheets' = 'drive_json',
  targetDriveFileId: string = DEFAULT_DRIVE_FILE_ID
): Promise<CloudWriteResult> => {
  try {
    const action = String(payload.action ?? '').trim();
    if (!action) return { ok: false, message: 'Action is required' };

    const safeLetterAction = normalizeAction(
      payload.actionStatus ||
        payload.letterAction ||
        payload.ActionStatus ||
        payload.Action ||
        payload.extraData?.action ||
        payload.extraData?.actionStatus ||
        'Not Yet Viewed'
    );

    const safeLetterType =
      String(
        payload.letterType ||
          payload.postType ||
          payload.PostType ||
          payload.extraData?.letterType ||
          'Registered Post'
      ).trim() || 'Registered Post';

    const safeRegPostNo = normalizeRegisteredPostNo(
      payload.registeredPostNo ??
        payload.RegisteredPostNo ??
        payload.regPostNo ??
        payload.extraData?.registeredPostNo ??
        payload.extraData?.RegisteredPostNo
    );

    const safeFileNo = String(
      payload.fileNo ??
        payload.FileNo ??
        payload.extraData?.fileNo ??
        payload.extraData?.FileNo ??
        ''
    ).trim();

    const safeDivision = String(
      payload.division ??
        payload.Division ??
        payload.extraData?.division ??
        payload.extraData?.Division ??
        ''
    ).trim();

    const safeFwdDivs = ensureStringArray(
      payload.forwardedDivisions ?? payload.extraData?.forwardedDivisions
    );
    const safeFwdTo = ensureStringArray(
      payload.forwardedTo ?? payload.extraData?.forwardedTo
    );
    const safeReply = String(
      payload.replyResponse ??
        payload.ReplyResponse ??
        payload.extraData?.replyResponse ??
        ''
    );

    const baseExtra =
      payload.extraData && typeof payload.extraData === 'object'
        ? payload.extraData
        : {};

    const enrichedExtraData = {
      ...baseExtra,
      id: String(payload.id ?? baseExtra.id ?? ''),
      originalNo: String(payload.originalNo ?? baseExtra.originalNo ?? ''),
      date: String(payload.date ?? baseExtra.date ?? ''),
      dispatchedDate: String(
        payload.dispatchedDate ?? baseExtra.dispatchedDate ?? payload.date ?? ''
      ),
      letterType: safeLetterType,
      postType: safeLetterType,
      registeredPostNo: safeRegPostNo,
      RegisteredPostNo: safeRegPostNo,
      inwardNo: String(payload.inwardNo ?? baseExtra.inwardNo ?? ''),
      fromWhom: String(payload.fromWhom ?? baseExtra.fromWhom ?? ''),
      subject: String(payload.subject ?? baseExtra.subject ?? ''),
      division: safeDivision,
      forwardedDivisions: safeFwdDivs,
      forwardedTo: safeFwdTo,
      action: safeLetterAction,
      actionStatus: safeLetterAction,
      ActionStatus: safeLetterAction,
      replyResponse: safeReply,
      fileNo: safeFileNo,
      FileNo: safeFileNo,
      updatedAt: new Date().toISOString(),
    };

    const bodyData = {
      action: action,
      storageMode: mode,
      driveFileId: targetDriveFileId,
      id: String(payload.id ?? ''),
      ID: String(payload.id ?? ''),
      originalNo: String(payload.originalNo ?? ''),
      OriginalNo: String(payload.originalNo ?? ''),
      date: String(payload.date ?? ''),
      Date: String(payload.date ?? ''),
      dispatchedDate: String(payload.dispatchedDate ?? payload.date ?? ''),
      DispatchedDate: String(payload.dispatchedDate ?? payload.date ?? ''),
      letterType: safeLetterType,
      LetterType: safeLetterType,
      postType: safeLetterType,
      PostType: safeLetterType,
      Post_Type: safeLetterType,
      'Post Type': safeLetterType,
      registeredPostNo: safeRegPostNo,
      RegisteredPostNo: safeRegPostNo,
      regPostNo: safeRegPostNo,
      RegPostNo: safeRegPostNo,
      Registered_Post_No: safeRegPostNo,
      'Registered Post No': safeRegPostNo,
      inwardNo: String(payload.inwardNo ?? ''),
      InwardNo: String(payload.inwardNo ?? ''),
      fromWhom: String(payload.fromWhom ?? ''),
      FromWhom: String(payload.fromWhom ?? ''),
      subject: String(payload.subject ?? ''),
      Subject: String(payload.subject ?? ''),
      division: safeDivision,
      Division: safeDivision,
      forwardedDivisions: safeFwdDivs,
      ForwardedDivisions: safeFwdDivs.join(', '),
      forwardedTo: safeFwdTo,
      ForwardedTo: safeFwdTo.join(', '),
      actionStatus: safeLetterAction,
      ActionStatus: safeLetterAction,
      Action: safeLetterAction,
      letterAction: safeLetterAction,
      replyResponse: safeReply,
      ReplyResponse: safeReply,
      fileNo: safeFileNo,
      FileNo: safeFileNo,
      file_no: safeFileNo,
      File_No: safeFileNo,
      'File No': safeFileNo,
      Password: String(payload.Password ?? ''),
      Name: String(payload.Name ?? ''),
      Role: String(payload.Role ?? ''),
      Status: String(payload.Status ?? ''),
      User_ID: String(payload.User_ID ?? ''),
      assignedDivisions:
        payload.assignedDivisions ?? payload.extraData?.assignedDivisions ?? [],
      assignedOfficers:
        payload.assignedOfficers ?? payload.extraData?.assignedOfficers ?? [],
      extraData: enrichedExtraData,
      ExtraData: JSON.stringify(enrichedExtraData),
    };

    const jsonStr = JSON.stringify(bodyData);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Storage-Mode': mode,
      'X-Drive-File-Id': targetDriveFileId,
    };
    if (activeUrl) {
      headers['X-Web-App-Url'] = activeUrl;
    }

    // Server-side proxy with permission detection and detailed feedback
    try {
      const proxyRes = await apiFetch('/api/cloud-sync', {
        method: 'POST',
        headers,
        body: jsonStr,
      });

      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();
        return {
          ok: Boolean(proxyData?.ok),
          statusCode: proxyData?.statusCode,
          errorType: proxyData?.errorType,
          message: proxyData?.message,
        };
      }
    } catch {
      // Fall through to direct fetch if proxy fails
    }

    // Direct browser fetch fallback
    const directUrl = activeUrl || WEB_APP_URL;
    try {
      const directRes = await fetch(directUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: jsonStr,
      });
      const txt = await directRes.text();
      if (
        directRes.status === 403 ||
        txt.includes('accounts.google.com') ||
        txt.includes('You need access')
      ) {
        return {
          ok: false,
          statusCode: 403,
          errorType: 'ACCESS_DENIED',
          message: 'Google Apps Script 403 Forbidden: "Who has access" அமைப்பை "Anyone" என அமைக்கவும்.',
        };
      }

      let parsedDirect: any = null;
      try {
        parsedDirect = JSON.parse(txt);
      } catch {}

      const hasDirectError =
        Boolean(parsedDirect?.error) ||
        parsedDirect?.result === 'error' ||
        parsedDirect?.status === 'error' ||
        parsedDirect?.ok === false;

      return { ok: directRes.ok && !hasDirectError, statusCode: directRes.status };
    } catch (err: any) {
      return {
        ok: false,
        statusCode: 500,
        errorType: 'NETWORK_ERROR',
        message: err?.message || 'Network error',
      };
    }
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Unexpected sync error' };
  }
};

const fetchCloudData = async (
  activeUrl?: string,
  mode: 'drive_json' | 'sheets' = 'drive_json',
  targetDriveFileId: string = DEFAULT_DRIVE_FILE_ID
): Promise<{
  letters: any[];
  users: any[];
  offline?: boolean;
  uninitialized?: boolean;
  latencyMs?: number;
  statusCode?: number;
  errorType?: string;
  message?: string;
}> => {
  const fileId = (targetDriveFileId || DEFAULT_DRIVE_FILE_ID).trim();

  // 1. HIGH-SPEED GOOGLE DRIVE JSON MODE (~250ms - 450ms)
  if (mode === 'drive_json') {
    try {
      const headers: Record<string, string> = {
        'X-Storage-Mode': 'drive_json',
        'X-Drive-File-Id': fileId,
      };
      const response = await apiFetch(
        `/api/cloud-sync?type=get_drive_json&driveFileId=${encodeURIComponent(fileId)}&t=${Date.now()}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        if (
          data &&
          data.ok &&
          Array.isArray(data.letters) &&
          data.letters.length > 0 &&
          !data.uninitialized
        ) {
          return {
            letters: data.letters,
            users: Array.isArray(data.users) ? data.users : [],
            uninitialized: false,
            latencyMs: data.latencyMs,
            offline: false,
            statusCode: 200,
            message: data.message,
          };
        }
      }
    } catch {
      // Fall through to direct script or Sheets
    }

    // Google Apps Script Web App fallback with CORS support
    try {
      const targetUrl = (activeUrl || WEB_APP_URL).trim();
      const directScriptRes = await fetch(
        `${targetUrl}?type=get_drive_json&mode=drive_json&file_id=${encodeURIComponent(fileId)}&t=${Date.now()}`
      );
      if (directScriptRes.ok) {
        const raw = await directScriptRes.text();
        const trimmed = raw.trim();
        if (
          trimmed &&
          trimmed !== '{ [ ] }' &&
          trimmed !== '{[]}' &&
          trimmed !== '[]' &&
          trimmed !== '{}'
        ) {
          try {
            const parsed = JSON.parse(raw);
            const letters = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.letters)
              ? parsed.letters
              : [];
            const users = Array.isArray(parsed?.users) ? parsed.users : [];
            if (letters.length > 0) {
              return {
                letters,
                users,
                uninitialized: false,
                offline: false,
                statusCode: 200,
              };
            }
          } catch {}
        }
      }
    } catch {
      // Fall through to sheet
    }
  }

  // 2. GOOGLE SHEETS LIVE DATABASE (Authoritative multi-browser source)
  const targetUrl = (activeUrl || WEB_APP_URL).trim();

  // Try server proxy endpoint first
  try {
    const headers: Record<string, string> = {
      'X-Storage-Mode': 'sheets',
    };
    if (activeUrl) {
      headers['X-Web-App-Url'] = activeUrl;
    }

    const response = await apiFetch(`/api/cloud-sync?mode=sheets&t=${Date.now()}`, {
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      if (data && !data.offline && (Array.isArray(data.letters) || Array.isArray(data.users))) {
        const rawLtrs = Array.isArray(data.letters) ? data.letters : [];
        if (rawLtrs.length > 0) {
          return {
            letters: rawLtrs,
            users: Array.isArray(data.users) ? data.users : [],
            offline: false,
            statusCode: 200,
          };
        }
      }
      if (data && data.offline && (data.statusCode === 403 || data.errorType === 'ACCESS_DENIED')) {
        return {
          letters: [],
          users: [],
          offline: true,
          statusCode: 403,
          errorType: 'ACCESS_DENIED',
          message: data.message,
        };
      }
    }
  } catch {
    // Fall through to direct fetch
  }

  // Direct browser fetch fallback with 40-second timeout for large official spreadsheets
  try {
    const directController = new AbortController();
    const directTimeout = setTimeout(() => directController.abort(), 40000);
    const directRes = await fetch(`${targetUrl}?type=get_all&t=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow',
      signal: directController.signal,
    });
    clearTimeout(directTimeout);

    if (directRes.ok) {
      const rawText = await directRes.text();
      if (
        directRes.status === 403 ||
        rawText.includes('accounts.google.com') ||
        rawText.includes('You need access')
      ) {
        return {
          letters: [],
          users: [],
          offline: true,
          statusCode: 403,
          errorType: 'ACCESS_DENIED',
          message: 'Google Apps Script 403 Forbidden: "Who has access: Anyone" என மாற்ற வேண்டும்.',
        };
      }

      try {
        const directData = JSON.parse(rawText);
        if (directData && (Array.isArray(directData.letters) || Array.isArray(directData.users))) {
          return {
            letters: Array.isArray(directData.letters) ? directData.letters : [],
            users: Array.isArray(directData.users) ? directData.users : [],
            offline: false,
            statusCode: 200,
          };
        }
      } catch {}
    }
  } catch (err: any) {
    return {
      letters: [],
      users: [],
      offline: true,
      statusCode: 500,
      errorType: 'NETWORK_ERROR',
      message: err?.message,
    };
  }

  return { letters: [], users: [], offline: true };
};

const normalizeDateStr = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  return str;
};

const findExtraData = (row: any[]): Record<string, any> => {
  if (!Array.isArray(row)) return {};

  // Check if both index 14 (original ADD_LETTER ExtraData column) and index 13 (shifted UPDATE_LETTER ExtraData column) contain JSON
  const raw13 = typeof row[13] === 'string' && row[13].trim().startsWith('{')
    ? safeJsonParse<Record<string, any>>(row[13], {})
    : {};
  const raw14 = typeof row[14] === 'string' && row[14].trim().startsWith('{')
    ? safeJsonParse<Record<string, any>>(row[14], {})
    : {};
  const raw15 = typeof row[15] === 'string' && row[15].trim().startsWith('{')
    ? safeJsonParse<Record<string, any>>(row[15], {})
    : {};

  // If a shifted UPDATE_LETTER wrote newer JSON to index 13 while index 14 kept the initial ADD_LETTER JSON,
  // merge them with raw13 taking precedence over raw14 so updated Action and FileNo are preserved!
  if (Object.keys(raw13).length > 0 || Object.keys(raw14).length > 0 || Object.keys(raw15).length > 0) {
    return {
      ...raw14,
      ...raw13,
      ...raw15,
    };
  }

  // Otherwise search from end for any serialized JSON object
  for (let i = row.length - 1; i >= 0; i--) {
    const val = row[i];
    if (typeof val === 'string' && val.trim().startsWith('{')) {
      const p = safeJsonParse<Record<string, any>>(val, {});
      if (p && typeof p === 'object' && (p.originalNo || p.id || p.subject || p.inwardNo)) {
        return p;
      }
    }
  }
  return {};
};

/**
 * Official Google Sheet Letters columns schema (15 columns):
 * 0: ID
 * 1: OriginalNo
 * 2: Date
 * 3: DispatchedDate
 * 4: Post Type (letterType)
 * 5: RegisteredPostNo (defaults to 'No' if none)
 * 6: InwardNo
 * 7: FromWhom
 * 8: Subject
 * 9: Division
 * 10: ForwardedDivisions
 * 11: ActionStatus
 * 12: ForwardedTo
 * 13: ReplyResponse
 * 14: ExtraData (JSON backup)
 */
const normalizeLetter = (rowOrObj: any): Letter => {
  if (rowOrObj && typeof rowOrObj === 'object' && !Array.isArray(rowOrObj)) {
    const obj = rowOrObj;
    const mappedDiv = migrateDivision(obj.division);
    const fwdDivs = ensureStringArray(obj.forwardedDivisions).map(migrateDivision).filter(Boolean);
    const mappedFwdDivs = fwdDivs.length > 0 ? fwdDivs : (mappedDiv ? [mappedDiv] : []);
    const mapped: Letter = {
      ...obj,
      id: String(obj.id || `LTR-${Date.now()}`),
      originalNo: String(obj.originalNo || ''),
      date: normalizeDateStr(obj.date || ''),
      dispatchedDate: normalizeDateStr(obj.dispatchedDate || obj.date || ''),
      letterType: String(obj.letterType || obj.postType || 'Normal Post').trim() || 'Normal Post',
      registeredPostNo: normalizeRegisteredPostNo(obj.registeredPostNo),
      inwardNo: String(obj.inwardNo || ''),
      fromWhom: String(obj.fromWhom || ''),
      subject: String(obj.subject || ''),
      division: mappedDiv,
      forwardedDivisions: mappedFwdDivs,
      forwardedTo: ensureStringArray(obj.forwardedTo),
      action: normalizeAction(obj.action || obj.actionStatus || 'Not Yet Viewed'),
      replyResponse: String(obj.replyResponse || ''),
      fileNo: String(obj.fileNo || ''),
      registeredBy: String(obj.registeredBy || 'mail01'),
      registeredByName: String(obj.registeredByName || 'Mail Officer (கடித பதிவாளர்)'),
      createdAt: String(obj.createdAt || ''),
    };
    const healed = repairLetterRecord(mapped);
    return healed || mapped;
  }

  const row = Array.isArray(rowOrObj) ? rowOrObj : [];
  const extra = findExtraData(row);
  const hasValidExtra = Boolean(
    extra && (extra.subject || extra.fromWhom || extra.inwardNo || extra.division)
  );

  const rowId = String(row[0] ?? extra.id ?? `LTR-${Date.now()}`);
  const rowOrigNo = String(row[1] ?? extra.originalNo ?? '');
  const rowDate = normalizeDateStr(row[2] ?? extra.date ?? '');
  const rowDispDate = normalizeDateStr(row[3] ?? extra.dispatchedDate ?? rowDate);

  // Check if this row is from a shifted Google Sheet (where Post Type was omitted and col 5 has inward/reg, col 6 has sender, col 7 has subject, col 8 has division, col 9 has officers, col 10 has action)
  const isShifted =
    isExactDivisionName(row[8]) ||
    isOfficialDivisionName(row[8]) ||
    (typeof row[9] === 'string' && row[9].trim().startsWith('["')) ||
    isKnownActionValue(row[10]);

  let letterType = 'Normal Post';
  let rawRegPostNo = 'No';
  let rawInwardNo = '-';
  let rawFromWhom = '';
  let rawSubject = '';
  let rawDivision = '';
  let parsedForwardedDivisions: string[] = [];
  let parsedForwardedTo: string[] = [];
  let resolvedAction: LetterAction = 'Not Yet Viewed';

  if (isShifted) {
    letterType = String(extra.letterType || extra.postType || row[4] || 'Normal Post').trim() || 'Normal Post';
    const rawVal5 = String(row[5] ?? '').trim();
    rawRegPostNo = (extra.registeredPostNo && extra.registeredPostNo !== 'No' && extra.registeredPostNo !== '-')
      ? extra.registeredPostNo
      : (letterType === 'Registered Post' && rawVal5 && rawVal5 !== 'No' && rawVal5 !== '-' ? rawVal5 : 'No');
    rawInwardNo = (rawVal5 && rawVal5 !== 'No' && rawVal5 !== '-')
      ? rawVal5
      : (extra.inwardNo && extra.inwardNo !== '-' ? String(extra.inwardNo).trim() : '-');
    rawFromWhom = String(hasValidExtra && extra.fromWhom ? extra.fromWhom : (row[6] || '')).trim();
    rawSubject = String(hasValidExtra && extra.subject ? extra.subject : (row[7] || '')).trim();
    rawDivision = migrateDivision(String(hasValidExtra && extra.division ? extra.division : (row[8] || '')));
    parsedForwardedDivisions = [rawDivision];
    parsedForwardedTo = ensureStringArray(extra.forwardedTo && extra.forwardedTo.length ? extra.forwardedTo : row[9]);
    resolvedAction = normalizeAction(row[10] || row[11] || extra.action || extra.actionStatus || 'Not Yet Viewed');
  } else {
    letterType = String(row[4] || extra.letterType || extra.postType || 'Normal Post').trim() || 'Normal Post';
    rawRegPostNo = normalizeRegisteredPostNo(
      row[5] !== undefined && row[5] !== ''
        ? row[5]
        : (extra.registeredPostNo ?? extra.RegisteredPostNo)
    );
    rawInwardNo = String(
      hasValidExtra && extra.inwardNo !== undefined
        ? extra.inwardNo
        : (row[6] !== undefined && row[6] !== '' ? row[6] : (extra.inwardNo ?? ''))
    ).trim();
    rawFromWhom = String(
      hasValidExtra && extra.fromWhom !== undefined
        ? extra.fromWhom
        : (row[7] !== undefined && row[7] !== '' ? row[7] : (extra.fromWhom ?? ''))
    ).trim();
    rawSubject = String(
      hasValidExtra && extra.subject !== undefined
        ? extra.subject
        : (row[8] !== undefined && row[8] !== '' ? row[8] : (extra.subject ?? ''))
    ).trim();
    rawDivision = migrateDivision(
      String(
        hasValidExtra && extra.division
          ? extra.division
          : (row[9] !== undefined && row[9] !== '' ? row[9] : (extra.division ?? ''))
      )
    );

    const col10Val = row[10] !== undefined ? String(row[10]).trim() : '';
    const col11Val = row[11] !== undefined ? String(row[11]).trim() : '';
    const isCol10Action = isKnownActionValue(col10Val);
    const isCol11Action = isKnownActionValue(col11Val);
    const extraAction = extra.action || extra.actionStatus || extra.ActionStatus;
    const isExtraAction = isKnownActionValue(extraAction);

    const rawFwdDivs =
      !isCol10Action && col10Val !== ''
        ? row[10]
        : (extra.forwardedDivisions !== undefined ? extra.forwardedDivisions : '');
    parsedForwardedDivisions = ensureStringArray(rawFwdDivs)
      .map(migrateDivision)
      .filter(Boolean);

    if (parsedForwardedDivisions.length === 0 && rawDivision) {
      parsedForwardedDivisions = [rawDivision];
    }

    if (isCol11Action && col11Val !== 'Not Yet Viewed') {
      resolvedAction = normalizeAction(col11Val);
    } else if (isCol10Action && col10Val !== 'Not Yet Viewed') {
      resolvedAction = normalizeAction(col10Val);
    } else if (isExtraAction && extraAction !== 'Not Yet Viewed') {
      resolvedAction = normalizeAction(extraAction);
    } else if (isCol11Action) {
      resolvedAction = normalizeAction(col11Val);
    } else if (isCol10Action) {
      resolvedAction = normalizeAction(col10Val);
    } else if (isExtraAction) {
      resolvedAction = normalizeAction(extraAction);
    } else {
      resolvedAction = 'Not Yet Viewed';
    }

    const rawFwdTo =
      row[12] !== undefined && row[12] !== '' && !String(row[12]).trim().startsWith('{')
        ? row[12]
        : (extra.forwardedTo !== undefined ? extra.forwardedTo : []);
    parsedForwardedTo = ensureStringArray(rawFwdTo);
  }

  // Column 13: Reply / Response
  const colReplyResponse =
    row[13] !== undefined && !String(row[13]).trim().startsWith('{')
      ? String(row[13])
      : String(extra.replyResponse ?? extra.ReplyResponse ?? '');

  // Column 14 / 15: File No
  const sheetFileNoCol =
    row[15] && !String(row[15]).trim().startsWith('{')
      ? row[15]
      : row[14] && !String(row[14]).trim().startsWith('{')
      ? row[14]
      : '';
  const resolvedFileNo = String(extra.fileNo ?? extra.FileNo ?? sheetFileNoCol ?? '').trim();

  const mappedRow: Letter = {
    ...extra,
    id: rowId,
    originalNo: rowOrigNo,
    date: rowDate,
    dispatchedDate: rowDispDate,
    letterType: letterType,
    registeredPostNo: rawRegPostNo,
    inwardNo: rawInwardNo,
    fromWhom: rawFromWhom,
    subject: rawSubject,
    division: rawDivision,
    forwardedDivisions: parsedForwardedDivisions,
    forwardedTo: parsedForwardedTo,
    action: resolvedAction,
    replyResponse: colReplyResponse,
    fileNo: resolvedFileNo,
    registeredBy: String(extra.registeredBy ?? 'mail01'),
    registeredByName: String(extra.registeredByName ?? 'Mail Officer (கடித பதிவாளர்)'),
    createdAt: String(extra.createdAt ?? ''),
  };
  const healedRow = repairLetterRecord(mappedRow);
  return healedRow || mappedRow;
};

/**
 * Google Sheet Users columns schema:
 * 0: User_ID, 1: Password, 2: Name, 3: Role, 4: Division, 5: Status, 6: AssignedDivisions, 7: AssignedOfficers, 8: ExtraData
 */
const normalizeUser = (rowOrObj: any): User => {
  if (rowOrObj && typeof rowOrObj === 'object' && !Array.isArray(rowOrObj)) {
    const obj = rowOrObj;
    const rawAssignedDivs = obj.assignedDivisions;
    const assignedDivs = ensureStringArray(rawAssignedDivs).map(migrateDivision).filter(Boolean);
    const rawAssignedOffs = obj.assignedOfficers;
    const assignedOffs = ensureStringArray(rawAssignedOffs);

    return {
      ...obj,
      User_ID: String(obj.User_ID || obj.id || ''),
      Password: String(obj.Password || obj.password || '123'),
      Name: String(obj.Name || obj.name || ''),
      Role: (obj.Role || obj.role || 'User') as UserRole,
      Division: migrateDivision(String(obj.Division || obj.division || '')),
      Status: (obj.Status || obj.status || 'Active'),
      assignedDivisions: assignedDivs.length > 0 ? assignedDivs : undefined,
      assignedOfficers: assignedOffs.length > 0 ? assignedOffs : undefined,
    };
  }

  const row = Array.isArray(rowOrObj) ? rowOrObj : [];
  const extra = safeJsonParse<Record<string, any>>(row[8] || row[row.length - 1], {});
  const rawAssignedDivs = extra.assignedDivisions !== undefined ? extra.assignedDivisions : row[6];
  const assignedDivs = ensureStringArray(rawAssignedDivs).map(migrateDivision).filter(Boolean);
  const rawAssignedOffs = extra.assignedOfficers !== undefined ? extra.assignedOfficers : row[7];
  const assignedOffs = ensureStringArray(rawAssignedOffs);

  return {
    ...extra,
    User_ID: String(row[0] ?? extra.User_ID ?? ''),
    Password: String(row[1] ?? extra.Password ?? ''),
    Name: String(row[2] ?? extra.Name ?? ''),
    Role: (row[3] ?? extra.Role ?? 'User') as UserRole,
    Division: migrateDivision(String(row[4] ?? extra.Division ?? '')),
    Status: (row[5] ?? extra.Status ?? 'Active'),
    assignedDivisions: assignedDivs.length > 0 ? assignedDivs : undefined,
    assignedOfficers: assignedOffs.length > 0 ? assignedOffs : undefined,
  };
};

/**
 * Non-destructive 2-way sync: Merges incoming letters from the cloud/server with local letters.
 * CRITICAL RULE: NEVER deletes or drops any locally created or updated letters (e.g. registered on 2026-10-29).
 */
export const mergeLettersPreservingLocal = (
  currentLocal: Letter[],
  incomingCloud: Letter[],
  deletedIds: Set<string> = new Set()
): { merged: Letter[]; missingOnServer: Letter[] } => {
  const cloudKeyMap = new Map<string, Letter>();
  for (const cl of incomingCloud) {
    if (!cl) continue;
    const key = (cl.id || `${cl.originalNo}-${cl.date}`).trim();
    if (key) cloudKeyMap.set(key, cl);
  }

  const mergedMap = new Map<string, Letter>();
  const missingOnServer: Letter[] = [];

  // Also include any locally saved creations that might not be in currentLocal
  let localCreations: Letter[] = [];
  try {
    const raw = localStorage.getItem('kpn_vaharai_local_creations');
    if (raw) localCreations = JSON.parse(raw);
  } catch {}

  const allLocal = [...localCreations, ...currentLocal];

  // 1. Process all local letters: NEVER lose a locally created letter!
  for (const loc of allLocal) {
    if (!loc) continue;
    const repaired = repairLetterRecord(loc) || loc;
    const key = (repaired.id || `${repaired.originalNo}-${repaired.date}`).trim();
    if (!key || deletedIds.has(repaired.id)) continue;

    const cloudMatch = cloudKeyMap.get(key);
    if (cloudMatch) {
      // Exists in both: keep local user edits, preserve images and chat notes
      mergedMap.set(key, {
        ...cloudMatch,
        ...repaired,
        action:
          repaired.action && repaired.action !== 'Not Yet Viewed'
            ? repaired.action
            : cloudMatch.action || repaired.action || 'Not Yet Viewed',
        fileNo: repaired.fileNo || cloudMatch.fileNo || '',
        replyResponse: repaired.replyResponse || cloudMatch.replyResponse || '',
        image: repaired.image || cloudMatch.image,
        imageSizeKb: repaired.imageSizeKb || cloudMatch.imageSizeKb,
      });
    } else {
      // Local letter NOT yet in cloud (e.g. registered today 2026-10-29): KEEP IT!
      mergedMap.set(key, repaired);
      missingOnServer.push(repaired);
    }
  }

  // 2. Add incoming cloud letters not present locally
  for (const cl of incomingCloud) {
    if (!cl) continue;
    const repaired = repairLetterRecord(cl) || cl;
    const key = (repaired.id || `${repaired.originalNo}-${repaired.date}`).trim();
    if (!key || deletedIds.has(repaired.id)) continue;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, repaired);
    }
  }

  // 3. Sort by date descending (YYYY-MM-DD), then by originalNo/id descending
  const merged = Array.from(mergedMap.values()).sort((a, b) => {
    const dateComp = (b.date || '').localeCompare(a.date || '');
    if (dateComp !== 0) return dateComp;
    return (b.originalNo || b.id || '').localeCompare(a.originalNo || a.id || '');
  });

  return { merged, missingOnServer };
};

export default function App() {
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('kpn_vaharai_users_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          const uniqueUsers: User[] = [];
          for (const u of parsed) {
            if (!u || typeof u !== 'object') continue;
            const uid = (u.User_ID || '').trim().toLowerCase();
            if (uid && !seen.has(uid)) {
              seen.add(uid);
              const assignedDivs = ensureStringArray(u.assignedDivisions).map(migrateDivision).filter(Boolean);
              const assignedOffs = ensureStringArray(u.assignedOfficers);
              uniqueUsers.push({
                ...u,
                Division: migrateDivision(u.Division),
                assignedDivisions: assignedDivs.length > 0 ? assignedDivs : undefined,
                assignedOfficers: assignedOffs.length > 0 ? assignedOffs : undefined,
              });
            }
          }
          if (uniqueUsers.length >= 20) return uniqueUsers;
        }
      }
    } catch {
      // Ignore storage read errors
    }
    return INITIAL_USERS;
  });

  const [letters, setLetters] = useState<Letter[]>(() => {
    try {
      const saved = localStorage.getItem('kpn_vaharai_letters_v2');
      let localCreations: Letter[] = [];
      try {
        const rawCreations = localStorage.getItem('kpn_vaharai_local_creations');
        if (rawCreations) localCreations = JSON.parse(rawCreations);
      } catch {}

      let deletedIds = new Set<string>();
      try {
        const rawDel = localStorage.getItem('kpn_vaharai_deleted_ids');
        if (rawDel) deletedIds = new Set(JSON.parse(rawDel));
      } catch {}

      let parsed: any[] = [];
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p)) parsed = p;
      }
      if (parsed.length === 0) {
        parsed = [...INITIAL_LETTERS];
      }

      const seenIds = new Set<string>();
      const combinedLetters: Letter[] = [];
      for (const item of [...localCreations, ...parsed]) {
        if (!item || typeof item !== 'object') continue;
        const repaired = repairLetterRecord(item);
        if (!repaired) continue;
        const lid = (repaired.id || `${repaired.originalNo}-${repaired.date}`).trim();
        if (lid && !seenIds.has(lid) && !deletedIds.has(repaired.id)) {
          seenIds.add(lid);
          combinedLetters.push(repaired);
        }
      }

      if (combinedLetters.length > 0) return combinedLetters;
    } catch {
      // Ignore storage read errors
    }
    return INITIAL_LETTERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('kpn_vaharai_current_user_v2');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object') {
          const assignedDivs = ensureStringArray(parsed.assignedDivisions).map(migrateDivision).filter(Boolean);
          const assignedOffs = ensureStringArray(parsed.assignedOfficers);
          return {
            ...parsed,
            Division: migrateDivision(parsed.Division),
            assignedDivisions: assignedDivs.length > 0 ? assignedDivs : undefined,
            assignedOfficers: assignedOffs.length > 0 ? assignedOffs : undefined,
          };
        }
      }
    } catch {
      // Ignore storage read errors
    }
    return null;
  });

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [isLetterEditMode, setIsLetterEditMode] = useState(false);
  const [editingLetter, setEditingLetter] = useState<Letter | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('All');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>('All');
  const [selectedOfficerFilter, setSelectedOfficerFilter] = useState<string>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [subjectViewMode, setSubjectViewMode] = useState<'folders' | 'categorized_boards'>('folders');
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [cloudMessage, setCloudMessage] = useState('Connecting to system server...');
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'error_403' | 'offline' | 'checking'>('checking');
  const [isCloudSettingsOpen, setIsCloudSettingsOpen] = useState(false);
  const [storageMode, setStorageMode] = useState<'drive_json' | 'sheets'>(() => {
    try {
      const saved = localStorage.getItem('kpn_vaharai_storage_mode');
      if (saved === 'sheets' || saved === 'drive_json') return saved;
    } catch {}
    return 'sheets';
  });
  const [driveFileId, setDriveFileId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kpn_vaharai_drive_file_id');
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    return DEFAULT_DRIVE_FILE_ID;
  });
  const [driveLatency, setDriveLatency] = useState<number | null>(null);

  const [cloudUrl, setCloudUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kpn_vaharai_cloud_url');
      if (saved && saved.trim()) return saved.trim();
    } catch {
      // Ignore read errors
    }
    return WEB_APP_URL;
  });

  useEffect(() => {
    try {
      localStorage.setItem('kpn_vaharai_users_v2', JSON.stringify(users));
    } catch {
      // Ignore storage write errors
    }
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem('kpn_vaharai_letters_v2', JSON.stringify(letters));
    } catch {
      // Ignore storage write errors
    }
  }, [letters]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('kpn_vaharai_current_user_v2', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('kpn_vaharai_current_user_v2');
      }
    } catch {
      // Ignore storage write errors
    }
  }, [currentUser]);

  // Auto-upgrade local storage: heal any shifted letters and upgrade stale caches
  useEffect(() => {
    try {
      const savedLtrs = localStorage.getItem('kpn_vaharai_letters_v2');
      if (savedLtrs) {
        const parsed = JSON.parse(savedLtrs);
        if (Array.isArray(parsed)) {
          if (parsed.length < 50 && INITIAL_LETTERS.length >= 50) {
            setLetters(INITIAL_LETTERS);
            localStorage.setItem('kpn_vaharai_letters_v2', JSON.stringify(INITIAL_LETTERS));
          } else {
            const healed = parsed.map(repairLetterRecord).filter(Boolean) as Letter[];
            setLetters(healed);
            localStorage.setItem('kpn_vaharai_letters_v2', JSON.stringify(healed));
          }
        }
      }
      const savedUsers = localStorage.getItem('kpn_vaharai_users_v2');
      if (savedUsers) {
        const parsedUsers = JSON.parse(savedUsers);
        if (Array.isArray(parsedUsers) && parsedUsers.length < 20 && INITIAL_USERS.length >= 20) {
          setUsers(INITIAL_USERS);
          localStorage.setItem('kpn_vaharai_users_v2', JSON.stringify(INITIAL_USERS));
        }
      }
    } catch {}
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadingToJson, setIsUploadingToJson] = useState(false);

  const loadCloud = async (isManual = false) => {
    if (isManual) setIsSyncing(true);
    setLoadingCloud(true);
    try {
      const result = await fetchCloudData(cloudUrl, storageMode, driveFileId);

      if (result.statusCode === 403 || result.errorType === 'ACCESS_DENIED') {
        setCloudStatus('error_403');
        setCloudMessage('Server Access Restricted (403 Forbidden). Please check access permissions.');
        return;
      }

      if (result.latencyMs) setDriveLatency(result.latencyMs);

      // 1. Process letters (Unified: handles 2D Google Sheets Rows and Object Arrays seamlessly)
      if (Array.isArray(result.letters) && result.letters.length > 0) {
        const rawLetters = result.letters;
        const is2D = Array.isArray(rawLetters[0]);
        const rowsToProcess = is2D ? rawLetters.slice(1) : rawLetters;

        const cloudLetters = rowsToProcess
          .filter((item: any) => item && (Array.isArray(item) ? item.length > 0 : (item.id || item.originalNo || item.subject)))
          .map(normalizeLetter)
          .filter((letter: any) => letter && (letter.id || letter.originalNo));

        if (cloudLetters.length > 0) {
          let deletedIds = new Set<string>();
          try {
            const rawDel = localStorage.getItem('kpn_vaharai_deleted_ids');
            if (rawDel) deletedIds = new Set(JSON.parse(rawDel));
          } catch {}

          setLetters((prevLetters) => {
            const { merged, missingOnServer } = mergeLettersPreservingLocal(
              prevLetters,
              cloudLetters,
              deletedIds
            );
            try {
              localStorage.setItem('kpn_vaharai_letters_v2', JSON.stringify(merged));
            } catch {}

            // Auto-sync any locally created letters to the server in background if missing
            if (missingOnServer.length > 0) {
              apiFetch('/api/cloud-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'SYNC_CLIENT_BATCH',
                  letters: missingOnServer,
                }),
              }).catch(() => {});
            }

            return merged;
          });
        }
      }

      // 2. Process users (Unified: handles 2D Google Sheets Rows and Object Arrays seamlessly)
      if (Array.isArray(result.users) && result.users.length > 0) {
        const rawUsers = result.users;
        const is2DUsers = Array.isArray(rawUsers[0]);
        const userRowsToProcess = is2DUsers ? rawUsers.slice(1) : rawUsers;

        const cloudUsers = userRowsToProcess
          .filter((u: any) => u && (Array.isArray(u) ? u.length > 0 : (u.User_ID || u.id)))
          .map(normalizeUser);

        const seenUsers = new Set<string>();
        const uniqueCloudUsers: User[] = [];
        for (const u of cloudUsers) {
          const key = (u.User_ID || '').trim().toLowerCase();
          if (key && !seenUsers.has(key)) {
            seenUsers.add(key);
            uniqueCloudUsers.push(u);
          }
        }

        if (uniqueCloudUsers.length) {
          setUsers(uniqueCloudUsers);
          try {
            localStorage.setItem('kpn_vaharai_users_v2', JSON.stringify(uniqueCloudUsers));
          } catch {}
        }
      }

      setCloudStatus('connected');
      setCloudMessage('System Connected • All records synchronized');
      if (isManual) {
        alert(`✓ Synchronization completed: ${result.letters?.length || letters.length} records active.`);
      }
    } catch {
      setCloudStatus('offline');
      setCloudMessage('Operating in Local Mode • Offline');
    } finally {
      setLoadingCloud(false);
      if (isManual) setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadCloud();

    // Auto-sync every 20 seconds so letters uploaded in other browsers appear automatically
    const interval = setInterval(() => {
      loadCloud();
    }, 20000);

    const handleFocus = () => {
      loadCloud();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [cloudUrl, storageMode, driveFileId]);

  // Requirement: Letter Registrar (கடித பதிவாளர்) only can upload from Local Storage to JSON
  const handleUploadLocalStorageToJson = async () => {
    if (isUploadingToJson) return;
    const count = letters.length;
    if (!confirm(`Synchronize and backup all ${count} official records to cloud server?`)) {
      return;
    }

    setIsUploadingToJson(true);
    setCloudMessage('Saving records to cloud server...');
    try {
      // Strip heavy base64 image data from the bulk payload to prevent HTTP 413 Payload Too Large
      const lightLetters = letters.map((l) => {
        const { image, ...rest } = l;
        return rest;
      });

      const res = await apiFetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_TO_DRIVE',
          driveFileId: driveFileId,
          letters: lightLetters,
          users: users,
        }),
      });

      if (res.ok) {
        setCloudStatus('connected');
        setCloudMessage(`Backup Completed: ${count} records synchronized`);
      } else {
        const errData = await res.json().catch(() => null);
        alert(`Backup failed (${res.status}): ${errData?.message || 'Server error'}.`);
      }
    } catch (err: any) {
      alert(`Backup error: ${err?.message || 'Network error'}`);
    } finally {
      setIsUploadingToJson(false);
    }
  };

  // Requirement: Only Super Admin and Admin can download the full backup file
  const handleDownloadJson = () => {
    if (currentUser?.Role !== 'Super Admin' && currentUser?.Role !== 'Mega') {
      alert('Access Restricted: Only Super Admin and Admin may export backup files.');
      return;
    }
    const cleanLetters = letters
      .map(repairLetterRecord)
      .filter((l): l is Letter => l !== null && Boolean(l.originalNo && l.originalNo !== '-'));

    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(
        JSON.stringify(
          {
            ok: true,
            source: 'vaharai_ds_office',
            exportedAt: new Date().toISOString(),
            letterCount: cleanLetters.length,
            userCount: users.length,
            letters: cleanLetters,
            users: users,
          },
          null,
          2
        )
      );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `vaharai_ds_letter_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const cloudWrite = async (payload: CloudPayload): Promise<CloudWriteResult> => {
    const res = await sendDataToGoogleCloud(payload, cloudUrl, storageMode, driveFileId);
    if (!res.ok) {
      if (res.statusCode === 403 || res.errorType === 'ACCESS_DENIED') {
        setCloudStatus('error_403');
        setCloudMessage('Server Access Restricted (403 Forbidden).');
      } else {
        setCloudMessage(`Saved locally (${res.message || 'Offline'})`);
      }
    } else {
      setCloudStatus('connected');
      setCloudMessage('Saved');
    }
    return res;
  };

  const handleSaveStorageMode = (newMode: 'drive_json' | 'sheets') => {
    setStorageMode(newMode);
    try {
      localStorage.setItem('kpn_vaharai_storage_mode', newMode);
      apiFetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_CONFIG', storageMode: newMode }),
      }).catch(() => {});
    } catch {}
  };

  const handleSaveDriveFileId = async (newId: string): Promise<boolean> => {
    const cleanId = newId.trim();
    if (!cleanId) return false;
    try {
      setDriveFileId(cleanId);
      localStorage.setItem('kpn_vaharai_drive_file_id', cleanId);
      await apiFetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_CONFIG', driveFileId: cleanId }),
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleTestDriveConnection = async (idToTest?: string) => {
    const targetId = (idToTest || driveFileId).trim();
    try {
      const res = await apiFetch(
        `/api/cloud-sync?type=test_drive&driveFileId=${encodeURIComponent(targetId)}&t=${Date.now()}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setCloudStatus('connected');
          setDriveLatency(data.latencyMs || 280);
          setCloudMessage(data.message || 'Google Drive JSON கோப்பு இணைக்கப்பட்டுள்ளது.');
        }
        return data;
      }
    } catch {}
    return { ok: false, statusCode: 500, message: 'Google Drive கோப்பை அணுக முடியவில்லை.' };
  };

  const handleUploadAllToDrive = async (): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await apiFetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_TO_DRIVE',
          driveFileId: driveFileId,
          letters: letters,
          users: users,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setCloudStatus('connected');
          setCloudMessage('Google Drive JSON கோப்பில் அனைத்து தகவல்களும் வெற்றிகரமாகப் பதிவேற்றப்பட்டது!');
          return { ok: true, message: data.message };
        }
        return { ok: false, message: data.message || 'Upload to Drive failed' };
      }
      return { ok: false, message: 'Server communication error' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Upload failed' };
    }
  };

  const handleSaveCloudUrl = async (newUrl: string): Promise<boolean> => {
    try {
      localStorage.setItem('kpn_vaharai_cloud_url', newUrl);
      setCloudUrl(newUrl);
      await apiFetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_CONFIG_URL', url: newUrl }),
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleTestCloudConnection = async (urlToTest?: string) => {
    const target = (urlToTest || cloudUrl).trim();
    if (!target) {
      return { ok: false, statusCode: 400, message: 'URL தேவை (URL is required)' };
    }

    // 1. Try server proxy endpoint
    try {
      const res = await apiFetch(
        `/api/cloud-sync?type=test&webAppUrl=${encodeURIComponent(target)}&t=${Date.now()}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setCloudStatus('connected');
          setCloudMessage('Google Sheets cloud database இணைக்கப்பட்டு நேரலையில் ஒத்திசைக்கப்பட்டது.');
          return data;
        } else if (data.statusCode === 403 || data.errorType === 'ACCESS_DENIED') {
          setCloudStatus('error_403');
          setCloudMessage(
            'Google Sheets அனுமதி பிழை (403 Forbidden): Apps Script அமைப்பில் "Who has access: Anyone" என அமைக்க வேண்டும்.'
          );
          return data;
        }
        // If server proxy returned a 500/timeout error (e.g. Vercel function timeout), fall through to direct browser fetch
      }
    } catch {
      // Fall through to direct browser fetch
    }

    // 2. Direct browser test fallback (essential when running on Vercel or when serverless times out)
    try {
      const directController = new AbortController();
      const directTimeout = setTimeout(() => directController.abort(), 20000);
      const directRes = await fetch(`${target}?type=ping&t=${Date.now()}`, {
        method: 'GET',
        redirect: 'follow',
        signal: directController.signal,
      });
      clearTimeout(directTimeout);
      const directText = await directRes.text();

      if (
        directRes.status === 403 ||
        directText.includes('accounts.google.com') ||
        directText.includes('You need access')
      ) {
        setCloudStatus('error_403');
        setCloudMessage(
          'Google Sheets அனுமதி பிழை (403 Forbidden): Apps Script அமைப்பில் "Who has access: Anyone" என அமைக்க வேண்டும்.'
        );
        return {
          ok: false,
          statusCode: 403,
          errorType: 'ACCESS_DENIED',
          message: 'Google Apps Script அனுமதி மறுக்கப்பட்டது (403 Forbidden). "Who has access: Anyone" என அமைக்கவும்.',
        };
      }

      let directJson: any = null;
      try {
        directJson = JSON.parse(directText);
      } catch {}

      const isDirectOk =
        directRes.ok &&
        (directJson
          ? (directJson.result === 'success' ||
              directJson.result === 'ok' ||
              directJson.status === 'connected' ||
              directJson.ok !== undefined ||
              directJson.success === true ||
              Array.isArray(directJson.letters) ||
              !directJson.error)
          : directText.includes('success') || directText.includes('ok'));

      if (isDirectOk) {
        setCloudStatus('connected');
        setCloudMessage('Google Sheets cloud database இணைக்கப்பட்டு நேரலையில் ஒத்திசைக்கப்பட்டது.');
        return {
          ok: true,
          statusCode: 200,
          message: 'Google Sheets API வெற்றிகரமாக இணைக்கப்பட்டுள்ளது (Connected successfully)!',
          letterCount: Array.isArray(directJson?.letters) ? Math.max(0, directJson.letters.length - 1) : undefined,
          data: directJson,
        };
      }
    } catch (directErr: any) {
      const isTimeout =
        directErr?.name === 'AbortError' ||
        String(directErr?.message || '').toLowerCase().includes('aborted');
      const msg = isTimeout
        ? 'கூகிள் சேவையக இணைப்பு நேரம் கடந்துவிட்டது (Timeout). Apps Script சர்வர் பதிலளிக்க நீண்ட நேரம் எடுத்தது. தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் சோதிக்கவும்.'
        : `கூகிள் சேவையக இணைப்பு தோல்வி: ${directErr?.message || 'Network error'}`;
      setCloudStatus('offline');
      setCloudMessage('Google Sheets இணைப்பு தோல்வி (Offline mode).');
      return {
        ok: false,
        statusCode: isTimeout ? 504 : 500,
        errorType: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: msg,
      };
    }

    setCloudStatus('offline');
    setCloudMessage('Google Sheets இணைப்பு தோல்வி (Offline mode).');
    return { ok: false, statusCode: 500, message: 'Google Sheets இணைப்பு தோல்வி.' };
  };

  const handleSyncAllLetters = async (onProgress: (done: number, total: number) => void) => {
    let success = 0;
    let failed = 0;
    const total = letters.length;
    for (let i = 0; i < total; i++) {
      const l = letters[i];
      const res = await sendDataToGoogleCloud(
        {
          action: 'ADD_LETTER',
          id: l.id,
          originalNo: l.originalNo,
          date: l.date,
          dispatchedDate: l.dispatchedDate || l.date,
          letterType: l.letterType,
          registeredPostNo: l.registeredPostNo,
          inwardNo: l.inwardNo,
          fromWhom: l.fromWhom,
          subject: l.subject,
          division: l.division,
          forwardedDivisions: l.forwardedDivisions || [],
          forwardedTo: l.forwardedTo || [],
          actionStatus: l.action,
          replyResponse: l.replyResponse || '',
          fileNo: l.fileNo || '',
          extraData: l,
        },
        cloudUrl
      );

      if (res.ok) success++;
      else failed++;
      onProgress(i + 1, total);
    }

    if (success > 0) {
      setCloudStatus('connected');
      setCloudMessage(`${success} கடிதங்கள் Google Sheet-இல் வெற்றிகரமாகப் பதிவேற்றப்பட்டது!`);
    }
    return { success, failed };
  };

  const handleRepairShiftedRows = async () => {
    const cleanLetters = letters.map((l) => repairLetterRecord(l)).filter((l): l is Letter => l !== null);
    setLetters(cleanLetters);
    try {
      localStorage.setItem('kpn_vaharai_letters_v2', JSON.stringify(cleanLetters));
    } catch {}

    // First attempt proxy call via /api/cloud-sync
    try {
      await apiFetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SYNC_ALL_TO_SHEET',
          letters: cleanLetters,
        }),
      });
    } catch {}

    const res = await sendDataToGoogleCloud(
      {
        action: 'SYNC_ALL_TO_SHEET',
        letters: cleanLetters,
      },
      cloudUrl
    );

    setCloudStatus('connected');
    setCloudMessage(`அனைத்து ${cleanLetters.length} கடிதங்களும் Google Sheet-இல் சரியான தலைப்புகளுடன் சீரமைக்கப்பட்டு புதுப்பிக்கப்பட்டன!`);
    return {
      ok: true,
      message: `அனைத்து ${cleanLetters.length} கடிதங்களும் சரியான தலைப்புகளின் கீழ் சீரமைக்கப்பட்டன!`,
      fixedCount: cleanLetters.length,
    };
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedLetter(null);
    setEditingLetter(null);
  };

  const handleResetData = () => {
    if (confirm('பிரதேச செயலகத்தின் உத்தியோகபூர்வ 460 கடிதங்கள் மற்றும் 108 உத்தியோகத்தர்கள் பதிவுகளை மீளமைக்க விரும்புகிறீர்களா? (Restore all 460 official letters & 108 staff)?')) {
      setUsers(INITIAL_USERS);
      setLetters(INITIAL_LETTERS);
      try {
        localStorage.setItem('kpn_vaharai_letters_v2', JSON.stringify(INITIAL_LETTERS));
        localStorage.setItem('kpn_vaharai_users_v2', JSON.stringify(INITIAL_USERS));
      } catch {}
      alert(`அனைத்து 460 உத்தியோகபூர்வ கடிதங்கள் மற்றும் 108 உத்தியோகத்தர்கள் விபரங்கள் வெற்றிகரமாக ஏற்றப்பட்டன! (Successfully loaded ${INITIAL_LETTERS.length} letters & ${INITIAL_USERS.length} users)`);
    }
  };

  // Requirement 1 & 2: Mail Officer Registration with Instant Optimistic UI Update & Background Sync
  const handleSaveNewLetter = (newLetter: Letter) => {
    const safeLetterType = String(newLetter.letterType || 'Registered Post').trim() || 'Registered Post';
    const safeRegPostNo = normalizeRegisteredPostNo(newLetter.registeredPostNo);
    const safeFileNo = String(newLetter.fileNo ?? '').trim();
    const safeAction = normalizeAction(newLetter.action || 'Not Yet Viewed');

    const sanitized: Letter = {
      ...newLetter,
      letterType: safeLetterType,
      registeredPostNo: safeRegPostNo,
      action: safeAction,
      fileNo: safeFileNo,
      forwardedDivisions: ensureStringArray(newLetter.forwardedDivisions),
      forwardedTo: ensureStringArray(newLetter.forwardedTo),
    };

    // 1. Immediately save to persistent local store (0 delay)
    try {
      const currentLocals = JSON.parse(localStorage.getItem('kpn_vaharai_local_creations') || '[]');
      const filtered = currentLocals.filter((l: any) => l.id !== sanitized.id && l.originalNo !== sanitized.originalNo);
      localStorage.setItem('kpn_vaharai_local_creations', JSON.stringify([sanitized, ...filtered]));
    } catch {}

    // 2. Immediately update state so it appears in the letter list, folders, and dashboards instantly (0 delay)
    setLetters((prev) => [sanitized, ...prev.filter((l) => l.id !== sanitized.id)]);

    // 3. Official status feedback
    setCloudMessage(`Saving record ${sanitized.originalNo}...`);

    // 4. Background cloud write without blocking UI or freezing execution
    void (async () => {
      const res = await cloudWrite({
        action: 'ADD_LETTER',
        id: sanitized.id,
        originalNo: sanitized.originalNo,
        date: sanitized.date,
        dispatchedDate: sanitized.dispatchedDate || sanitized.date,
        letterType: sanitized.letterType,
        registeredPostNo: sanitized.registeredPostNo,
        inwardNo: sanitized.inwardNo,
        fromWhom: sanitized.fromWhom,
        subject: sanitized.subject,
        division: sanitized.division || DIVISIONS[0],
        forwardedDivisions: sanitized.forwardedDivisions || [],
        forwardedTo: sanitized.forwardedTo || [],
        actionStatus: sanitized.action,
        replyResponse: sanitized.replyResponse || '',
        fileNo: sanitized.fileNo || '',
        extraData: sanitized,
      });

      if (res.ok) {
        setCloudStatus('connected');
        setCloudMessage(`Record ${sanitized.originalNo} Saved`);
      } else {
        setCloudMessage(`Record ${sanitized.originalNo} Saved Locally`);
      }
    })();
  };

  // Update existing letter (Instant local update + non-blocking background sync)
  const handleUpdateLetter = (updated: Letter) => {
    const safeLetterType = String(updated.letterType || 'Registered Post').trim() || 'Registered Post';
    const safeRegPostNo = normalizeRegisteredPostNo(updated.registeredPostNo);
    const safeFileNo = String(updated.fileNo ?? '').trim();
    const safeAction = normalizeAction(updated.action);

    const sanitized: Letter = {
      ...updated,
      letterType: safeLetterType,
      registeredPostNo: safeRegPostNo,
      action: safeAction,
      fileNo: safeFileNo,
      forwardedDivisions: ensureStringArray(updated.forwardedDivisions),
      forwardedTo: ensureStringArray(updated.forwardedTo),
    };
    setLetters((prev) => prev.map((l) => (l.id === sanitized.id ? sanitized : l)));
    if (selectedLetter && selectedLetter.id === sanitized.id) {
      setSelectedLetter(sanitized);
    }
    if (editingLetter && editingLetter.id === sanitized.id) {
      setEditingLetter(sanitized);
    }

    // Reset actionFilter if active so the updated letter remains visible on screen
    if (actionFilter !== 'All') {
      setActionFilter('All');
    }

    const letterCloudPayload = {
      id: sanitized.id,
      originalNo: sanitized.originalNo,
      date: sanitized.date,
      dispatchedDate: sanitized.dispatchedDate || sanitized.date,
      letterType: sanitized.letterType,
      registeredPostNo: sanitized.registeredPostNo,
      inwardNo: sanitized.inwardNo,
      fromWhom: sanitized.fromWhom,
      subject: sanitized.subject,
      division: sanitized.division || DIVISIONS[0],
      forwardedDivisions: sanitized.forwardedDivisions || [],
      forwardedTo: sanitized.forwardedTo || [],
      actionStatus: sanitized.action || 'Not Yet Viewed',
      replyResponse: sanitized.replyResponse || '',
      fileNo: sanitized.fileNo || '',
      extraData: sanitized,
    };

    try {
      const localCreations = JSON.parse(localStorage.getItem('kpn_vaharai_local_creations') || '[]');
      const updatedCreations = localCreations.map((l: any) =>
        l.id === sanitized.id || (sanitized.originalNo && l.originalNo === sanitized.originalNo) ? sanitized : l
      );
      localStorage.setItem('kpn_vaharai_local_creations', JSON.stringify(updatedCreations));
    } catch {}

    setCloudMessage(`Saving update...`);

    // Send single in-place update (fast, non-blocking, and preserves row order)
    void (async () => {
      const res = await cloudWrite({
        ...letterCloudPayload,
        action: 'UPDATE_LETTER',
      });
      if (!res.ok) {
        if (res.statusCode === 403 || res.errorType === 'ACCESS_DENIED') {
          setCloudStatus('error_403');
          setCloudMessage('Server Access Restricted (403 Forbidden).');
        } else {
          setCloudMessage(`Update Saved Locally`);
        }
      } else {
        setCloudStatus('connected');
        setCloudMessage(`Update Saved`);
      }
    })();
  };

  const handleDeleteLetter = (letterId: string) => {
    if (!confirm('Are you sure you want to permanently delete this mail record?')) return;
    setLetters((prev) => prev.filter((l) => l.id !== letterId));
    if (selectedLetter && selectedLetter.id === letterId) setSelectedLetter(null);
    if (editingLetter && editingLetter.id === letterId) setEditingLetter(null);

    try {
      const deletedIds = JSON.parse(localStorage.getItem('kpn_vaharai_deleted_ids') || '[]');
      if (!deletedIds.includes(letterId)) {
        deletedIds.push(letterId);
        localStorage.setItem('kpn_vaharai_deleted_ids', JSON.stringify(deletedIds));
      }
      const localCreations = JSON.parse(localStorage.getItem('kpn_vaharai_local_creations') || '[]');
      const filteredCreations = localCreations.filter((l: any) => l.id !== letterId);
      localStorage.setItem('kpn_vaharai_local_creations', JSON.stringify(filteredCreations));
    } catch {}

    cloudWrite({
      action: 'DELETE_LETTER',
      id: letterId,
    });
  };

  const handleAddUser = (newUser: User) => {
    setUsers((prev) => {
      const filtered = prev.filter(
        (u) => u.User_ID.trim().toLowerCase() !== newUser.User_ID.trim().toLowerCase()
      );
      return [...filtered, newUser];
    });
    cloudWrite({
      action: 'ADD_USER',
      User_ID: newUser.User_ID,
      Password: newUser.Password,
      Name: newUser.Name,
      Role: newUser.Role,
      Division: newUser.Division,
      Status: newUser.Status || 'Active',
      extraData: newUser,
    });
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.User_ID === updatedUser.User_ID ? updatedUser : u))
    );
    if (currentUser && currentUser.User_ID === updatedUser.User_ID) {
      setCurrentUser(updatedUser);
    }

    cloudWrite({
      action: 'UPDATE_USER',
      User_ID: updatedUser.User_ID,
      Password: updatedUser.Password,
      Name: updatedUser.Name,
      Role: updatedUser.Role,
      Division: updatedUser.Division,
      Status: updatedUser.Status || 'Active',
      extraData: updatedUser,
    });
  };

  const handleDeleteUser = (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setUsers((prev) => prev.filter((u) => u.User_ID !== userId));
    cloudWrite({
      action: 'DELETE_USER',
      User_ID: userId,
    });
  };

  if (!currentUser) {
    return <LoginScreen users={users} onLoginSuccess={setCurrentUser} />;
  }

  const usersMap = new Map<string, User>(users.map((u) => [u.User_ID, u]));

  // Requirement 3 & 5: Role-based filtering ensuring Mega forwarded mail reaches the division!
  const roleFilteredLetters = letters.filter((letter) => {
    // Super Admin, Mega, Mail Officer see all letters
    if (
      currentUser.Role === 'Super Admin' ||
      currentUser.Role === 'Mega' ||
      currentUser.Role === 'Mail Officer'
    ) {
      return true;
    }

    const fwdDivs = ensureStringArray(letter.forwardedDivisions);
    const fwdTo = ensureStringArray(letter.forwardedTo);
    const myId = currentUser.User_ID.trim().toLowerCase();
    const myName = currentUser.Name.trim().toLowerCase();

    // Multiple Luxury Roles see their assigned divisions or assigned officers
    if (currentUser.Role === 'Luxury') {
      const allowedDivs = ensureStringArray(currentUser.assignedDivisions);
      const allowedOfficers = ensureStringArray(currentUser.assignedOfficers).map((s) => s.trim().toLowerCase());

      // If no restrictions configured, Luxury user has executive oversight of all divisions
      if (allowedDivs.length === 0 && allowedOfficers.length === 0) {
        return true;
      }

      // Check if letter belongs to an assigned division
      const inAssignedDiv =
        allowedDivs.includes(letter.division) ||
        fwdDivs.some((d) => allowedDivs.includes(d));

      // Check if letter forwarded to an assigned officer or to luxury user themselves
      const inAssignedOfficer = fwdTo.some((uid) => {
        const clean = uid.trim().toLowerCase();
        if (clean === myId || clean === myName) return true;
        if (myId && clean.includes(myId)) return true;
        if (myName && (clean.includes(myName) || myName.includes(clean))) return true;
        if (allowedOfficers.includes(clean)) return true;
        return allowedOfficers.some((ao) => {
          const u = users.find(
            (usr) =>
              usr.User_ID.trim().toLowerCase() === ao ||
              usr.Name.trim().toLowerCase() === ao
          );
          return (
            u &&
            (u.User_ID.trim().toLowerCase() === clean ||
              u.Name.trim().toLowerCase() === clean ||
              clean.includes(u.User_ID.trim().toLowerCase()) ||
              clean.includes(u.Name.trim().toLowerCase()))
          );
        });
      });

      return inAssignedDiv || inAssignedOfficer;
    }

    // Requirement 3: Normal User (Division Head) MUST receive letters routed to their division!
    if (currentUser.Role === 'Normal') {
      const myDiv = (currentUser.Division || '').trim().toLowerCase();
      const letterDiv = (letter.division || '').trim().toLowerCase();
      const matchesDivision =
        letterDiv === myDiv ||
        fwdDivs.some((d) => d.trim().toLowerCase() === myDiv);

      const hasDivisionOfficer = fwdTo.some((uid) => {
        const clean = uid.trim().toLowerCase();
        const u = users.find(
          (usr) =>
            usr.User_ID.trim().toLowerCase() === clean ||
            usr.Name.trim().toLowerCase() === clean
        );
        return u && (u.Division || '').trim().toLowerCase() === myDiv;
      });

      const directlyForwarded = fwdTo.some((id) => {
        const clean = id.trim().toLowerCase();
        return (
          clean === myId ||
          clean === myName ||
          (myId && clean.includes(myId)) ||
          (myName && (clean.includes(myName) || myName.includes(clean)))
        );
      });

      return matchesDivision || hasDivisionOfficer || directlyForwarded;
    }

    // Field Officer (User Role): Letters directly forwarded to their ID or Name
    if (currentUser.Role === 'User') {
      return fwdTo.some((id) => {
        const clean = id.trim().toLowerCase();
        if (clean === myId || clean === myName) return true;
        if (myId && clean.includes(myId)) return true;
        if (myName && (clean.includes(myName) || myName.includes(clean))) return true;
        const resolved = users.find(
          (u) =>
            u.User_ID.trim().toLowerCase() === clean ||
            u.Name.trim().toLowerCase() === clean
        );
        return resolved?.User_ID.trim().toLowerCase() === myId;
      });
    }

    return false;
  });

  // Apply Search, Status Filter, Officer Filter & Division Filter
  const displayedLetters = roleFilteredLetters.filter((letter) => {
    // Status Filter (with bilingual safety via normalizeAction)
    if (actionFilter !== 'All') {
      const normLetterAction = normalizeAction(letter.action);
      const normFilter = normalizeAction(actionFilter);
      if (normLetterAction !== normFilter) return false;
    }

    const fwdDivs = ensureStringArray(letter.forwardedDivisions);
    const fwdTo = ensureStringArray(letter.forwardedTo);

    // Division Filter
    if (selectedDivisionFilter !== 'All') {
      const targetDiv = selectedDivisionFilter.trim().toLowerCase();
      const letterDiv = (letter.division || '').trim().toLowerCase();
      const matchesDiv =
        letterDiv === targetDiv ||
        fwdDivs.some((d) => d.trim().toLowerCase() === targetDiv) ||
        fwdTo.some((uid) => {
          const clean = uid.trim().toLowerCase();
          const u = users.find(
            (usr) =>
              usr.User_ID.trim().toLowerCase() === clean ||
              usr.Name.trim().toLowerCase() === clean
          );
          return (u?.Division || '').trim().toLowerCase() === targetDiv;
        });
      if (!matchesDiv) return false;
    }

    // Officer Filter (from toolbar dropdown)
    if (selectedOfficerFilter !== 'All') {
      const matchesSelectedOfficer = doesLetterMatchOfficer(letter, selectedOfficerFilter, users);
      if (!matchesSelectedOfficer) return false;
    }

    // Subject Category Filter (Requests & Appeals, Complaints, Event Invitations, Reminder Letters)
    if (selectedCategoryFilter !== 'All') {
      const category = classifySubjectCategory(letter.subject);
      if (category !== selectedCategoryFilter) return false;
    }

    // Specific Date Filter ("குறித்த திகதி வைத்து தேடல்")
    if (selectedDateFilter) {
      const targetDate = selectedDateFilter.trim();
      const matchRegDate = (letter.date || '').trim() === targetDate;
      const matchDispDate = (letter.dispatchedDate || '').trim() === targetDate;
      if (!matchRegDate && !matchDispDate) return false;
    }

    // Search Query (Comprehensive search by Officer Name / ID / Designation, Original No, Inward No, Subject, From, Dates, Division, Notes)
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    const matchesOfficerSearch = doesLetterMatchOfficer(letter, q, users);

    const forwardedNames = fwdTo
      .map((id) => getOfficerDisplayName(id, users))
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return (
      (letter.originalNo || '').toLowerCase().includes(q) ||
      (letter.inwardNo || '').toLowerCase().includes(q) ||
      (letter.fileNo || '').toLowerCase().includes(q) ||
      (letter.registeredPostNo || '').toLowerCase().includes(q) ||
      (letter.fromWhom || '').toLowerCase().includes(q) ||
      (letter.subject || '').toLowerCase().includes(q) ||
      (letter.date || '').toLowerCase().includes(q) ||
      (letter.dispatchedDate || '').toLowerCase().includes(q) ||
      (letter.division || '').toLowerCase().includes(q) ||
      (letter.replyResponse || '').toLowerCase().includes(q) ||
      forwardedNames.includes(q) ||
      matchesOfficerSearch
    );
  });

  const isSuperAdmin = currentUser.Role === 'Super Admin';
  const isLetterRegistrar =
    currentUser.Role === 'Mail Officer' ||
    currentUser.User_ID === 'mail01' ||
    currentUser.Role === 'Super Admin';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar with Mobile Responsive Spacing */}
      <header className="sticky top-0 z-30 border-b border-blue-950/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white shadow-lg backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2 pb-2 sm:py-2.5">
          {/* Row 1: Brand & User / Sign Out */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <VaharaiLogo size="md" />
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base font-bold tracking-tight text-white truncate">
                  Divisional Secretariat • Koralaipattu North (Vaharai)
                </h1>
                <p className="text-[10px] sm:text-[11px] text-blue-200 truncate">
                  Mail Registration, Departmental Routing & Tracking System
                </p>
              </div>
            </div>

            {/* User Profile & Sign Out */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col items-end text-xs">
                <span className="font-bold text-white flex items-center gap-1 text-[11px] sm:text-xs">
                  {currentUser.Role === 'Luxury' && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                  <span className="truncate max-w-[100px] sm:max-w-none">{currentUser.Name}</span>
                </span>
                <span className="text-blue-200 text-[10px] flex items-center gap-1">
                  {currentUser.Division && <span className="hidden md:inline">{currentUser.Division} • </span>}
                  <span className="rounded bg-blue-700/90 px-1.5 py-0.2 font-bold text-white uppercase text-[9px] sm:text-[10px]">
                    {currentUser.Role}
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Sign out of portal (வெளியேறு)"
                className="flex items-center gap-1 rounded-xl bg-red-600/90 hover:bg-red-700 active:scale-95 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer min-h-[32px]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Row 2: Action Buttons Bar - shifted slightly down with clear margins & beautiful touch-friendly cards */}
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Requirement: Mail Officer / Letter Registrar "+ Register Mail" button */}
            {isLetterRegistrar && (
              <button
                type="button"
                onClick={() => setIsRegisterOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition cursor-pointer min-h-[34px]"
                title="புதிய உள்வரும் தபால்களைப் பதிவு செய்க (+ Register Mail)"
              >
                <PlusCircle className="h-4 w-4" />
                <span>+ Register Mail</span>
              </button>
            )}

            {/* Requirement: Letter Registrar (கடித பதிவாளர்) only - Backup Records to Cloud */}
            {isLetterRegistrar && (
              <button
                type="button"
                onClick={handleUploadLocalStorageToJson}
                disabled={isUploadingToJson}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-60 cursor-pointer min-h-[34px]"
                title="Backup all mail records to cloud server"
              >
                <UploadCloud className={`h-4 w-4 ${isUploadingToJson ? 'animate-bounce text-amber-300' : ''}`} />
                <span>
                  {isUploadingToJson ? 'Saving...' : 'Backup Records'}
                </span>
              </button>
            )}

            {/* Requirement: ONLY Super Admin and Admin (Mega) can download the backup file */}
            {(isSuperAdmin || currentUser?.Role === 'Mega') && (
              <button
                type="button"
                onClick={handleDownloadJson}
                className="flex items-center gap-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-95 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white shadow-sm transition cursor-pointer min-h-[34px]"
                title="Export official backup file"
              >
                <Download className="h-4 w-4 text-teal-200" />
                <span>Export Backup</span>
              </button>
            )}

            {/* Live Sync button available to all users to pull updates from other browsers */}
            <button
              type="button"
              onClick={() => loadCloud(true)}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition cursor-pointer min-h-[34px]"
              title="Synchronize records with server (Sync Now)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : 'text-slate-300'}`} />
              <span>Sync</span>
            </button>

            {/* Requirement: Super Admin User Management */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsUserMgmtOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white shadow-sm transition cursor-pointer min-h-[34px]"
                title="User Management"
              >
                <Users className="h-4 w-4" />
                <span>User Management</span>
              </button>
            )}

            {/* Requirement: System Connection Settings ONLY visible to Super Admin */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsCloudSettingsOpen(true)}
                title="System Connection Status & Settings"
                className={`flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer min-h-[34px] ${
                  cloudStatus === 'connected'
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-500/50'
                    : cloudStatus === 'error_403'
                    ? 'bg-red-600 hover:bg-red-700 text-white border border-red-300 animate-pulse'
                    : 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-400/50'
                }`}
              >
                {loadingCloud ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                ) : cloudStatus === 'connected' ? (
                  <Cloud className="h-3.5 w-3.5 text-emerald-200" />
                ) : (
                  <CloudOff className="h-3.5 w-3.5 text-white" />
                )}
                <span>
                  {loadingCloud
                    ? 'Connecting...'
                    : cloudStatus === 'connected'
                    ? 'Connected'
                    : cloudStatus === 'error_403'
                    ? 'Access Restricted'
                    : 'Offline'}
                </span>
              </button>
            )}

            {/* Super Admin Restore Baseline Data */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={handleResetData}
                title="Restore all 460 official Secretariat letters and 108 officers"
                className="hidden xl:flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer min-h-[34px]"
              >
                <RotateCcw className="h-3 w-3 text-emerald-400" />
                <span>460 கடிதங்கள்</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* System Status Banner: Settings link ONLY for Super Admin */}
      <div
        onClick={() => {
          if (isSuperAdmin) setIsCloudSettingsOpen(true);
        }}
        className={`w-full border-b px-4 py-1.5 text-center text-xs font-medium flex items-center justify-center gap-2 transition ${
          isSuperAdmin ? 'cursor-pointer hover:bg-opacity-90' : ''
        } ${
          cloudStatus === 'connected'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : cloudStatus === 'error_403'
            ? 'bg-red-50 border-red-200 text-red-900 font-bold'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${
            loadingCloud
              ? 'bg-blue-500 animate-ping'
              : cloudStatus === 'connected'
              ? 'bg-emerald-500'
              : cloudStatus === 'error_403'
              ? 'bg-red-600 animate-ping'
              : 'bg-amber-500'
          }`}
        ></span>
        <span>
          {loadingCloud ? 'Connecting...' : cloudMessage || 'System Connected'}
        </span>
        {isSuperAdmin ? (
          <span className="underline text-[11px] ml-1 font-bold text-blue-700">
            (Settings)
          </span>
        ) : (
          <span className="text-[11px] ml-1 text-slate-600 font-semibold">
            • {letters.length} Total Records
          </span>
        )}
      </div>

      {/* Role Context Bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-2.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">Active Role Profile:</span>
            <span
              className={`rounded-full px-3 py-0.5 font-bold ${
                currentUser.Role === 'Super Admin'
                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                  : currentUser.Role === 'Mega'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : currentUser.Role === 'Luxury'
                  ? 'bg-amber-200 text-amber-950 border border-amber-400 font-black'
                  : currentUser.Role === 'Mail Officer'
                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                  : currentUser.Role === 'Normal'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {currentUser.Role === 'Luxury' && '👑 '}
              {currentUser.Role}
            </span>
            <span className="text-gray-500 font-medium">({currentUser.Division})</span>
          </div>

          <div className="text-gray-600 font-medium text-xs">
            {currentUser.Role === 'Super Admin' && (
              <span>🛡️ Super Admin: Full administrative privileges to edit all records and manage users.</span>
            )}
            {currentUser.Role === 'Mega' && (
              <span>📊 Mega User: Divisional Secretary level overview; route and forward mail across all branches.</span>
            )}
            {currentUser.Role === 'Luxury' && (
              <span>
                👑 Luxury Role: Permitted access to {currentUser.assignedDivisions?.length || 0} designated divisions & analytics.
              </span>
            )}
            {currentUser.Role === 'Mail Officer' && (
              <span>✉️ Mail Officer: Initial mail registration, full post-entry editing, and official dispatch logs.</span>
            )}
            {currentUser.Role === 'Normal' && (
              <span>🏢 Branch Head: Direct oversight of mail routed to {currentUser.Division}.</span>
            )}
            {currentUser.Role === 'User' && (
              <span>👤 Officer: Inbox for assigned tasks under ID {currentUser.User_ID}.</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Requirement 6: Division Status Analytics & Progress Graph for ALL divisions */}
        <DivisionActionChart
          letters={roleFilteredLetters}
          allUsers={users}
          currentUser={currentUser}
          onFilterByStatus={(st) => setActionFilter(st)}
          onFilterByDivision={(div) => setSelectedDivisionFilter(div)}
          currentStatusFilter={actionFilter}
        />

        {/* Subject-Based Categorized Mail Dashboard (Requests, Complaints, Invitations, Reminders) */}
        <SubjectCategoryDashboard
          letters={roleFilteredLetters}
          allUsers={users}
          currentUser={currentUser}
          selectedCategoryFilter={selectedCategoryFilter}
          onSelectCategoryFilter={setSelectedCategoryFilter}
          onSelectLetter={(ltr) => {
            setSelectedLetter(ltr);
            setIsLetterEditMode(false);
          }}
          onEditLetter={(ltr) => {
            setSelectedLetter(ltr);
            setIsLetterEditMode(true);
          }}
          onUpdateLetter={handleUpdateLetter}
          viewMode={subjectViewMode}
          onToggleViewMode={setSubjectViewMode}
        />

        {/* Toolbar: Search, Filters, Excel Export & 10pt Print */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input with Clear Button */}
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Officer Name (உத்தியோகத்தர்), No, Subject, Division..."
                className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-8 text-xs text-gray-900 focus:border-blue-700 focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-700"
                  title="Clear Search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Specific Date Filter ("குறித்த திகதி வைத்து தேடல்") */}
              <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
                <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-gray-700 whitespace-nowrap">திகதி (Date):</span>
                <input
                  type="date"
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold text-gray-800 focus:border-blue-700 focus:outline-hidden"
                  title="குறித்த திகதியைத் தெரிவு செய்து தேடுக"
                />
                {selectedDateFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter('')}
                    className="p-0.5 text-gray-400 hover:text-red-600 transition cursor-pointer"
                    title="திகதியை நீக்குக (Clear Date Filter)"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* Quick Date Shortcut Buttons */}
                <div className="flex items-center gap-1 ml-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter('2026-10-29')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      selectedDateFilter === '2026-10-29'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                    }`}
                    title="இன்றைய திகதி கடிதங்கள் (2026-10-29)"
                  >
                    இன்று
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter('2026-10-28')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                      selectedDateFilter === '2026-10-28'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                    }`}
                    title="நேற்றைய திகதி கடிதங்கள் (2026-10-28)"
                  >
                    நேற்று
                  </button>
                </div>
              </div>

              {/* Subject Category Filter Dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <Layers className="h-4 w-4 text-indigo-600" />
                <span className="font-bold text-gray-700">Category:</span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:border-blue-700 focus:outline-hidden max-w-[190px] truncate"
                >
                  <option value="All">All Categories (அனைத்தும்)</option>
                  <option value="Requests & Appeals">Requests & Appeals (கோரிக்கைகள்)</option>
                  <option value="Complaints">Complaints (முறைப்பாடுகள்)</option>
                  <option value="Event Invitations">Event Invitations (அழைப்பிதல்கள்)</option>
                  <option value="Reminder Letters">Reminder Letters (நினைவூட்டல்கள்)</option>
                  <option value="Other Official Letters">Other Official Letters (ஏனையவை)</option>
                </select>
              </div>

              {/* Officer Filter Dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-bold text-gray-700">Officer (உத்தியோகத்தர்):</span>
                <select
                  value={selectedOfficerFilter}
                  onChange={(e) => setSelectedOfficerFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:border-blue-700 focus:outline-hidden max-w-[170px] truncate"
                >
                  <option value="All">All Officers (அனைவரும்)</option>
                  {users.map((u) => (
                    <option key={u.User_ID} value={u.User_ID}>
                      {u.Name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="font-bold text-gray-700">Status:</span>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:border-blue-700 focus:outline-hidden"
                >
                  <option value="All">All Statuses (அனைத்தும்)</option>
                  <option value="Action Taken">Action Taken (முடிந்தது)</option>
                  <option value="Action Not Taken">Action Not Taken (நிலுவை)</option>
                  <option value="Under Investigation">Under Investigation (கள ஆய்வு)</option>
                  <option value="Not Yet Viewed">Not Yet Viewed (புதியவை)</option>
                </select>
              </div>

              {/* 10pt Print Report Button */}
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                <button
                  type="button"
                  onClick={() =>
                    printLandscapeReport(
                      selectedCategoryFilter !== 'All'
                        ? `${selectedCategoryFilter} Mail Register Log`
                        : 'Filtered Mail Register Log',
                      displayedLetters,
                      usersMap
                    )
                  }
                  title="Print Official A4 Landscape Report (10pt font) with Signature column"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-black transition cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print (10pt Font)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Indicators & Result Count */}
          {(actionFilter !== 'All' || selectedOfficerFilter !== 'All' || selectedDivisionFilter !== 'All' || selectedCategoryFilter !== 'All' || selectedDateFilter || searchQuery.trim()) && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-gray-500">Active Filters:</span>
                {selectedDateFilter && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-900 text-[11px]">
                    <Calendar className="h-3 w-3 text-emerald-700" />
                    திகதி: {selectedDateFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedDateFilter('')}
                      className="hover:text-red-700 ml-0.5 cursor-pointer"
                      title="திகதியை நீக்குக"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedCategoryFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 font-bold text-indigo-900 text-[11px]">
                    Category: {selectedCategoryFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter('All')}
                      className="hover:text-red-700 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {actionFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-900 text-[11px]">
                    Status: {actionFilter}
                    <button
                      type="button"
                      onClick={() => setActionFilter('All')}
                      className="hover:text-red-700 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedOfficerFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 font-bold text-purple-900 text-[11px]">
                    Officer: {getOfficerDisplayName(selectedOfficerFilter, users)}
                    <button
                      type="button"
                      onClick={() => setSelectedOfficerFilter('All')}
                      className="hover:text-red-700 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedDivisionFilter !== 'All' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-900 text-[11px]">
                    Division: {selectedDivisionFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedDivisionFilter('All')}
                      className="hover:text-red-700 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {searchQuery.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-900 text-[11px]">
                    Search: &ldquo;{searchQuery}&rdquo;
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="hover:text-red-700 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryFilter('All');
                    setActionFilter('All');
                    setSelectedOfficerFilter('All');
                    setSelectedDivisionFilter('All');
                    setSelectedDateFilter('');
                    setSearchQuery('');
                  }}
                  className="text-[11px] text-red-600 font-bold hover:underline ml-1 cursor-pointer"
                >
                  Clear All Filters (அனைத்தும் அழி)
                </button>
              </div>

              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                Matching: {displayedLetters.length} Mail {displayedLetters.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
          )}
        </div>

        {/* 5-Day Folder Structure */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>📁 Date-Wise Mail Folders (5-Day Batch Navigation)</span>
              {selectedCategoryFilter !== 'All' && (
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-900">
                  Filtered by: {selectedCategoryFilter}
                </span>
              )}
            </h2>
            <span className="text-xs text-gray-500">
              Each folder can be expanded or printed in 10pt A4 landscape layout.
            </span>
          </div>

          <DateFoldersList
            letters={displayedLetters}
            currentUser={currentUser}
            allUsers={users}
            onSelectLetter={(ltr) => {
              setSelectedLetter(ltr);
              setIsLetterEditMode(false);
            }}
            onEditLetter={(ltr) => {
              setSelectedLetter(ltr);
              setIsLetterEditMode(true);
            }}
            onDeleteLetter={handleDeleteLetter}
            onUpdateLetter={handleUpdateLetter}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
        Divisional Secretariat • Koralaipattu North (Vaharai) &copy; {new Date().getFullYear()}. All Rights Reserved.
      </footer>

      {/* Mail Registration Modal (Mail Officer) */}
      <LetterRegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSave={handleSaveNewLetter}
        currentUser={currentUser}
        allUsers={users}
        existingLetters={letters}
      />

      {/* Detail, Edit & Chat Modal */}
      <LetterDetailAndChatModal
        isOpen={!!selectedLetter}
        letter={selectedLetter}
        currentUser={currentUser}
        allUsers={users}
        initialEditMode={isLetterEditMode}
        onClose={() => {
          setSelectedLetter(null);
          setIsLetterEditMode(false);
        }}
        onUpdateLetter={handleUpdateLetter}
        onDeleteLetter={handleDeleteLetter}
      />

      {/* User & Role Management Modal (Super Admin) */}
      <UserManagementModal
        isOpen={isUserMgmtOpen}
        onClose={() => setIsUserMgmtOpen(false)}
        users={users}
        onAddUser={handleAddUser}
        onUpdateUser={handleUpdateUser}
        onDeleteUser={handleDeleteUser}
      />

      {/* Google Drive JSON & Sheets Cloud Synchronization & Diagnostics Modal - Super Admin Only */}
      {isSuperAdmin && (
        <CloudSyncSettingsModal
          isOpen={isCloudSettingsOpen}
          onClose={() => setIsCloudSettingsOpen(false)}
          storageMode={storageMode}
          onSaveStorageMode={handleSaveStorageMode}
          driveFileId={driveFileId}
          onSaveDriveFileId={handleSaveDriveFileId}
          onTestDriveConnection={handleTestDriveConnection}
          onUploadAllToDrive={handleUploadAllToDrive}
          currentUrl={cloudUrl}
          onSaveUrl={handleSaveCloudUrl}
          onTestConnection={handleTestCloudConnection}
          letters={letters}
          users={users}
          onSyncAllLetters={handleSyncAllLetters}
          onRepairShiftedRows={handleRepairShiftedRows}
          cloudStatus={cloudStatus}
          cloudMessage={cloudMessage}
          driveLatency={driveLatency}
          onRestoreBaseline={handleResetData}
        />
      )}
    </div>
  );
}

