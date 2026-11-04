import * as XLSX from 'xlsx';
import { Letter, User, LetterAction, SubjectCategory } from '../types';

export interface SubjectCategoryConfig {
  key: SubjectCategory;
  englishLabel: string;
  tamilLabel: string;
  shortLabel: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  cardBg: string;
  cardBorder: string;
  accentBg: string;
  accentText: string;
  description: string;
}

export const SUBJECT_CATEGORIES_CONFIG: SubjectCategoryConfig[] = [
  {
    key: 'Requests & Appeals',
    englishLabel: 'Requests & Appeals',
    tamilLabel: 'கோரிக்கை அல்லது வேண்டுகோள்கள்',
    shortLabel: 'Requests',
    badgeColor: 'text-blue-800',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-200',
    cardBg: 'bg-blue-50/40 hover:bg-blue-50/70',
    cardBorder: 'border-blue-200',
    accentBg: 'bg-blue-600',
    accentText: 'text-blue-900',
    description: 'Citizen requests, welfare appeals, grant applications & public petitions',
  },
  {
    key: 'Complaints',
    englishLabel: 'Complaints',
    tamilLabel: 'முறைப்பாடுகள்',
    shortLabel: 'Complaints',
    badgeColor: 'text-rose-800',
    badgeBg: 'bg-rose-50',
    badgeBorder: 'border-rose-200',
    cardBg: 'bg-rose-50/40 hover:bg-rose-50/70',
    cardBorder: 'border-rose-200',
    accentBg: 'bg-rose-600',
    accentText: 'text-rose-900',
    description: 'Public grievances, unauthorized encroachment disputes & formal complaints',
  },
  {
    key: 'Event Invitations',
    englishLabel: 'Event Invitations',
    tamilLabel: 'நிகழ்வுகளுக்கான அழைப்பிதல்கள்',
    shortLabel: 'Invitations',
    badgeColor: 'text-purple-800',
    badgeBg: 'bg-purple-50',
    badgeBorder: 'border-purple-200',
    cardBg: 'bg-purple-50/40 hover:bg-purple-50/70',
    cardBorder: 'border-purple-200',
    accentBg: 'bg-purple-600',
    accentText: 'text-purple-900',
    description: 'Ceremonies, departmental meetings, inaugurations, seminars & celebrations',
  },
  {
    key: 'Reminder Letters',
    englishLabel: 'Reminder Letters',
    tamilLabel: 'மீள் ஞாபகமூட்டல் கடிதங்கள்',
    shortLabel: 'Reminders',
    badgeColor: 'text-amber-800',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200',
    cardBg: 'bg-amber-50/40 hover:bg-amber-50/70',
    cardBorder: 'border-amber-200',
    accentBg: 'bg-amber-500',
    accentText: 'text-amber-900',
    description: 'Subsequent follow-ups, urgent reminders & pending response notifications',
  },
  {
    key: 'Other Official Letters',
    englishLabel: 'Other Official Letters',
    tamilLabel: 'ஏனைய உத்தியோகபூர்வ கடிதங்கள்',
    shortLabel: 'General Mail',
    badgeColor: 'text-slate-800',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
    cardBg: 'bg-slate-50/60 hover:bg-slate-100/60',
    cardBorder: 'border-slate-200',
    accentBg: 'bg-slate-600',
    accentText: 'text-slate-900',
    description: 'General administrative circulars, gazettes, accounts & standard correspondence',
  },
];

/**
 * Automatically classifies a letter into one of the 4 requested categories based on its subject:
 * 1. Requests & Appeals (கோரிக்கை அல்லது வேண்டுகோள்கள்)
 * 2. Complaints (முறைப்பாடுகள்)
 * 3. Event Invitations (நிகழ்வுகளுக்கான அழைப்பிதல்கள்)
 * 4. Reminder Letters (மீள் ஞாபகமூட்டல் கடிதங்கள்)
 * (or 'Other Official Letters' for general correspondence)
 */
export const classifySubjectCategory = (subject?: string): SubjectCategory => {
  if (!subject || typeof subject !== 'string') return 'Other Official Letters';
  const text = subject.toLowerCase().trim();
  if (!text) return 'Other Official Letters';

  // 1. Reminder Letters (மீள் ஞாபகமூட்டல் கடிதங்கள்)
  // Check reminders first because subjects often say "Reminder: Regarding Request ..."
  const isReminder =
    text.includes('reminder') ||
    text.includes('remind') ||
    text.includes('follow-up') ||
    text.includes('follow up') ||
    text.includes('followup') ||
    text.includes('subsequent') ||
    text.includes('pending response') ||
    text.includes('urgent reminder') ||
    text.includes('recollection') ||
    text.includes('recall') ||
    text.includes('மீள் ஞாபகமூட்டல்') ||
    text.includes('மீள் நினைவூட்டல்') ||
    text.includes('ஞாபகமூட்டல்') ||
    text.includes('நினைவூட்டல்') ||
    text.includes('நினைவூட்டு') ||
    text.includes('தொடர் கடிதம்') ||
    text.includes('மீள் நினைவூட்டு');

  if (isReminder) return 'Reminder Letters';

  // 2. Complaints (முறைப்பாடுகள்)
  const isComplaint =
    text.includes('complaint') ||
    text.includes('grievance') ||
    text.includes('dispute') ||
    text.includes('objection') ||
    text.includes('allegation') ||
    text.includes('dissatisfaction') ||
    text.includes('violation') ||
    text.includes('illegal') ||
    text.includes('encroachment') ||
    text.includes('unauthorized') ||
    text.includes('irregularity') ||
    text.includes('misconduct') ||
    text.includes('protest') ||
    text.includes('petition against') ||
    text.includes('report against') ||
    text.includes('முறைப்பாடு') ||
    text.includes('முறைப்பாடுகள்') ||
    text.includes('குறைதீர்ப்பு') ||
    text.includes('புகார்') ||
    text.includes('ஆட்சேபனை') ||
    text.includes('அத்துமீறல்') ||
    text.includes('அனுமதியற்ற') ||
    text.includes('முறைகேடு') ||
    text.includes('எதிர்ப்பு') ||
    text.includes('பிணக்கு');

  if (isComplaint) return 'Complaints';

  // 3. Event Invitations (நிகழ்வுகளுக்கான அழைப்பிதல்கள்)
  const isInvitation =
    text.includes('invitation') ||
    text.includes('invite') ||
    text.includes('event') ||
    text.includes('ceremony') ||
    text.includes('celebration') ||
    text.includes('opening') ||
    text.includes('inauguration') ||
    text.includes('workshop') ||
    text.includes('seminar') ||
    text.includes('conference') ||
    text.includes('function') ||
    text.includes('meeting notice') ||
    text.includes('meeting') ||
    text.includes('annual general') ||
    text.includes('festival') ||
    text.includes('commemoration') ||
    text.includes('anniversary') ||
    text.includes('symposium') ||
    text.includes('shramadana') ||
    text.includes('programme') ||
    text.includes('program') ||
    text.includes('அழைப்பிதழ்') ||
    text.includes('அழைப்பு') ||
    text.includes('நிகழ்வு') ||
    text.includes('நிகழ்வுகள்') ||
    text.includes('விழா') ||
    text.includes('வைபவம்') ||
    text.includes('மாநாடு') ||
    text.includes('கருத்தரங்கு') ||
    text.includes('ஆரம்ப விழா') ||
    text.includes('திறப்பு விழா') ||
    text.includes('கூட்ட அழைப்பு') ||
    text.includes('கூட்டம்') ||
    text.includes('சிரமதானம்');

  if (isInvitation) return 'Event Invitations';

  // 4. Requests & Appeals (கோரிக்கை அல்லது வேண்டுகோள்கள்)
  const isRequest =
    text.includes('request') ||
    text.includes('appeal') ||
    text.includes('application') ||
    text.includes('requisition') ||
    text.includes('petition') ||
    text.includes('plea') ||
    text.includes('claim') ||
    text.includes('assistance') ||
    text.includes('subsidy') ||
    text.includes('welfare') ||
    text.includes('grant') ||
    text.includes('seeking') ||
    text.includes('apply') ||
    text.includes('solicitation') ||
    text.includes('tender request') ||
    text.includes('fund allocation') ||
    text.includes('approval for') ||
    text.includes('permission for') ||
    text.includes('கோரிக்கை') ||
    text.includes('வேண்டுகோள்') ||
    text.includes('விண்ணப்பம்') ||
    text.includes('வேண்டுதல்') ||
    text.includes('மனு') ||
    text.includes('உதவி கோரி') ||
    text.includes('கோரிக்கை') ||
    text.includes('அனுமதி கோரி') ||
    text.includes('கோரல்') ||
    text.includes('கொடுப்பனவு') ||
    text.includes('அஸ்வெசும') ||
    text.includes('வழங்குதல்') ||
    text.includes('ஒதுக்கீடு செய்யுமாறு');

  if (isRequest) return 'Requests & Appeals';

  return 'Other Official Letters';
};

/**
 * Checks whether a value is genuinely a valid Action Status string (English or Tamil),
 * rather than shifted column data (like ForwardedTo, ReplyResponse, or JSON ExtraData).
 */
export const isKnownActionValue = (val?: any): boolean => {
  if (!val || typeof val !== 'string') return false;
  const str = val.trim();
  if (!str || str.startsWith('{') || str.startsWith('[')) return false;
  const lower = str.toLowerCase();
  return (
    str === 'Not Yet Viewed' ||
    str === 'Action Taken' ||
    str === 'Action Not Taken' ||
    str === 'Under Investigation' ||
    str === 'Pending' ||
    str === 'இன்னும் பார்க்கவில்லை' ||
    str === 'நடவடிக்கை எடுக்கப்பட்டது' ||
    str === 'நடவடிக்கை எடுக்கப்படவில்லை' ||
    str === 'கள ஆய்வில்' ||
    lower === 'not yet viewed' ||
    lower === 'action taken' ||
    lower === 'action not taken' ||
    lower === 'under investigation'
  );
};

export const KNOWN_OFFICIAL_DIVISIONS = [
  'நிர்வாகப் பிரிவு (Administration)',
  'காணிப் பிரிவு (Land Division)',
  'திட்டமிடல் பிரிவு (Planning)',
  'சமூக சேவை (Social)',
  'சமுர்த்தி (Samurdhi)',
  'கிராம அபிவிருத்தி (Rural Development)',
  'கணக்குப் பிரிவு (Accounts & Finance)',
  'கணக்குப் பிரிவு (Finance)',
  'தேசிய அடையாள அட்டை பிரிவு (NIC)',
  'தபால் & ஆவணப் பிரிவு (Mail & Records)',
  'வெளிக்களம் (Field)',
  'சிறுவர் பிரிவு (Field)',
  'பதிவாளர் கிளை (Registrar Branch)',
  'பதிவாளர் பிரிவு (Registrar Branch)',
  'அபிவிருத்திப் பிரிவு (Development)',
  'பொது நிர்வாகம் (General Administration)',
  'கிராம அலுவலர் பிரிவு (Grama Niladhari)',
];

export const isExactDivisionName = (val?: any): boolean => {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  if (KNOWN_OFFICIAL_DIVISIONS.includes(s)) return true;
  if (
    s === 'காணிப் பிரிவு' ||
    s === 'திட்டமிடல் பிரிவு' ||
    s === 'நிர்வாகப் பிரிவு' ||
    s === 'சமுர்த்தி' ||
    s === 'சமூக சேவை' ||
    s === 'கணக்குப் பிரிவு' ||
    s === 'பதிவாளர் பிரிவு' ||
    s === 'பதிவாளர் கிளை' ||
    s === 'கிராம அலுவலர் பிரிவு' ||
    s === 'சிறுவர் பிரிவு' ||
    s === 'வெளிக்களம்' ||
    s === 'அபிவிருத்திப் பிரிவு' ||
    s === 'Administration' ||
    s === 'Land Division' ||
    s === 'Planning' ||
    s === 'Social' ||
    s === 'Samurdhi' ||
    s === 'Accounts & Finance' ||
    s === 'Finance' ||
    s === 'Field' ||
    s === 'NIC' ||
    s === 'Mail & Records' ||
    s === 'Registrar Branch'
  ) {
    return true;
  }
  return false;
};

export const isOfficialDivisionName = (val?: any): boolean => {
  if (!val || typeof val !== 'string') return false;
  if (isExactDivisionName(val)) return true;
  const s = val.trim();

  // Explicitly do not match sender institutions, ministries, departments, banks, or schools
  if (
    s.includes('Secretariat') ||
    s.includes('செயலகம்') ||
    s.includes('Ministry') ||
    s.includes('அமைச்சு') ||
    s.includes('Department') ||
    s.includes('திணைக்களம்') ||
    s.includes('Bank') ||
    s.includes('வங்கி') ||
    s.includes('School') ||
    s.includes('பாடசாலை') ||
    s.includes('Hospital') ||
    s.includes('வைத்தியசாலை') ||
    s.includes('கழகம்') ||
    s.includes('சங்கம்') ||
    s.includes('அலுவலகம்') ||
    s.includes('Office') ||
    s.includes('Authority') ||
    s.includes('பணியகம்')
  ) {
    return false;
  }

  return (
    (s.includes('பிரிவு') ||
      s.includes('Division') ||
      s.includes('Samurdhi') ||
      s.includes('சமுர்த்தி') ||
      s.includes('Planning') ||
      s.includes('Registrar') ||
      s.includes('வெளிக்களம்') ||
      s.includes('Field')) &&
    s.length < 50
  );
};

/**
 * Repairs scrambled or shifted letter columns so every field appears strictly under its proper heading:
 * 1. Computer No (Original No)
 * 2. Dispatched Date
 * 3. Post Type & Registered Post No (Reg No is 'No' if Normal Post)
 * 4. Inward No (கடித இலக்கம் - official reference number of the letter)
 * 5. From Whom (அனுப்புனர் - sender organization, citizen, or ministry)
 * 6. Subject (விடயம் - letter subject, topic, or matter)
 * 7. Division (பிரிவு - assigned DS office department)
 */
export const repairLetterRecord = (l: any): Letter | null => {
  if (!l || typeof l !== 'object') return null;
  const copy: any = { ...l };

  // 1. Drop dummy empty rows
  const isDummyNoId =
    (!copy.originalNo || copy.originalNo === '-' || !String(copy.originalNo).trim()) &&
    (!copy.fromWhom || copy.fromWhom === '-') &&
    (!copy.inwardNo || copy.inwardNo === '-') &&
    (!copy.subject || copy.subject === 'General' || copy.subject === '-');
  const isDummyWithId =
    copy.subject === 'General' &&
    (!copy.fromWhom || copy.fromWhom === '-') &&
    (!copy.inwardNo || copy.inwardNo === '-');
  if (isDummyNoId || isDummyWithId) return null;

  const isJsonOrUserIds = (val: any) => {
    if (!val) return false;
    if (Array.isArray(val)) return true;
    const s = String(val).trim();
    return s.startsWith('[') || /^[0-9]{9,12}[vVxX]?$/.test(s);
  };

  const parseUserIds = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String);
    const s = String(val).trim();
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {}
    }
    if (/^[0-9]{9,12}[vVxX]?$/.test(s)) return [s];
    return [];
  };

  // 2. Shift Pattern 1: fromWhom is an official division name
  // In this shift pattern:
  // - registeredPostNo holds the Sender (e.g. "தே.அமலாவதி, உரியன்கட்டு", "District Secretariat, Batticaloa")
  // - inwardNo holds the Subject (e.g. "காணி தொடர்பான முறைப்பாடு")
  // - fromWhom holds the Division Name (e.g. "காணிப் பிரிவு (Land Division)")
  if (isOfficialDivisionName(copy.fromWhom)) {
    const realDiv = copy.fromWhom.trim();
    const realSubj =
      copy.inwardNo && copy.inwardNo !== '-' && copy.inwardNo !== 'No'
        ? String(copy.inwardNo).trim()
        : (copy.subject && !isOfficialDivisionName(copy.subject) && copy.subject !== 'General'
          ? String(copy.subject).trim()
          : realDiv);
    const realSender =
      copy.registeredPostNo && copy.registeredPostNo !== 'No' && copy.registeredPostNo !== '-'
        ? String(copy.registeredPostNo).trim()
        : 'District Secretariat, Batticaloa';
    const users = parseUserIds(copy.division);

    copy.inwardNo = '-';
    copy.fromWhom = realSender;
    copy.subject = realSubj;
    copy.division = realDiv;
    copy.forwardedDivisions = [realDiv];
    if (users.length > 0) copy.forwardedTo = users;
    copy.letterType = copy.letterType || 'Normal Post';
    copy.registeredPostNo = 'No';
    return copy as Letter;
  }

  // 3. Shift Pattern 2: subject is an official division name
  // In this shift pattern:
  // - registeredPostNo holds the Inward No (e.g. "MF/SD/07/13/CM-20", "KPN/PS/RB/RS2/2026")
  // - inwardNo holds the Sender (e.g. "Ministry of Fisheries...", "Pradeshiya Sabha...")
  // - fromWhom holds the Subject (e.g. "Leasing of 36.0123 hectares...", "காணியினை உறுதிப்படுத்தல்...")
  // - subject holds the Division Name (e.g. "காணிப் பிரிவு (Land Division)")
  if (isOfficialDivisionName(copy.subject)) {
    const realDiv = copy.subject.trim();
    const realSubj = copy.fromWhom ? String(copy.fromWhom).trim() : realDiv;
    const realSender =
      copy.inwardNo && copy.inwardNo !== '-' && copy.inwardNo !== 'null'
        ? String(copy.inwardNo).trim()
        : 'District Secretariat, Batticaloa';

    const rawReg = copy.registeredPostNo ? String(copy.registeredPostNo).trim() : '';
    let realInward = '-';
    if (rawReg && rawReg !== 'No' && rawReg !== '-' && rawReg !== 'null' && rawReg !== 'undefined') {
      realInward = rawReg;
    } else if (copy.inwardNo && copy.inwardNo !== 'No' && copy.inwardNo !== '-' && copy.inwardNo !== 'null' && copy.inwardNo !== realSender) {
      realInward = copy.inwardNo;
    }

    const extractedUsers = parseUserIds(copy.division);

    copy.inwardNo = realInward;
    copy.fromWhom = realSender;
    copy.subject = realSubj;
    copy.division = realDiv;
    copy.forwardedDivisions = [realDiv];
    if (extractedUsers.length > 0) {
      copy.forwardedTo = extractedUsers;
    }
    copy.registeredPostNo = 'No';
    copy.letterType = copy.letterType || 'Normal Post';
    return copy as Letter;
  }

  // 4. Normal letters: clean Normal Post registeredPostNo if improperly filled
  if (
    copy.letterType === 'Normal Post' &&
    copy.registeredPostNo &&
    copy.registeredPostNo !== 'No' &&
    copy.registeredPostNo !== '-'
  ) {
    if (!copy.inwardNo || copy.inwardNo === '-' || copy.inwardNo === 'null' || copy.inwardNo === 'No') {
      copy.inwardNo = copy.registeredPostNo;
    }
    copy.registeredPostNo = 'No';
  }

  // 5. If division is a json string or user ids, repair it
  if (isJsonOrUserIds(copy.division)) {
    const extracted = parseUserIds(copy.division);
    if (extracted.length > 0 && (!copy.forwardedTo || copy.forwardedTo.length === 0)) {
      copy.forwardedTo = extracted;
    }
    if (
      Array.isArray(copy.forwardedDivisions) &&
      copy.forwardedDivisions.length > 0 &&
      isOfficialDivisionName(copy.forwardedDivisions[0])
    ) {
      copy.division = copy.forwardedDivisions[0];
    } else {
      copy.division = 'நிர்வாகப் பிரிவு (Administration)';
    }
  }

  return copy as Letter;
};

/**
 * Ensures Registered Post No is never empty in the Sheet or system.
 * If no postal registration number is provided, automatically returns "No".
 */
export const normalizeRegisteredPostNo = (val?: any): string => {
  if (val === null || val === undefined) return 'No';
  const str = String(val).trim();
  if (
    !str ||
    str === '-' ||
    str === '_' ||
    str.toLowerCase() === 'null' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'none' ||
    str.toLowerCase() === 'n/a' ||
    str.toLowerCase() === 'no'
  ) {
    return 'No';
  }
  return str;
};

/**
 * Normalizes any Action Status string into a strict LetterAction standard value.
 * Handles Tamil and English variations and protects against RPC command strings like UPDATE_LETTER.
 */
export const normalizeAction = (val?: any): LetterAction => {
  if (!val) return 'Not Yet Viewed';
  const str = String(val).trim();
  if (
    str === 'UPDATE_LETTER' ||
    str === 'ADD_LETTER' ||
    str === 'DELETE_LETTER' ||
    str === 'Pending' ||
    str === 'Not Yet Viewed' ||
    str === 'இன்னும் பார்க்கவில்லை'
  ) {
    return 'Not Yet Viewed';
  }
  if (
    str === 'Action Taken' ||
    str === 'நடவடிக்கை எடுக்கப்பட்டது' ||
    str.toLowerCase().includes('taken') ||
    str.toLowerCase().includes('எடுக்கப்பட்டது') ||
    str.toLowerCase().includes('completed') ||
    str.toLowerCase().includes('done')
  ) {
    return 'Action Taken';
  }
  if (
    str === 'Action Not Taken' ||
    str === 'நடவடிக்கை எடுக்கப்படவில்லை' ||
    str.toLowerCase().includes('not taken') ||
    str.toLowerCase().includes('எடுக்கப்படவில்லை')
  ) {
    return 'Action Not Taken';
  }
  if (
    str === 'Under Investigation' ||
    str === 'கள ஆய்வில்' ||
    str.toLowerCase().includes('investig') ||
    str.toLowerCase().includes('ஆய்வில்') ||
    str.toLowerCase().includes('field')
  ) {
    return 'Under Investigation';
  }
  return 'Not Yet Viewed';
};

/**
 * Guaranteed safe array converter for string arrays (forwardedTo, forwardedDivisions, assignedDivisions, etc.)
 * Handles arrays, JSON serialized arrays, comma-separated strings, objects, numbers, and null/undefined.
 */
export const ensureStringArray = (val: any): string[] => {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return String(item.User_ID || item.userId || item.id || item.Name || item.name || '').trim();
        }
        return String(item ?? '').trim();
      })
      .filter((item) => item !== '' && item !== 'null' && item !== 'undefined' && item !== '[object Object]');
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[object Object]') return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => {
              if (typeof item === 'string') return item.trim();
              if (item && typeof item === 'object') {
                return String(item.User_ID || item.userId || item.id || item.Name || item.name || '').trim();
              }
              return String(item ?? '').trim();
            })
            .filter((item) => item !== '' && item !== 'null' && item !== 'undefined' && item !== '[object Object]');
        }
      } catch {}
    }
    // Handle comma-separated list like "officer01, officer02"
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '' && item !== 'null' && item !== 'undefined' && item !== '[object Object]');
  }
  if (typeof val === 'object') {
    if (val.User_ID || val.userId || val.id || val.Name || val.name) {
      const extracted = String(val.User_ID || val.userId || val.id || val.Name || val.name).trim();
      if (extracted) return [extracted];
    }
    try {
      return Object.values(val)
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            return String((item as any).User_ID || (item as any).userId || (item as any).id || (item as any).Name || '').trim();
          }
          return String(item ?? '').trim();
        })
        .filter((item) => item !== '' && item !== 'null' && item !== 'undefined' && item !== '[object Object]');
    } catch {
      return [];
    }
  }
  const s = String(val).trim();
  return s && s !== 'null' && s !== 'undefined' && s !== '[object Object]' ? [s] : [];
};

/**
 * Resolves an officer's display name from either their User_ID or existing Name.
 */
export const getOfficerDisplayName = (idOrName: string, allUsers: User[]): string => {
  if (!idOrName) return '';
  const clean = idOrName.trim().toLowerCase();
  const matched = allUsers.find(
    (u) =>
      u.User_ID.trim().toLowerCase() === clean ||
      u.Name.trim().toLowerCase() === clean
  );
  return matched ? matched.Name : idOrName.trim();
};

/**
 * Checks whether a letter is forwarded to or associated with an officer matching the search query.
 * Handles search by officer Name (Tamil/English), User_ID, designation, etc.
 */
export const doesLetterMatchOfficer = (
  letter: Letter,
  query: string,
  allUsers: User[]
): boolean => {
  if (!query || !query.trim()) return false;
  const q = query.trim().toLowerCase();
  const fwdTo = ensureStringArray(letter.forwardedTo);
  const fwdDivs = ensureStringArray(letter.forwardedDivisions).map((d) => d.trim().toLowerCase());
  const letterDiv = (letter.division || '').trim().toLowerCase();

  // 1. Direct check on forwardedTo array items
  for (const item of fwdTo) {
    const clean = item.toLowerCase();
    if (clean.includes(q) || q.includes(clean)) return true;
    const displayName = getOfficerDisplayName(item, allUsers).toLowerCase();
    if (displayName.includes(q) || q.includes(displayName)) return true;
  }

  // 2. Resolve users for each forwardedTo recipient
  for (const recipient of fwdTo) {
    const clean = recipient.trim().toLowerCase();
    const u = allUsers.find(
      (usr) =>
        usr.User_ID.trim().toLowerCase() === clean ||
        usr.Name.trim().toLowerCase() === clean ||
        clean.includes(usr.User_ID.trim().toLowerCase()) ||
        clean.includes(usr.Name.trim().toLowerCase())
    );
    if (u) {
      if ((u.Name || '').toLowerCase().includes(q)) return true;
      if ((u.User_ID || '').toLowerCase().includes(q)) return true;
      if (u.designation && u.designation.toLowerCase().includes(q)) return true;
      if (u.Division && u.Division.toLowerCase().includes(q)) return true;
    }
  }

  // 3. Find any user in allUsers matching query (by Name, ID, Designation)
  const matchingOfficers = allUsers.filter((u) => {
    const uName = (u.Name || '').toLowerCase();
    const uId = (u.User_ID || '').toLowerCase();
    const uDesig = (u.designation || '').toLowerCase();
    return uName.includes(q) || uId.includes(q) || uDesig.includes(q) || q.includes(uName);
  });

  for (const officer of matchingOfficers) {
    const officerId = (officer.User_ID || '').trim().toLowerCase();
    const officerName = (officer.Name || '').trim().toLowerCase();

    // Check if letter was forwarded to this officer directly (ID or Name or substring)
    const isForwarded = fwdTo.some((item) => {
      const clean = item.trim().toLowerCase();
      return (
        clean === officerId ||
        clean === officerName ||
        clean.includes(officerId) ||
        officerName.includes(clean) ||
        clean.includes(officerName)
      );
    });
    if (isForwarded) return true;

    // Check if letter belongs to this officer's department/division
    const officerDiv = (officer.Division || '').trim().toLowerCase();
    if (
      officerDiv &&
      (letterDiv === officerDiv || fwdDivs.some((d) => d === officerDiv || d.includes(officerDiv)))
    ) {
      return true;
    }

    // Check if registered by this officer
    if (letter.registeredBy && letter.registeredBy.trim().toLowerCase() === officerId) return true;
    if (letter.registeredByName && letter.registeredByName.toLowerCase().includes(officerName)) return true;
  }

  return false;
};

/**
 * Generate Auto Original No in standard format: KPN/DS/YYYY/MM/NNN
 */
export const generateOriginalNo = (dateStr: string, existingLetters: Letter[]): string => {
  const dateObj = dateStr ? new Date(dateStr) : new Date();
  const year = dateObj.getFullYear() || new Date().getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');

  // Filter letters with this year/month
  const prefix = `KPN/DS/${year}/${month}/`;
  const matching = existingLetters.filter(
    (l) => l.originalNo && l.originalNo.startsWith(prefix)
  );

  let maxSeq = 0;
  for (const l of matching) {
    const parts = (l.originalNo || '').split('/');
    const lastPart = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastPart) && lastPart > maxSeq) {
      maxSeq = lastPart;
    }
  }

  const nextSeq = Math.max(matching.length, maxSeq) + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
};

/**
 * Compress an image file or canvas to approximately ~240 KB target
 */
export const compressImageToTarget = async (
  source: HTMLCanvasElement | File,
  targetKb = 240
): Promise<{ dataUrl: string; sizeKb: number }> => {
  let canvas: HTMLCanvasElement;

  if (source instanceof HTMLCanvasElement) {
    const maxDimension = 1200;
    if (source.width > maxDimension || source.height > maxDimension) {
      let width = source.width;
      let height = source.height;
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(source, 0, 0, width, height);
      } else {
        canvas = source;
      }
    } else {
      canvas = source;
    }
  } else {
    // It's a File
    canvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      img.onload = () => {
        const c = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(c);
        } else {
          reject(new Error('Canvas context error'));
        }
      };
      reader.readAsDataURL(source);
    });
  }

  // Iteratively adjust JPEG quality to fit under targetKb
  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);

  while (sizeKb > targetKb && quality > 0.2) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
  }

  return { dataUrl, sizeKb };
};

/**
 * Export letters to genuine Excel (.xlsx) file with full requested columns
 */
export const exportLettersToExcel = (
  letters: Letter[],
  usersMap: Map<string, User>,
  fileNamePrefix = 'Letters_Register'
) => {
  const cleanLetters = letters
    .map((l) => repairLetterRecord(l))
    .filter((l): l is Letter => l !== null && Boolean(l.originalNo && l.originalNo !== '-'));

  const rows = cleanLetters.map((l, index) => {
    const fwdTo = ensureStringArray(l.forwardedTo);
    const fwdDivs = ensureStringArray(l.forwardedDivisions);
    const forwardedNames = fwdTo
      .map((uid) => usersMap.get(uid)?.Name || uid)
      .join(', ');

    return {
      'S.No': index + 1,
      'Original No': l.originalNo,
      'Registered Date': l.date,
      'Dispatched Date': l.dispatchedDate || l.date,
      'Post Type': l.letterType || 'Normal Post',
      'Registered Post No': normalizeRegisteredPostNo(l.registeredPostNo),
      'Inward No': l.inwardNo || '-',
      'From Whom': l.fromWhom || '-',
      'Subject': l.subject || '-',
      'Primary Division': l.division || '-',
      'Forwarded Divisions': fwdDivs.join(', ') || '-',
      'Forwarded To (Officers)': forwardedNames || '-',
      'Action Status': l.action,
      'Reply / Notes': l.replyResponse || '-',
      'File No': l.fileNo || '-',
      'Registered By': l.registeredByName || l.registeredBy,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const columnWidths = [
    { wch: 6 },  // S.No
    { wch: 22 }, // Original No
    { wch: 14 }, // Registered Date
    { wch: 14 }, // Dispatched Date
    { wch: 16 }, // Post Type
    { wch: 18 }, // Registered Post No
    { wch: 16 }, // Inward No
    { wch: 28 }, // From Whom
    { wch: 45 }, // Subject
    { wch: 22 }, // Division
    { wch: 25 }, // Forwarded Divisions
    { wch: 30 }, // Forwarded To
    { wch: 18 }, // Action Status
    { wch: 30 }, // Reply / Notes
    { wch: 20 }, // File No
    { wch: 24 }, // Registered By
  ];
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mail Register');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${fileNamePrefix}_${todayStr}.xlsx`);
};

/**
 * Export letters to CSV file
 */
export const exportLettersToCsv = (
  letters: Letter[],
  usersMap: Map<string, User>,
  fileNamePrefix = 'Letters'
) => {
  const cleanLetters = letters
    .map((l) => repairLetterRecord(l))
    .filter((l): l is Letter => l !== null && Boolean(l.originalNo && l.originalNo !== '-'));

  const headers = [
    'OriginalNo',
    'DispatchedDate',
    'PostType',
    'RegisteredPostNo',
    'InwardNo',
    'FromWhom',
    'Subject',
    'Division',
    'ForwardedTo',
    'ActionStatus',
    'Reply',
    'FileNo',
  ];

  const csvRows: string[] = [headers.join(',')];

  cleanLetters.forEach((l) => {
    const fwdTo = ensureStringArray(l.forwardedTo);
    const forwardedNames = fwdTo
      .map((uid) => usersMap.get(uid)?.Name || uid)
      .join('; ');

    const clean = (val: string | undefined | null) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    csvRows.push(
      [
        clean(l.originalNo),
        clean(l.dispatchedDate || l.date),
        clean(l.letterType || 'Normal Post'),
        clean(normalizeRegisteredPostNo(l.registeredPostNo)),
        clean(l.inwardNo),
        clean(l.fromWhom),
        clean(l.subject),
        clean(l.division || '-'),
        clean(forwardedNames),
        clean(l.action),
        clean(l.replyResponse || ''),
        clean(l.fileNo || ''),
      ].join(',')
    );
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Print Landscape Report with exact requested 10pt (10px) font size
 * Columns requested by user:
 * 1. # (Serial No)
 * 2. OriginalNo (கணினி இலக்கம்)
 * 3. DispatchedDate (அனுப்பிய திகதி)
 * 4. Post Type & RegisteredPostNo (இரண்டும் ஒரே பெட்டியில்)
 * 5. InwardNo (கடித இலக்கம்)
 * 6. FromWhom (அனுப்புனர்)
 * 7. Subject (விடயம்)
 * 8. ForwardedDivisions & ForwardedTo (இரண்டும் ஒரே பெட்டியில்)
 * 9. Sign (ஒப்பம்)
 */
export const printLandscapeReport = (
  title: string,
  letters: Letter[],
  usersMap: Map<string, User>
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to view and print the report.');
    return;
  }

  const cleanLetters = letters
    .map((l) => repairLetterRecord(l))
    .filter((l): l is Letter => l !== null && Boolean(l.originalNo && l.originalNo !== '-'));

  const rowsHtml = cleanLetters
    .map((l, index) => {
      const fwdTo = ensureStringArray(l.forwardedTo);
      const forwardedNames = fwdTo
        .map((uid) => usersMap.get(uid)?.Name || uid)
        .join(', ');

      const rawDivs = ensureStringArray(l.forwardedDivisions);
      const divisionsList = (
        rawDivs.length > 0 ? rawDivs : [l.division]
      ).filter(Boolean);

      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${index + 1}</td>
          <td style="font-weight: 700; font-family: monospace; white-space: nowrap; color: #0f172a;">${l.originalNo || '-'}</td>
          <td style="white-space: nowrap; text-align: center;">${l.dispatchedDate || l.date || '-'}</td>
          <td>
            <div style="font-weight: bold; color: #0f172a;">${l.letterType || 'Normal Post'}</div>
            ${
              l.letterType === 'Registered Post' &&
              l.registeredPostNo &&
              l.registeredPostNo !== '-' &&
              l.registeredPostNo !== '_' &&
              l.registeredPostNo !== 'No'
                ? `<div style="font-size: 8.5pt; font-family: monospace; color: #1e3a8a; margin-top: 2px;">Reg No: ${l.registeredPostNo}</div>`
                : `<div style="font-size: 8pt; color: #64748b; margin-top: 1px;">Reg No: No</div>`
            }
          </td>
          <td style="font-weight: 600; font-family: monospace; color: #0f172a;">${l.inwardNo || '-'}</td>
          <td>${l.fromWhom || '-'}</td>
          <td>
            <div>${l.subject || '-'}</div>
            ${l.fileNo ? `<div style="margin-top: 3px; font-size: 8.5pt; color: #065f46; font-weight: bold; font-family: monospace;">📁 File: ${l.fileNo}</div>` : ''}
          </td>
          <td>
            <div style="font-weight: bold; color: #1e3a8a; margin-bottom: 2px;">🏢 ${divisionsList.join(', ') || l.division || '-'}</div>
            <div style="font-size: 8.5pt; color: #334155; border-top: 1px dashed #cbd5e1; padding-top: 2px; margin-top: 2px;">👤 ${forwardedNames || '—'}</div>
          </td>
          <td style="min-width: 65px; height: 32px; border-bottom: 1px dashed #94a3b8; text-align: center; vertical-align: bottom;"></td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - DS Office Mail Management</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm 8mm;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10pt; /* Requested font size 10pt */
            color: #111;
            margin: 0;
            padding: 8px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .header h1 {
            font-size: 13pt;
            font-weight: bold;
            margin: 0;
            color: #0f172a;
          }
          .header h2 {
            font-size: 10.5pt;
            margin: 2px 0 0 0;
            color: #1e3a8a;
          }
          .meta {
            font-size: 9pt;
            color: #475569;
            margin-top: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt; /* 10pt font size as requested */
            table-layout: fixed;
          }
          th, td {
            border: 1px solid #64748b;
            padding: 5px 6px;
            vertical-align: top;
            word-wrap: break-word;
          }
          th {
            background-color: #f1f5f9;
            font-weight: bold;
            color: #0f172a;
            text-align: left;
            font-size: 9.5pt;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .footer {
            margin-top: 15px;
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            color: #475569;
            border-top: 1px solid #cbd5e1;
            padding-top: 6px;
          }
          .sign-area {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            font-size: 9.5pt;
          }
          .sign-box {
            text-align: center;
            width: 200px;
            border-top: 1px dashed #334155;
            padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="/vaharai_ds_logo_1789105296870.jpg" alt="Logo" style="width:48px; height:48px; border-radius:50%; object-fit:contain; border:1.5px solid #d97706;" onerror="this.style.display='none'" />
            <div>
              <h1>Divisional Secretariat - Koralaipattu North, Vaharai</h1>
              <h2>Postal Mail Registration & Dispatch Log (அஞ்சல் பதிவு & நடவடிக்கை அறிக்கை)</h2>
              <div class="meta">
                <strong>Report:</strong> ${title} &nbsp;|&nbsp; 
                <strong>Total Records:</strong> ${letters.length} &nbsp;|&nbsp; 
                <strong>Printed On:</strong> ${new Date().toLocaleString()}
              </div>
            </div>
          </div>
          <div style="text-align: right; font-size: 9pt;">
            <span style="display:inline-block; border:1px solid #1e3a8a; border-radius:4px; padding:3px 8px; font-weight:bold; color:#1e3a8a;">
              OFFICIAL RECORD
            </span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 26px; text-align: center;">#</th>
              <th style="width: 140px;">Original No<br/><span style="font-size: 8pt; font-weight: normal; color: #475569;">(கணினி இலக்கம்)</span></th>
              <th style="width: 80px; text-align: center;">Dispatched Date<br/><span style="font-size: 8pt; font-weight: normal; color: #475569;">(அனுப்பிய திகதி)</span></th>
              <th style="width: 110px;">Post Type & Reg. Post No<br/><span style="font-size: 8pt; font-weight: normal; color: #475569;">(தபால் வகை / பதிவு எண்)</span></th>
              <th style="width: 115px;">Inward No<br/><span style="font-size: 8pt; font-weight: normal; color: #475569;">(கடித இலக்கம்)</span></th>
              <th style="width: 145px;">From Whom<br/><span style="font-size: 8pt; font-weight: normal; color: #475569;">(அனுப்புனர்)</span></th>
              <th style="width: 215px;">Subject<br/><span style="font-size: 8pt; font-weight: normal; color: #475569;">(விடயம்)</span></th>
              <th style="width: 180px;">Forwarded Divisions & Officers<br/><span style="font-size: 8pt; font-weight: normal; color: #475569;">(பிரிவுகள் & உத்தியோகத்தர்கள்)</span></th>
              <th style="width: 65px; text-align: center;">Sign<br/><span style="font-size: 8pt; font-weight: normal; color: #475569;">(ஒப்பம்)</span></th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="sign-area">
          <div class="sign-box">
            Prepared By (Mail Officer)
          </div>
          <div class="sign-box">
            Subject Officer / Section Head
          </div>
          <div class="sign-box">
            Divisional Secretary / Assistant DS
          </div>
        </div>

        <div class="footer">
          <span>Koralaipattu North Vaharai DS Office &copy; ${new Date().getFullYear()}</span>
          <span>Official Register Log (A4 Landscape - Font 10pt)</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * WhatsApp share generator
 */
export const shareViaWhatsApp = (letter: Letter, usersMap: Map<string, User>) => {
  const forwardedNames = (letter.forwardedTo || [])
    .map((uid) => usersMap.get(uid)?.Name || uid)
    .join(', ');

  const text = `📬 *DS Office Mail Record*
*Original No:* ${letter.originalNo}
*Date:* ${letter.date}
*Dispatched Date:* ${letter.dispatchedDate || letter.date}
*Post Type:* ${letter.letterType} (${letter.registeredPostNo || '-'})
*Inward No:* ${letter.inwardNo}
*From Whom:* ${letter.fromWhom}
*Subject:* ${letter.subject}
*Division:* ${letter.division || 'General'}
*Forwarded To:* ${forwardedNames || 'N/A'}
*Status:* ${letter.action}
${letter.fileNo ? `*Filed File No:* ${letter.fileNo}\n` : ''}${letter.replyResponse ? `*Reply:* ${letter.replyResponse}` : ''}
--
_Koralaipattu North Vaharai DS Office_`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};

/**
 * Email share generator
 */
export const shareViaEmail = (letter: Letter, usersMap: Map<string, User>) => {
  const forwardedNames = (letter.forwardedTo || [])
    .map((uid) => usersMap.get(uid)?.Name || uid)
    .join(', ');

  const subject = encodeURIComponent(`DS Office Mail: ${letter.originalNo} - ${letter.subject}`);
  const body = encodeURIComponent(`Dear Officer,

Please review the postal mail details below:

Original No: ${letter.originalNo}
Date Registered: ${letter.date}
Dispatched Date: ${letter.dispatchedDate || letter.date}
Post Type: ${letter.letterType}
Registered Post No: ${letter.registeredPostNo || '-'}
Inward No: ${letter.inwardNo}
From Whom: ${letter.fromWhom}
Subject: ${letter.subject}
Primary Division: ${letter.division || 'General'}
Forwarded To: ${forwardedNames || 'N/A'}
Status: ${letter.action}
Reply/Action Note: ${letter.replyResponse || 'Pending'}

Regards,
Mail Management System
Koralaipattu North Vaharai DS Office`);

  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

/**
 * Download attached photo or document
 */
export const downloadLetterAttachment = (dataUrl: string, fileName: string) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/**
 * Backup full database to JSON
 */
export const downloadDataBackupJson = (letters: Letter[], users: User[]) => {
  const data = {
    exportDate: new Date().toISOString(),
    system: 'Koralaipattu North Vaharai DS Office Mail System',
    users,
    letters,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vaharai_DS_Mail_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
