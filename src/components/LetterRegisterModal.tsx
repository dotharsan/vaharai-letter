import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  Check,
  Building2,
  FileText,
  AlertCircle,
  Sparkles,
  Calendar,
  Send,
  Upload,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  Zap,
  CreditCard,
  Key,
  ExternalLink,
} from 'lucide-react';
import { Letter, LetterAction, User } from '../types';
import { DIVISIONS, POST_TYPES, migrateDivision } from '../data/initialData';
import {
  generateOriginalNo,
  compressImageToTarget,
  ensureStringArray,
  normalizeAction,
  normalizeRegisteredPostNo,
  classifySubjectCategory,
  SUBJECT_CATEGORIES_CONFIG,
} from '../utils/helpers';
import { scanLetterWithAI, FormattedScanErrorDetail } from '../utils/aiScanner';
import { ForwardSelect } from './ForwardUserSelect';
import { CameraCaptureModal } from './CameraCaptureModal';

interface LetterRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newLetter: Letter) => void;
  currentUser: User;
  allUsers: User[];
  existingLetters: Letter[];
}

const ACTION_OPTIONS: LetterAction[] = [
  'Not Yet Viewed',
  'Action Taken',
  'Action Not Taken',
  'Under Investigation',
];

export const LetterRegisterModal: React.FC<LetterRegisterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentUser,
  allUsers,
  existingLetters,
}) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dispatchedDate, setDispatchedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [originalNo, setOriginalNo] = useState<string>('');
  const [letterType, setLetterType] = useState<string>('Registered Post');
  const [registeredPostNo, setRegisteredPostNo] = useState<string>('No');
  const [inwardNo, setInwardNo] = useState<string>('');
  const [fromWhom, setFromWhom] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [primaryDivision, setPrimaryDivision] = useState<string>('');
  const [forwardedDivisions, setForwardedDivisions] = useState<string[]>([]);
  const [forwardedTo, setForwardedTo] = useState<string[]>([]);
  const [action, setAction] = useState<LetterAction>('Not Yet Viewed');
  const [fileNo, setFileNo] = useState<string>('');
  const [replyResponse, setReplyResponse] = useState<string>('');
  const [initialNote, setInitialNote] = useState<string>('');

  const [image, setImage] = useState<string | undefined>(undefined);
  const [imageSizeKb, setImageSizeKb] = useState<number | undefined>(undefined);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI OCR Scanning States
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);
  const [scanErrorDetail, setScanErrorDetail] = useState<FormattedScanErrorDetail | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);
  const [preservedUserFields, setPreservedUserFields] = useState<string[]>([]);
  const [aiExtractedData, setAiExtractedData] = useState<any>(null);
  
  // Track fields manually edited by the letter registrar to NEVER overwrite their changes
  const [userEditedFields, setUserEditedFields] = useState<Set<string>>(new Set());
  const userEditedFieldsRef = useRef<Set<string>>(new Set());
  const scanIdRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const markFieldEdited = (fieldName: string) => {
    userEditedFieldsRef.current.add(fieldName);
    setUserEditedFields((prev) => new Set(prev).add(fieldName));
    setAutoFilledFields((prev) =>
      prev.filter((f) => !f.toLowerCase().includes(fieldName.toLowerCase()))
    );
  };

  // AI Document Scanning & Auto-Fill Handler
  const triggerScan = async (dataUrl: string) => {
    scanIdRef.current += 1;
    const thisScanId = scanIdRef.current;

    setIsScanning(true);
    setScanSuccessMsg(null);
    setScanErrorMsg(null);
    setScanErrorDetail(null);
    setPreservedUserFields([]);

    try {
      const res = await scanLetterWithAI(dataUrl);
      if (thisScanId !== scanIdRef.current) return; // Discard superseded scan

      if (!res.success || !res.data) {
        setScanErrorDetail(res.errorDetail || null);
        setScanErrorMsg(
          res.error ||
            res.errorDetail?.message ||
            'கடிதப் புகைப்படம் இணைக்கப்பட்டுள்ளது. படிவத்தில் விவரங்களை நேரடியாக உள்ளிட்டு சேமிக்கலாம்.'
        );
        return;
      }

      const { data: d } = res;
      setAiExtractedData(d);
      const filled: string[] = [];
      const preserved: string[] = [];
      const userEdited = userEditedFieldsRef.current;

      // 1. Dispatched Date (கடிதம் அனுப்பப்பட்ட திகதி)
      let cleanDate = d.dispatchedDate ? d.dispatchedDate.trim().replace(/[./]/g, '-') : '';
      const dateParts = cleanDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (dateParts) {
        cleanDate = `${dateParts[1]}-${dateParts[2].padStart(2, '0')}-${dateParts[3].padStart(2, '0')}`;
      } else if (d.dispatchedDate) {
        const dmyParts = d.dispatchedDate.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
        if (dmyParts) {
          cleanDate = `${dmyParts[3]}-${dmyParts[2].padStart(2, '0')}-${dmyParts[1].padStart(2, '0')}`;
        }
      }
      if (cleanDate) {
        if (!userEdited.has('dispatchedDate')) {
          setDispatchedDate(cleanDate);
          filled.push('Dispatched Date (அனுப்பிய திகதி)');
        } else {
          preserved.push('Dispatched Date');
        }
      }

      // 2. Inward No (கடிதத்தில் உள்ள கடித இலக்கம் / Letter No)
      const scannedLetterNumber = (d.inwardNo || d.originalNo || (d as any).letterNo || '').trim();
      if (scannedLetterNumber) {
        if (!userEdited.has('inwardNo')) {
          setInwardNo(scannedLetterNumber);
          filled.push('Inward No (கடித இலக்கம்)');
        } else {
          preserved.push('Inward No');
        }
      }

      // 3. Sender / From Whom (அனுப்புனர்)
      if (d.fromWhom && d.fromWhom.trim()) {
        if (!userEdited.has('fromWhom')) {
          setFromWhom(d.fromWhom.trim());
          filled.push('From Whom (அனுப்புனர்)');
        } else {
          preserved.push('From Whom');
        }
      }

      // 4. Subject (விடயம் / தலைப்பு)
      if (d.subject && d.subject.trim()) {
        if (!userEdited.has('subject')) {
          setSubject(d.subject.trim());
          filled.push('Subject (விடயம்)');
        } else {
          preserved.push('Subject');
        }
      }

      // 5. Registered Post Number (பதிவுத் தபால் எண்) - போஸ்டர் நம்பர் இல்லாவிட்டால் தானாக "No"
      if (d.registeredPostNo && d.registeredPostNo.trim() && d.registeredPostNo.trim().toLowerCase() !== 'no') {
        if (!userEdited.has('registeredPostNo')) {
          setRegisteredPostNo(d.registeredPostNo.trim());
          setLetterType('Registered Post');
          filled.push('Reg. Post No (பதிவுத் தபால் எண்)');
        } else {
          preserved.push('Reg. Post No');
        }
      } else {
        if (!userEdited.has('registeredPostNo')) {
          setRegisteredPostNo('No');
        }
        if (d.postType && (POST_TYPES as readonly string[]).includes(d.postType)) {
          if (!userEdited.has('letterType')) {
            setLetterType(d.postType);
          }
        }
      }

      // 6. Suggested Division Matching (Only the matched division receives it)
      if (d.suggestedDivision) {
        const match = migrateDivision(d.suggestedDivision);
        if (match) {
          if (!userEdited.has('primaryDivision')) {
            setPrimaryDivision(match);
            setForwardedDivisions([match]);
            filled.push(`Division: ${match}`);
          } else {
            preserved.push('Division');
          }
        }
      }

      // 7. Summary note if available
      if (d.summary && !initialNote && !userEdited.has('initialNote')) {
        setInitialNote(d.summary);
      }

      setAutoFilledFields(filled);
      setPreservedUserFields(preserved);

      if (filled.length > 0 || preserved.length > 0) {
        let msg = `✓ கடிதப் படம் வெற்றிகரமாக ஸ்கேன் செய்யப்பட்டது!`;
        if (filled.length > 0) msg += ` ${filled.length} விவரங்கள் Auto-Fill செய்யப்பட்டன.`;
        if (preserved.length > 0) msg += ` (பதிவாளர் மாற்றிய ${preserved.length} விவரங்கள் அவ்வாறே பாதுகாக்கப்பட்டன).`;
        setScanSuccessMsg(msg);
      }
    } catch (err: unknown) {
      console.log('AI scan notice (direct manual entry available):', err);
      setScanErrorMsg(null);
    } finally {
      if (thisScanId === scanIdRef.current) {
        setIsScanning(false);
      }
    }
  };

  // Direct file selection handler (compress & auto-scan)
  const handleDirectFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { dataUrl, sizeKb } = await compressImageToTarget(file, 240);
      setImage(dataUrl);
      setImageSizeKb(sizeKb);
      await triggerScan(dataUrl);
    } catch (err) {
      console.error('File load error:', err);
      setErrorMsg('Failed to process image file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Paste handler for quick clipboard images (e.g. from Snipping Tool / document scanner)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const { dataUrl, sizeKb } = await compressImageToTarget(file, 240);
            setImage(dataUrl);
            setImageSizeKb(sizeKb);
            await triggerScan(dataUrl);
          } catch (err) {
            console.error('Paste error:', err);
          }
        }
        break;
      }
    }
  };

  // Auto-generate Original No when date or letters change, but respect manual edits
  useEffect(() => {
    if (isOpen && !userEditedFieldsRef.current.has('originalNo')) {
      const generated = generateOriginalNo(date, existingLetters);
      setOriginalNo(generated);
    }
  }, [date, isOpen, existingLetters]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setDispatchedDate(today);
      setLetterType('Registered Post');
      setRegisteredPostNo('No');
      setInwardNo('');
      setFromWhom('');
      setSubject('');
      setPrimaryDivision('');
      setForwardedDivisions([]);
      setForwardedTo([]);
      setAction('Not Yet Viewed');
      setFileNo('');
      setReplyResponse('');
      setInitialNote('');
      setImage(undefined);
      setImageSizeKb(undefined);
      setErrorMsg(null);
      setIsScanning(false);
      setScanSuccessMsg(null);
      setScanErrorMsg(null);
      setAutoFilledFields([]);
      setPreservedUserFields([]);
      setAiExtractedData(null);
      setUserEditedFields(new Set());
      userEditedFieldsRef.current = new Set();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!originalNo.trim()) {
      setErrorMsg('Please specify an Original No.');
      return;
    }
    if (!inwardNo.trim()) {
      setErrorMsg('Please enter the Inward No (கடித இலக்கம்).');
      return;
    }
    if (!fromWhom.trim()) {
      setErrorMsg('Please enter sender details (From Whom - அனுப்புனர்).');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Please enter the Subject of the mail (விடயம்).');
      return;
    }
    if (!primaryDivision.trim()) {
      setErrorMsg('கடிதத்திற்கான உரிய முதன்மைப் பிரிவைத் தெரிவு செய்க (Please select the Primary Division).');
      return;
    }

    const sanitizedForwardedDivs = Array.from(
      new Set([primaryDivision, ...forwardedDivisions].filter((d) => Boolean(d && d.trim())))
    );

    const newLetterId = `LTR-${Date.now()}`;
    const safeLetterType = (letterType || 'Registered Post').trim() || 'Registered Post';
    const safeRegPostNo = normalizeRegisteredPostNo(registeredPostNo);
    const newLetter: Letter = {
      id: newLetterId,
      originalNo: originalNo.trim(),
      date,
      dispatchedDate,
      letterType: safeLetterType,
      registeredPostNo: safeRegPostNo,
      inwardNo: inwardNo.trim(),
      fromWhom: fromWhom.trim(),
      subject: subject.trim(),
      division: primaryDivision,
      forwardedDivisions: sanitizedForwardedDivs,
      forwardedTo: ensureStringArray(forwardedTo),
      action: normalizeAction(action),
      fileNo: fileNo.trim(),
      replyResponse: replyResponse.trim(),
      image,
      imageSizeKb,
      registeredBy: currentUser.User_ID,
      registeredByName: currentUser.Name,
      createdAt: `${date} ${new Date().toTimeString().slice(0, 5)}`,
      chats: initialNote.trim()
        ? [
            {
              id: `msg-${Date.now()}`,
              letterId: newLetterId,
              senderId: currentUser.User_ID,
              senderName: currentUser.Name,
              senderRole: currentUser.Role,
              message: initialNote.trim(),
              timestamp: `${date} ${new Date().toTimeString().slice(0, 5)}`,
            },
          ]
        : [],
    };

    onSave(newLetter);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
        <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-200 bg-slate-900 px-6 py-4 text-white rounded-t-2xl">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>✉️ Register New Inward Mail</span>
                <span className="rounded bg-blue-700 px-2 py-0.5 text-xs font-mono">
                  Mail Officer
                </span>
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                Koralaipattu North Vaharai DS Office • Mail Registration System
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            onPaste={handlePaste}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* TOP SECTION: Letter Photo Capture & Instant AI Auto-Scan */}
            <div className="rounded-2xl border-2 border-indigo-200 bg-linear-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-indigo-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      கடிதப் புகைப்படம் & AI தானியங்கி ஸ்கேன் (Letter Photo & Auto-Fill)
                    </h3>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 border border-indigo-200">
                      ⚡ AI Auto-Fill
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    கடிதத்தின் புகைப்படத்தைப் பிடித்தால் கடிதம் அனுப்பப்பட்ட திகதி, கடித எண், அனுப்புனர், விடயம் என்பன <strong>தானாகப் பில்டராகி Auto-Fill</strong> ஆகும்.
                  </p>
                </div>

                {/* Primary Action Buttons: Open Camera & Upload File */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    disabled={isScanning}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition active:scale-95 disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" />
                    கேமராவைத் திறக்கவும் (Open Camera)
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3.5 py-2 text-xs font-bold text-indigo-900 shadow-xs hover:bg-indigo-50 transition active:scale-95 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4 text-indigo-700" />
                    கோப்பைப் பதிவேற்றவும் (Upload Photo)
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleDirectFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Scanning in progress animation */}
              {isScanning && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-indigo-300 bg-white p-3 shadow-inner">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <span>AI கடிதத்தை வாசிக்கிறது (Scanning letter)...</span>
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    </p>
                    <p className="text-[11px] text-indigo-700">
                      கடிதம் அனுப்பப்பட்ட திகதி, கடித எண், அனுப்புனர், விடயம் தானாக எடுக்கப்படுகின்றன...
                    </p>
                  </div>
                </div>
              )}

              {/* Scan Success Banner */}
              {scanSuccessMsg && !isScanning && (
                <div className="mt-3 flex items-start justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">{scanSuccessMsg}</span>
                      {autoFilledFields.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {autoFilledFields.map((f, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200"
                            >
                              ✓ {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanSuccessMsg(null)}
                    className="text-emerald-700 hover:text-emerald-950 p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Scan Error Banner */}
              {scanErrorMsg && !isScanning && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/95 p-3 text-amber-950 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="rounded-lg bg-amber-200/80 p-2 text-amber-800 shrink-0 mt-0.5">
                        {scanErrorDetail?.type === 'billing_required' ? (
                          <CreditCard className="h-5 w-5" />
                        ) : scanErrorDetail?.type === 'api_key_invalid' ? (
                          <Key className="h-5 w-5" />
                        ) : (
                          <AlertCircle className="h-5 w-5" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded">
                            {scanErrorDetail?.type === 'billing_required'
                              ? 'Gemini API • Billing Upgrade Required'
                              : scanErrorDetail?.type === 'api_key_invalid'
                              ? 'Gemini API • Key Setup Required'
                              : 'AI Scan Notice'}
                          </span>
                          {scanErrorDetail?.type === 'billing_required' && (
                            <span className="text-[11px] text-amber-700 font-mono">403 PERMISSION_DENIED</span>
                          )}
                        </div>

                        <p className="text-xs font-semibold text-amber-900 leading-snug">
                          {scanErrorDetail?.message || scanErrorMsg}
                        </p>

                        {scanErrorDetail?.type === 'billing_required' && (
                          <div className="mt-2 space-y-1.5 text-[11px] text-amber-900 bg-amber-100/70 p-2.5 rounded-lg border border-amber-200">
                            <div className="flex items-start gap-1.5">
                              <span className="font-bold text-amber-800">1.</span>
                              <span>
                                <strong>இலவசமாக பயன்படுத்த (Free Tier):</strong> தனிப்பட்ட Google கணக்கு மூலம்{' '}
                                <a
                                  href="https://aistudio.google.com/app/apikey"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-0.5"
                                >
                                  Google AI Studio <ExternalLink className="h-2.5 w-2.5" />
                                </a>{' '}
                                தளத்தில் புதிய API Key உருவாக்கி, Netlify Dashboard (<em>Site configuration &gt; Environment variables &gt; GEMINI_API_KEY</em>) இல் உள்ளிடவும்.
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="font-bold text-amber-800">2.</span>
                              <span>
                                <strong>அல்லது Billing ஐ இணைக்க:</strong>{' '}
                                <a
                                  href="https://aistudio.google.com/billing"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-0.5"
                                >
                                  aistudio.google.com/billing <ExternalLink className="h-2.5 w-2.5" />
                                </a>{' '}
                                தளத்தில் சென்று இந்த திட்டத்திற்கான Billing ஐ இணைக்கவும்.
                              </span>
                            </div>
                          </div>
                        )}

                        <p className="text-[11px] text-emerald-800 font-medium flex items-center gap-1.5 pt-0.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>கடிதப் புகைப்படம் பாதுகாப்பாக இணைக்கப்பட்டுள்ளது. படிவத்தில் உள்ள விவரங்களை நீங்களே நேரடியாக உள்ளிட்டு சேமிக்கலாம்.</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setScanErrorMsg(null);
                        setScanErrorDetail(null);
                      }}
                      className="text-amber-700 hover:text-amber-950 p-1 rounded-md hover:bg-amber-100 transition shrink-0"
                      title="Dismiss notice"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-amber-200/80 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100/50 shadow-2xs transition"
                      >
                        <Key className="h-3 w-3 text-amber-700" />
                        <span>Get Free API Key</span>
                        <ExternalLink className="h-2.5 w-2.5 text-amber-600" />
                      </a>
                      <a
                        href="https://aistudio.google.com/billing"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100/50 shadow-2xs transition"
                      >
                        <CreditCard className="h-3 w-3 text-amber-700" />
                        <span>Upgrade Billing</span>
                        <ExternalLink className="h-2.5 w-2.5 text-amber-600" />
                      </a>
                    </div>

                    {image && (
                      <button
                        type="button"
                        onClick={() => triggerScan(image)}
                        disabled={isScanning}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 transition shadow-2xs"
                      >
                        <RefreshCw className={`h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} />
                        <span>மீண்டும் முயற்சி (Retry)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Photo Preview and Quick Actions */}
              {image ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
                  <img
                    src={image}
                    alt="Letter attachment"
                    className="h-16 w-20 rounded-lg object-cover border border-slate-300 shadow-2xs"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">
                        ✓ கடிதப் புகைப்படம் இணைக்கப்பட்டுள்ளது
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                        ~{imageSizeKb || 240} KB
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      படிவத்தைச் சரிபார்த்து தேவைப்படின் மாற்றங்களைச் செய்யலாம்.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => triggerScan(image)}
                      disabled={isScanning}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                      title="Re-run AI auto scan"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      <span>மீண்டும் ஸ்கேன்</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setImage(undefined);
                        setImageSizeKb(undefined);
                        setScanSuccessMsg(null);
                        setAutoFilledFields([]);
                      }}
                      disabled={isScanning}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition"
                      title="Remove photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-white/70 py-3 px-4 text-xs text-slate-500 hover:border-indigo-400 hover:bg-white transition"
                >
                  <Camera className="h-4 w-4 text-indigo-500" />
                  <span>
                    புகைப்படம் எடுக்க <strong>கேமராவைத் திறக்கவும்</strong> அல்லது கோப்பை <strong>இங்கு பதிவேற்றவும்</strong> (Ctrl+V மூலம் Paste செய்யலாம்)
                  </span>
                </div>
              )}
            </div>

            {/* Row 1: Original No (System Generated KPN Number) & Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Original No (கணினி இலக்கம் - KPN) *</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-blue-800">
                    தனித்துவ இலக்கம்
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={originalNo}
                  onChange={(e) => {
                    markFieldEdited('originalNo');
                    setOriginalNo(e.target.value);
                  }}
                  placeholder="KPN/DS/YYYY/MM/NNN"
                  className="w-full rounded-lg border border-blue-300 bg-blue-50/60 px-3 py-2 text-xs font-mono font-bold text-blue-950 focus:border-blue-600 focus:bg-white focus:outline-hidden shadow-2xs"
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  குறித்த திகதியை அடிப்படையாக கொண்டு KPN என சிஸ்டம் வடிவமைக்கும் தனித்துவ இலக்கம்
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  Registered Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    markFieldEdited('date');
                    setDate(e.target.value);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Dispatched Date (அனுப்பிய திகதி) *</span>
                  {autoFilledFields.includes('Dispatched Date (அனுப்பிய திகதி)') && !userEditedFields.has('dispatchedDate') && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      ✨ AI Extracted
                    </span>
                  )}
                  {userEditedFields.has('dispatchedDate') && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                      ✏️ பதிவாளர் மாற்றம்
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  required
                  value={dispatchedDate}
                  onChange={(e) => {
                    markFieldEdited('dispatchedDate');
                    setDispatchedDate(e.target.value);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-xs text-gray-900 focus:outline-hidden ${
                    autoFilledFields.includes('Dispatched Date (அனுப்பிய திகதி)') && !userEditedFields.has('dispatchedDate')
                      ? 'border-emerald-400 bg-emerald-50/40 focus:border-emerald-600'
                      : userEditedFields.has('dispatchedDate')
                      ? 'border-blue-400 bg-blue-50/20 focus:border-blue-600 font-medium'
                      : 'border-gray-300 bg-white focus:border-blue-600'
                  }`}
                />
              </div>
            </div>

            {/* Row 2: Post Type, Reg Post No, Inward No (Letter Reference No) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  Post Type *
                </label>
                <select
                  value={letterType}
                  onChange={(e) => {
                    markFieldEdited('letterType');
                    setLetterType(e.target.value);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:border-blue-600 focus:outline-hidden"
                >
                  {POST_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Reg. Post No (பதிவுத் தபால்)</span>
                  {autoFilledFields.includes('Reg. Post No (பதிவுத் தபால் எண்)') && !userEditedFields.has('registeredPostNo') && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      ✨ AI Extracted
                    </span>
                  )}
                  {userEditedFields.has('registeredPostNo') && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                      ✏️ பதிவாளர் மாற்றம்
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={registeredPostNo}
                  onFocus={(e) => {
                    if (registeredPostNo.trim().toLowerCase() === 'no') {
                      e.target.select();
                    }
                  }}
                  onBlur={() => {
                    if (!registeredPostNo.trim()) {
                      setRegisteredPostNo('No');
                    }
                  }}
                  onChange={(e) => {
                    markFieldEdited('registeredPostNo');
                    setRegisteredPostNo(e.target.value);
                  }}
                  placeholder="No (அல்லது RP-884920-LK)"
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-mono text-gray-900 focus:outline-hidden ${
                    autoFilledFields.includes('Reg. Post No (பதிவுத் தபால் எண்)') && !userEditedFields.has('registeredPostNo')
                      ? 'border-emerald-400 bg-emerald-50/40 focus:border-emerald-600'
                      : 'border-gray-300 bg-white focus:border-blue-600'
                  }`}
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  போஸ்டர் நம்பர் இல்லாவிட்டால் தானாக <b>&quot;No&quot;</b> என சீட்டில் பதியப்படும்
                </p>
              </div>

              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Inward No (கடித இலக்கம் - Letter No) *</span>
                  {autoFilledFields.includes('Inward No (கடித இலக்கம்)') && !userEditedFields.has('inwardNo') && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      ✨ AI Extracted
                    </span>
                  )}
                  {userEditedFields.has('inwardNo') && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                      ✏️ பதிவாளர் மாற்றம்
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={inwardNo}
                  onChange={(e) => {
                    markFieldEdited('inwardNo');
                    setInwardNo(e.target.value);
                  }}
                  placeholder="கடிதத்தில் உள்ள கடித இலக்கம் (Letter Ref No)"
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-bold focus:outline-hidden ${
                    autoFilledFields.includes('Inward No (கடித இலக்கம்)') && !userEditedFields.has('inwardNo')
                      ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950 focus:border-emerald-600'
                      : userEditedFields.has('inwardNo')
                      ? 'border-blue-400 bg-blue-50/20 text-blue-950 focus:border-blue-600'
                      : 'border-gray-300 bg-white text-gray-900 focus:border-blue-600'
                  }`}
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  கடிதத்தில் உள்ள கடித இலக்கம் (Letter No / Reference No)
                </p>
                {aiExtractedData?.inwardNo && userEditedFields.has('inwardNo') && inwardNo !== aiExtractedData.inwardNo && (
                  <button
                    type="button"
                    onClick={() => {
                      setInwardNo(aiExtractedData.inwardNo);
                      setAutoFilledFields((prev) => [...prev, 'Inward No (கடித இலக்கம்)']);
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:underline"
                  >
                    <span>⚡ AI கண்டறிந்த இலக்கம்: &quot;{aiExtractedData.inwardNo}&quot; (இதைப் பொருத்து)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Row 3: From Whom */}
            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-bold text-gray-700">
                <span>From Whom (அனுப்புனர் / Department / Citizen) *</span>
                {autoFilledFields.includes('From Whom (அனுப்புனர்)') && !userEditedFields.has('fromWhom') && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    ✨ AI Extracted
                  </span>
                )}
                {userEditedFields.has('fromWhom') && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                    ✏️ பதிவாளர் மாற்றம்
                  </span>
                )}
              </label>
              <input
                type="text"
                required
                value={fromWhom}
                onChange={(e) => {
                  markFieldEdited('fromWhom');
                  setFromWhom(e.target.value);
                }}
                placeholder="e.g. District Secretariat, Batticaloa / Land Commissioner Department"
                className={`w-full rounded-lg border px-3 py-2 text-xs text-gray-900 focus:outline-hidden ${
                  autoFilledFields.includes('From Whom (அனுப்புனர்)') && !userEditedFields.has('fromWhom')
                    ? 'border-emerald-400 bg-emerald-50/40 focus:border-emerald-600'
                    : userEditedFields.has('fromWhom')
                    ? 'border-blue-400 bg-blue-50/20 focus:border-blue-600 font-medium'
                    : 'border-gray-300 bg-white focus:border-blue-600'
                }`}
              />
            </div>

            {/* Row 4: Subject */}
            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-bold text-gray-700">
                <span>Subject (விடயம் / தலைப்பு) *</span>
                {autoFilledFields.includes('Subject (விடயம்)') && !userEditedFields.has('subject') && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    ✨ AI Extracted
                  </span>
                )}
                {userEditedFields.has('subject') && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                    ✏️ பதிவாளர் மாற்றம்
                  </span>
                )}
              </label>
              <textarea
                required
                rows={2}
                value={subject}
                onChange={(e) => {
                  markFieldEdited('subject');
                  setSubject(e.target.value);
                }}
                placeholder="Brief summary and context of the incoming mail..."
                className={`w-full rounded-lg border px-3 py-2 text-xs text-gray-900 focus:outline-hidden ${
                  autoFilledFields.includes('Subject (விடயம்)') && !userEditedFields.has('subject')
                    ? 'border-emerald-400 bg-emerald-50/40 focus:border-emerald-600'
                    : userEditedFields.has('subject')
                    ? 'border-blue-400 bg-blue-50/20 focus:border-blue-600 font-medium'
                    : 'border-gray-300 bg-white focus:border-blue-600'
                }`}
              />

              {/* Live Subject Classification Badge & Quick Category Prefixes */}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 font-medium">Dashboard Category:</span>
                  {(() => {
                    const cat = classifySubjectCategory(subject);
                    const cfg = SUBJECT_CATEGORIES_CONFIG.find((c) => c.key === cat);
                    if (!cfg) return null;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold border ${cfg.badgeBg} ${cfg.badgeColor} ${cfg.badgeBorder}`}
                      >
                        {cfg.englishLabel} ({cfg.tamilLabel})
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span>Quick Prefixes:</span>
                  <button
                    type="button"
                    onClick={() => {
                      markFieldEdited('subject');
                      setSubject((prev) => (prev.startsWith('கோரிக்கை: ') ? prev : `கோரிக்கை: ${prev}`));
                    }}
                    className="rounded bg-blue-50 hover:bg-blue-100 text-blue-700 px-1.5 py-0.5 border border-blue-200"
                  >
                    + கோரிக்கை (Request)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markFieldEdited('subject');
                      setSubject((prev) => (prev.startsWith('முறைப்பாடு: ') ? prev : `முறைப்பாடு: ${prev}`));
                    }}
                    className="rounded bg-rose-50 hover:bg-rose-100 text-rose-700 px-1.5 py-0.5 border border-rose-200"
                  >
                    + முறைப்பாடு (Complaint)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markFieldEdited('subject');
                      setSubject((prev) => (prev.startsWith('அழைப்பிதழ்: ') ? prev : `அழைப்பிதழ்: ${prev}`));
                    }}
                    className="rounded bg-purple-50 hover:bg-purple-100 text-purple-700 px-1.5 py-0.5 border border-purple-200"
                  >
                    + அழைப்பு (Invite)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markFieldEdited('subject');
                      setSubject((prev) => (prev.startsWith('மீள் ஞாபகமூட்டல்: ') ? prev : `மீள் ஞாபகமூட்டல்: ${prev}`));
                    }}
                    className="rounded bg-amber-50 hover:bg-amber-100 text-amber-700 px-1.5 py-0.5 border border-amber-200"
                  >
                    + நினைவூட்டல் (Reminder)
                  </button>
                </div>
              </div>
            </div>

            {/* Row 5: Primary Division */}
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                Primary Division / Department (முதன்மைப் பிரிவு) *
              </label>
              <select
                required
                value={primaryDivision}
                onChange={(e) => {
                  markFieldEdited('primaryDivision');
                  const newDiv = e.target.value;
                  const prevDiv = primaryDivision;
                  setPrimaryDivision(newDiv);
                  if (newDiv) {
                    setForwardedDivisions((prev) => {
                      const filtered = prev.filter((d) => d !== prevDiv);
                      return Array.from(new Set([...filtered, newDiv]));
                    });
                  }
                }}
                className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold focus:border-blue-600 focus:outline-hidden ${
                  !primaryDivision
                    ? 'border-amber-400 bg-amber-50/50 text-gray-600'
                    : 'border-gray-300 bg-white text-gray-900'
                }`}
              >
                <option value="" disabled>
                  -- உரிய முதன்மைப் பிரிவைத் தெரிவு செய்க (Select Primary Division) --
                </option>
                {DIVISIONS.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 6: Forwarding Selection (Divisions & Officers) */}
            <div>
              <ForwardSelect
                allUsers={allUsers}
                allDivisions={DIVISIONS}
                selectedUserIds={forwardedTo}
                selectedDivisions={forwardedDivisions}
                onChangeUsers={setForwardedTo}
                onChangeDivisions={setForwardedDivisions}
                label="Forward To (Recipients - Officers & Associated Divisions)"
                showDivisionSelect={true}
              />
            </div>

            {/* Row 7: Action Status, Filed File No & Reply Note */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  Initial Action Status
                </label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value as LetterAction)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:border-blue-600 focus:outline-hidden"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  Filed File No (பைல் இலக்கம்)
                </label>
                <input
                  type="text"
                  value={fileNo}
                  onChange={(e) => setFileNo(e.target.value)}
                  placeholder="e.g. KN/DS/ADM/2026/04 (Optional)"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono font-semibold text-emerald-900 focus:border-blue-600 focus:outline-hidden placeholder:font-normal"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  Action / Reply Note
                </label>
                <input
                  type="text"
                  value={replyResponse}
                  onChange={(e) => setReplyResponse(e.target.value)}
                  placeholder="e.g. Forwarded for verification / immediate action"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Row 8: Initial Chat Note */}
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                Initial Log Note / Remarks
              </label>
              <input
                type="text"
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
                placeholder="Remarks by Mail Officer upon receipt..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-blue-600 focus:outline-hidden"
              />
            </div>
          </form>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-900 transition"
            >
              <Check className="h-4 w-4" />
              <span>Save & Register Mail</span>
            </button>
          </div>
        </div>
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl, sizeKb) => {
          setImage(dataUrl);
          setImageSizeKb(sizeKb);
          triggerScan(dataUrl);
        }}
      />
    </>
  );
};
