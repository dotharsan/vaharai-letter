import { generateInstitutionalAdvisoryReport, buildDeterministicAdvisoryReport } from '../../api/ai-advisory-report.ts';

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Gemini-Api-Key',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, error: 'Method not allowed' }),
    };
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
    const headerKey = (event.headers?.['x-gemini-api-key'] || event.headers?.['X-Gemini-Api-Key'] || '').trim();
    const bodyKey = (body.apiKey ? String(body.apiKey) : '').trim();
    const envKey = (
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      ''
    ).trim();

    const effectiveKey = (headerKey || bodyKey || envKey).trim();
    const metrics = body?.metrics || {};

    if (!effectiveKey || effectiveKey === 'MY_GEMINI_API_KEY') {
      const fallbackReport = buildDeterministicAdvisoryReport(metrics);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          report: fallbackReport,
          isFallback: true,
          apiKeyMissing: true,
          fallbackNoticeTamil: 'Google Gemini API Key அமைக்கப்படவில்லை. பிரதேச செயலகத்தின் தபால் மற்றும் நடவடிக்கை புள்ளிவிவரங்களின் அடிப்படையில் விரிவான நிர்வாக அறிக்கை வெற்றிகரமாகத் தயாரிக்கப்பட்டது.',
        }),
      };
    }

    const report = await generateInstitutionalAdvisoryReport({
      metrics,
      apiKey: effectiveKey,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        report,
      }),
    };
  } catch (err: any) {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
      const fallbackReport = buildDeterministicAdvisoryReport(body?.metrics || {});
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          report: fallbackReport,
          isFallback: true,
          fallbackNoticeTamil: 'பிரதேச செயலகத்தின் தபால் மற்றும் நடவடிக்கை புள்ளிவிவரங்களின் அடிப்படையில் விரிவான நிர்வாக அறிக்கை வெற்றிகரமாகத் தயாரிக்கப்பட்டது.',
        }),
      };
    } catch {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Failed to generate report' }),
      };
    }
  }
};
