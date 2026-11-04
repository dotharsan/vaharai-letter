import { scanLetterDocument, parseGeminiError } from '../../api/scan-letter.ts';

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Image base64 data is required' }),
      };
    }

    const effectiveKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!effectiveKey || effectiveKey === 'MY_GEMINI_API_KEY') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          apiKeyMissing: true,
          errorType: 'api_key_invalid',
          message: 'Netlify தளத்தில் GEMINI_API_KEY சேர்க்கப்படவில்லை. Site configuration > Environment variables இல் GEMINI_API_KEY ஐ உள்ளிடவும்.',
          errorDetail: {
            type: 'api_key_invalid',
            title: 'GEMINI_API_KEY Not Configured in Netlify',
            message: 'Netlify தளத்தில் GEMINI_API_KEY இன்னும் அமைக்கப்படவில்லை.',
            instructionTamil: 'Netlify Dashboard > Site configuration > Environment variables இல் GEMINI_API_KEY ஐ உள்ளிடவும்.',
            instructionEnglish: 'Add GEMINI_API_KEY in Netlify Site configuration > Environment variables.',
            actionUrl: 'https://aistudio.google.com/app/apikey',
            actionLabel: 'Create API Key',
          },
        }),
      };
    }

    const result = await scanLetterDocument({
      imageBase64,
      mimeType,
      apiKey: effectiveKey,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, data: result }),
    };
  } catch (err: any) {
    const parsed = parseGeminiError(err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        apiKeyMissing: parsed.type === 'api_key_invalid' || parsed.type === 'billing_required',
        errorType: parsed.type,
        error: parsed.message,
        message: parsed.message,
        errorDetail: parsed,
      }),
    };
  }
};
