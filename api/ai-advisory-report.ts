import type { Request, Response } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import {
  type DivisionStatInput,
  type AdvisoryReportRequestPayload,
  type DivisionAssessment,
  type StrategicDirective,
  type AdvisoryReportResponsePayload,
  buildDeterministicAdvisoryReport,
} from '../src/utils/advisoryReport.ts';

if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
  dotenv.config();
}

export type {
  DivisionStatInput,
  AdvisoryReportRequestPayload,
  DivisionAssessment,
  StrategicDirective,
  AdvisoryReportResponsePayload,
};
export { buildDeterministicAdvisoryReport };

export const ADVISORY_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

export async function generateInstitutionalAdvisoryReport(
  payload: AdvisoryReportRequestPayload
): Promise<AdvisoryReportResponsePayload> {
  const { metrics, apiKey: paramKey } = payload;

  const effectiveKey = (
    paramKey ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_API_KEY ||
    ''
  ).trim();

  // If no API key configured, return high-fidelity statistical report directly
  if (!effectiveKey || effectiveKey === 'MY_GEMINI_API_KEY') {
    return buildDeterministicAdvisoryReport(metrics);
  }

  const ai = new GoogleGenAI({
    apiKey: effectiveKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const promptText = `நீங்கள் இலங்கை அரச சேவையில் பிரதேச செயலகங்களின் (Divisional Secretariat, Koralaipattu North, Vaharai / வாகரை பிரதேச செயலகம்) நிர்வாகம், பொதுமக்களின் கடிதங்கள் மற்றும் அரச சேவை வினைத்திறனை மீளாய்வு செய்யும் சிரேஷ்ட பொது நிர்வாக மேலாண்மை நிபுணர் (Senior Public Administration & Institutional Development Advisor).

கீழே வழங்கப்பட்டுள்ள கடிதங்களின் புள்ளிவிவரங்கள் மற்றும் கள நடவடிக்கைகளை உன்னிப்பாக ஆராய்ந்து, நிறுவனத்தின் ஒட்டுமொத்த வினைத்திறன், பல்வேறு பிரிவுகளின் குறைபாடுகள்/தாமதங்கள் மற்றும் நிறுவனத்தை மேம்படுத்துவதற்கான ஆழமான, பயனுள்ள உத்தியோகபூர்வ அறிக்கையை (Institutional Performance, Bottleneck Analysis & Advisory Report) தமிழில் சமர்ப்பிக்கவும்.

=== உத்தியோகபூர்வ தரவுகள் (Official Mail & Division Statistics) ===
- மொத்த பதிவு செய்யப்பட்ட கடிதங்கள்: ${metrics.totalLetters}
- நடவடிக்கைகள் எடுக்கப்பட்ட கடிதங்கள் (Action Taken): ${metrics.actionTakenCount} (${metrics.totalLetters > 0 ? ((metrics.actionTakenCount / metrics.totalLetters) * 100).toFixed(1) : 0}%)
- நடவடிக்கை எடுக்கப்படாதவை (Action Not Taken): ${metrics.actionNotTakenCount}
- ஆய்வில் உள்ளவை (Under Investigation): ${metrics.underInvestigationCount}
- இன்னும் பார்வையிடப்படாதவை (Not Yet Viewed): ${metrics.notYetViewedCount}
- பகுப்பாய்வு எல்லை (Scope): ${metrics.selectedDivisionFilter || 'அனைத்துப் பிரிவுகளும் (All Divisions)'}
- காலப்பகுதி (Timeframe): ${metrics.timeframe || 'All Time'}

பிரிவு வாரியான புள்ளிவிவரங்கள் (Division Breakdown):
${JSON.stringify(metrics.divisionStats, null, 2)}

முக்கிய கடித விடயங்கள் (Frequent Subjects/Categories):
${JSON.stringify(metrics.topSubjects || [], null, 2)}

நிலுவையில் உள்ள முக்கிய கடிதங்களின் மாதிரிகள் (Sample Pending Letters):
${JSON.stringify(metrics.samplePendingLetters || [], null, 2)}

=== அறிக்கையில் உள்ளடக்கப்பட வேண்டிய விடயங்கள் ===
1. overallHealthScore (0 முதல் 100 வரையிலான நிறுவன வினைத்திறன் மதிப்பெண்) & healthGrade (A+, A, B, C, D)
2. executiveSummaryTamil (பிரதேச செயலாளர் மற்றும் உயர்மட்ட மேலாண்மைக்கான விரிவான தமிழ் நிர்வாக சுருக்கம்) & executiveSummaryEnglish
3. keyStrengthsTamil (நிறுவனத்தின் தற்போதைய சாதகமான அம்சங்கள் மற்றும் சிறந்த நடைமுறைகள்)
4. systemicDeficienciesTamil (அலுவலகத்தில் காணப்படும் பிரதான குறைபாடுகள், கோப்பு தேக்கம், தாமதக் காரணிகள், மக்கள் அலைக்கழிக்கப்படும் அபாயங்கள்)
5. citizenGrievanceTrendsTamil (வாகரை மக்கள் அதிகம் எதிர்நோக்கும் பிரச்சினைகள்: காணி, நலன்புரி கொடுப்பனவுகள், வாழ்வாதாரம், வீதிகள், சான்றிதழ்கள்)
6. divisionAssessments: முக்கிய பிரிவுகள் ஒவ்வொன்றின் நிலை (காணி, நிர்வாகம், சமுர்த்தி, சமூக சேவை, திட்டமிடல், கணக்கு போன்றவை). தாமதங்களுக்கான காரணங்கள் மற்றும் அப்பிரிவுக்கான உடனடி மேம்பாட்டு வழிகாட்டல்கள்.
7. strategicDirectives: உடனடி (0-7 நாட்கள்), நடுத்தர காலம் (1-3 மாதங்கள்) மற்றும் நீண்டகால டிஜிட்டல் மயமாக்கல் ஆலோசனைகள். பிரதேச செயலாளர் மற்றும் பிரிவுத் தலைவர்களுக்கான நேரடி பணிப்புரைகள்.
8. urgentMattersFlagged: பொதுமக்கள் நலன் கருதி உடன் தீர்க்கப்பட வேண்டிய கடிதங்கள்.
9. leadershipConclusionTamil: பிரதேச செயலாளரின் மாதாந்த மீளாய்வுக் கூட்டத்தில் (Staff Conference) முன்வைக்கக்கூடிய ஊக்கமளிக்கும் முடிவுரை.

கட்டாயமாக JSON வடிவத்தில் வழங்கவும்.`;

  for (const modelName of ADVISORY_MODELS) {
    try {
      let thinkingConfig: { thinkingLevel: ThinkingLevel } | undefined = undefined;
      if (modelName === 'gemini-3.1-flash-lite') {
        thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      } else if (modelName === 'gemini-3.8-flash') {
        thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          ...(thinkingConfig ? { thinkingConfig } : {}),
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallHealthScore: {
                type: Type.INTEGER,
                description: 'Institutional efficiency score out of 100',
              },
              healthGrade: {
                type: Type.STRING,
                description: 'Performance grade e.g. A, B+, B, C',
              },
              executiveSummaryTamil: {
                type: Type.STRING,
                description: 'Detailed executive summary in professional administrative Tamil',
              },
              executiveSummaryEnglish: {
                type: Type.STRING,
                description: 'Brief executive overview in English',
              },
              keyStrengthsTamil: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of observed institutional strengths in Tamil',
              },
              systemicDeficienciesTamil: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of bottlenecks, backlogs, and departmental deficiencies in Tamil',
              },
              citizenGrievanceTrendsTamil: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Trends of citizen complaints and requests in Tamil',
              },
              divisionAssessments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    division: { type: Type.STRING },
                    performanceRating: {
                      type: Type.STRING,
                      description: 'High Efficiency | Satisfactory | Needs Improvement | Critical Bottleneck',
                    },
                    performanceRatingTamil: { type: Type.STRING },
                    bottleneckAnalysisTamil: { type: Type.STRING },
                    delayFactorsTamil: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    recommendationTamil: { type: Type.STRING },
                  },
                  required: [
                    'division',
                    'performanceRating',
                    'performanceRatingTamil',
                    'bottleneckAnalysisTamil',
                    'delayFactorsTamil',
                    'recommendationTamil',
                  ],
                },
              },
              strategicDirectives: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    horizon: {
                      type: Type.STRING,
                      description: 'Immediate (0-7 Days) | Medium-term (1-3 Months) | Long-term Systemic',
                    },
                    horizonTamil: { type: Type.STRING },
                    targetAuthorityTamil: { type: Type.STRING },
                    directiveTamil: { type: Type.STRING },
                    expectedOutcomeTamil: { type: Type.STRING },
                  },
                  required: [
                    'horizon',
                    'horizonTamil',
                    'targetAuthorityTamil',
                    'directiveTamil',
                    'expectedOutcomeTamil',
                  ],
                },
              },
              urgentMattersFlagged: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    letterSubject: { type: Type.STRING },
                    division: { type: Type.STRING },
                    urgencyReasonTamil: { type: Type.STRING },
                    suggestedActionTamil: { type: Type.STRING },
                  },
                  required: [
                    'letterSubject',
                    'division',
                    'urgencyReasonTamil',
                    'suggestedActionTamil',
                  ],
                },
              },
              leadershipConclusionTamil: {
                type: Type.STRING,
                description: 'Encouraging closing directive for Divisional Secretary and heads',
              },
            },
            required: [
              'overallHealthScore',
              'healthGrade',
              'executiveSummaryTamil',
              'executiveSummaryEnglish',
              'keyStrengthsTamil',
              'systemicDeficienciesTamil',
              'citizenGrievanceTrendsTamil',
              'divisionAssessments',
              'strategicDirectives',
              'leadershipConclusionTamil',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        ...parsed,
        generatedAt: new Date().toISOString(),
      } as AdvisoryReportResponsePayload;
    } catch (modelErr: any) {
      console.warn(`Advisory model ${modelName} encountered rate limit / error, trying next candidate...`, modelErr?.message || modelErr);
    }
  }

  // If all models hit quota (429) or network issue, fallback gracefully to deterministic report
  console.log('Gemini API quota reached across models. Serving high-fidelity calculated institutional report.');
  return buildDeterministicAdvisoryReport(metrics);
}

/**
 * Master Express and Vercel Serverless Function Handler
 */
export default async function aiAdvisoryReportHandler(req: Request, res: Response): Promise<void> {
  try {
    // 1. CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Api-Key');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // 2. Parse body safely
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    // 3. Resolve API key
    const headerKey = (req.headers?.['x-gemini-api-key'] as string) || '';
    const bodyKey = (body && typeof body === 'object' && body.apiKey ? String(body.apiKey) : '') || '';
    const envKey = (
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_API_KEY ||
      ''
    ).trim();

    const effectiveKey = (headerKey || bodyKey || envKey).trim();
    const metrics = body?.metrics || {};

    // If API key is not configured on server/client, still return a complete deterministic advisory report
    if (!effectiveKey || effectiveKey === 'MY_GEMINI_API_KEY') {
      const fallbackReport = buildDeterministicAdvisoryReport(metrics);
      res.status(200).json({
        ok: true,
        report: fallbackReport,
        isFallback: true,
        apiKeyMissing: true,
        fallbackNoticeTamil: 'Google Gemini API Key அமைக்கப்படவில்லை. பிரதேச செயலகத்தின் தபால் மற்றும் நடவடிக்கை புள்ளிவிவரங்களின் அடிப்படையில் விரிவான நிர்வாக அறிக்கை வெற்றிகரமாகத் தயாரிக்கப்பட்டது.',
      });
      return;
    }

    const report = await generateInstitutionalAdvisoryReport({
      metrics,
      apiKey: effectiveKey,
    });

    res.status(200).json({
      ok: true,
      report,
    });
  } catch (error: any) {
    console.error('Error in AI institutional advisory handler, generating fallback report:', error);
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const fallbackReport = buildDeterministicAdvisoryReport(body?.metrics || {});
      res.status(200).json({
        ok: true,
        report: fallbackReport,
        isFallback: true,
        fallbackNoticeTamil: 'பிரதேச செயலகத்தின் தபால் மற்றும் நடவடிக்கை புள்ளிவிவரங்களின் அடிப்படையில் விரிவான நிர்வாக அறிக்கை வெற்றிகரமாகத் தயாரிக்கப்பட்டது.',
      });
    } catch {
      res.status(200).json({
        ok: false,
        error: 'அறிக்கையைத் தயாரிக்க முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
      });
    }
  }
}
