export interface ScannedLetterData {
  dispatchedDate?: string;
  originalNo?: string;
  inwardNo?: string;
  letterNo?: string;
  fromWhom?: string;
  subject?: string;
  registeredPostNo?: string;
  postType?: string;
  suggestedDivision?: string;
  summary?: string;
}

export interface FormattedScanErrorDetail {
  type: 'billing_required' | 'api_key_invalid' | 'quota_exhausted' | 'server_busy' | 'generic';
  title: string;
  message: string;
  instructionTamil: string;
  instructionEnglish: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface ScanResult {
  success: boolean;
  data?: ScannedLetterData;
  error?: string;
  apiKeyMissing?: boolean;
  errorType?: string;
  errorDetail?: FormattedScanErrorDetail;
}

/**
 * Sanitizes and parses any raw error strings (such as JSON error blobs) into clear, actionable advice.
 */
export function sanitizeScanError(rawInput?: any): FormattedScanErrorDetail {
  let str = '';
  if (typeof rawInput === 'string') {
    str = rawInput;
  } else if (rawInput?.message) {
    str = String(rawInput.message);
  } else if (rawInput?.error) {
    str = typeof rawInput.error === 'string' ? rawInput.error : JSON.stringify(rawInput.error);
  }

  // Attempt to parse nested JSON error responses (e.g. from Google API)
  try {
    const trimmed = str.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed?.error?.message) {
        str = parsed.error.message;
      }
    }
  } catch {}

  const lower = str.toLowerCase();

  if (
    lower.includes('free tier is not available for this project') ||
    lower.includes('upgrade to the paid tier') ||
    lower.includes('aistudio.google.com/billing') ||
    lower.includes('project-unavailable')
  ) {
    return {
      type: 'billing_required',
      title: 'Gemini API Billing Upgrade Required (403 Permission Denied)',
      message: 'இந்த Google Cloud திட்டத்திற்கு Gemini API Free Tier அனுமதி இல்லை. கட்டண முறை (Billing) அல்லது புதிய Free Tier API Key தேவை.',
      instructionTamil: '1. இலவசமாக பயன்படுத்த: aistudio.google.com/app/apikey இல் புதிய தனிப்பட்ட Google (Gmail) கணக்கின் மூலம் API Key உருவாக்கி Netlify Environment Variables இல் சேர்க்கவும்.\n2. அல்லது aistudio.google.com/billing இல் இந்த திட்டத்திற்கான Billing ஐ இணைக்கவும்.\nகுறிப்பு: கடிதப் புகைப்படம் பாதுகாப்பாக உள்ளது! விவரங்களை நீங்களே நேரடியாகப் பூர்த்தி செய்து பதிவு செய்யலாம்.',
      instructionEnglish: 'The Gemini API free tier is not available for this project. To use AI Auto-Fill, either generate an API key from a personal Google account with Free Tier active at aistudio.google.com/app/apikey and add to Netlify env vars, or upgrade this project to paid tier at aistudio.google.com/billing.',
      actionUrl: 'https://aistudio.google.com/billing',
      actionLabel: 'Upgrade Billing',
    };
  }

  if (
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('unregistered callers')
  ) {
    return {
      type: 'api_key_invalid',
      title: 'Gemini API Key Authentication Failed',
      message: 'AI சேவையக API Key அங்கீகாரம் கிடைக்கவில்லை (Invalid or Expired Key).',
      instructionTamil: 'Google AI Studio (aistudio.google.com/app/apikey) இல் புதிய API Key ஒன்றை உருவாக்கி உங்கள் தளத்தின் (Netlify / Server) Environment Variables இல் GEMINI_API_KEY ஆக உள்ளிடவும்.',
      instructionEnglish: 'The Gemini API key is missing, invalid, or unauthorized. Please verify GEMINI_API_KEY in your hosting environment variables.',
      actionUrl: 'https://aistudio.google.com/app/apikey',
      actionLabel: 'Get API Key',
    };
  }

  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      type: 'quota_exhausted',
      title: 'Gemini API Quota Exceeded',
      message: 'AI சேவையக பயன்பாட்டு வரம்பு நிறைவடைந்துள்ளது (Rate limit / Quota reached).',
      instructionTamil: 'சிறிது நேரம் கழித்து மீண்டும் முயற்சி செய்யவும் அல்லது பயன்பாட்டு வரம்பை அதிகரிக்கவும்.',
      instructionEnglish: 'API quota exceeded. Please wait a moment before retrying.',
      actionUrl: 'https://aistudio.google.com/billing',
      actionLabel: 'Check Quota',
    };
  }

  return {
    type: 'generic',
    title: 'AI Scan Notice',
    message: str || 'கடிதப் புகைப்படம் இணைக்கப்பட்டுள்ளது. தகவல்களை நேரடியாக உள்ளிட்டு சேமிக்கலாம்.',
    instructionTamil: 'படிவத்தில் தகவல்களை நேரடியாக பூர்த்தி செய்து Save & Register Mail மூலம் சேமிக்கவும்.',
    instructionEnglish: 'Letter photo is securely attached. You can manually fill the fields and save.',
  };
}

/**
 * Sends letter image to backend Gemini OCR scanner with automatic fallback
 */
export async function scanLetterWithAI(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<ScanResult> {
  const payload = JSON.stringify({ imageBase64, mimeType });
  const headers = { 'Content-Type': 'application/json' };

  // Try standard Express route /api/scan-letter, then Netlify functions route if 404
  const endpoints = ['/api/scan-letter', '/.netlify/functions/scan-letter'];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: payload,
      });

      if (response.status === 404) {
        // Try next candidate endpoint (e.g. Netlify serverless)
        continue;
      }

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok || !resJson.success) {
        const detail = resJson.errorDetail || sanitizeScanError(resJson.error || resJson.message);
        return {
          success: false,
          apiKeyMissing: Boolean(resJson.apiKeyMissing || detail.type === 'billing_required' || detail.type === 'api_key_invalid'),
          errorType: resJson.errorType || detail.type,
          error: detail.message,
          errorDetail: detail,
        };
      }

      return {
        success: true,
        data: resJson.data,
      };
    } catch {
      // Try next endpoint on network issue
    }
  }

  const fallbackDetail = sanitizeScanError('கடிதப் புகைப்படம் இணைக்கப்பட்டுள்ளது. தகவல்களை நேரடியாக உள்ளிட்டு சேமிக்கலாம்.');
  return {
    success: false,
    error: fallbackDetail.message,
    errorDetail: fallbackDetail,
  };
}
