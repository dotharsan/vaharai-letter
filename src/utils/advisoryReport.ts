export interface DivisionStatInput {
  division: string;
  total: number;
  taken: number;
  notTaken: number;
  underInvestigation: number;
  notYetViewed: number;
  completionRate: number;
}

export interface AdvisoryReportRequestPayload {
  metrics: {
    totalLetters: number;
    actionTakenCount: number;
    actionNotTakenCount: number;
    underInvestigationCount: number;
    notYetViewedCount: number;
    divisionStats: DivisionStatInput[];
    topSubjects?: Array<{ subject: string; count: number; category?: string }>;
    samplePendingLetters?: Array<{
      originalNo: string;
      date: string;
      division: string;
      subject: string;
      action: string;
      fromWhom: string;
    }>;
    selectedDivisionFilter?: string;
    timeframe?: string;
  };
  apiKey?: string;
}

export interface DivisionAssessment {
  division: string;
  performanceRating: 'High Efficiency' | 'Satisfactory' | 'Needs Improvement' | 'Critical Bottleneck';
  performanceRatingTamil: string;
  bottleneckAnalysisTamil: string;
  delayFactorsTamil: string[];
  recommendationTamil: string;
}

export interface StrategicDirective {
  horizon: 'Immediate (0-7 Days)' | 'Medium-term (1-3 Months)' | 'Long-term Systemic';
  horizonTamil: string;
  targetAuthorityTamil: string;
  directiveTamil: string;
  expectedOutcomeTamil: string;
}

export interface AdvisoryReportResponsePayload {
  overallHealthScore: number;
  healthGrade: string;
  executiveSummaryTamil: string;
  executiveSummaryEnglish: string;
  keyStrengthsTamil: string[];
  systemicDeficienciesTamil: string[];
  citizenGrievanceTrendsTamil: string[];
  divisionAssessments: DivisionAssessment[];
  strategicDirectives: StrategicDirective[];
  urgentMattersFlagged: Array<{
    letterSubject: string;
    division: string;
    urgencyReasonTamil: string;
    suggestedActionTamil: string;
  }>;
  leadershipConclusionTamil: string;
  generatedAt: string;
}

/**
 * Builds a deterministic, high-fidelity administrative advisory report directly from real dataset metrics
 * whenever Gemini API quota (429) is exhausted, offline, or network is restricted.
 * Safe for client-side execution in React without any Node.js dependencies.
 */
export function buildDeterministicAdvisoryReport(
  metrics: AdvisoryReportRequestPayload['metrics']
): AdvisoryReportResponsePayload {
  const total = metrics.totalLetters || 1;
  const taken = metrics.actionTakenCount || 0;
  const notTaken = metrics.actionNotTakenCount || 0;
  const underInvestigation = metrics.underInvestigationCount || 0;
  const notYetViewed = metrics.notYetViewedCount || 0;
  const rate = Math.round((taken / total) * 100);

  const rawScore = Math.round(50 + rate * 0.45 - (notYetViewed / total) * 15);
  const overallHealthScore = Math.max(40, Math.min(92, rawScore));
  const healthGrade =
    overallHealthScore >= 80
      ? 'Grade A'
      : overallHealthScore >= 68
      ? 'Grade B+'
      : overallHealthScore >= 55
      ? 'Grade B'
      : 'Grade C';

  // Sort division stats to find best and lagging branches
  const sortedDivs = [...(metrics.divisionStats || [])].sort(
    (a, b) => b.completionRate - a.completionRate
  );
  const bestDiv = sortedDivs[0]?.division || 'நிர்வாகப் பிரிவு';
  const laggingDiv = sortedDivs[sortedDivs.length - 1]?.division || 'காணிப் பிரிவு';

  // Construct Division Assessments
  const divisionAssessments: DivisionAssessment[] = (metrics.divisionStats || []).map((d) => {
    let rating: DivisionAssessment['performanceRating'] = 'Satisfactory';
    let ratingTamil = 'திருப்திகரமான நிலை';

    if (d.completionRate >= 60) {
      rating = 'High Efficiency';
      ratingTamil = 'உயர் செயல்திறன்';
    } else if (d.completionRate >= 40) {
      rating = 'Satisfactory';
      ratingTamil = 'சராசரி நிலை';
    } else if (d.completionRate >= 20) {
      rating = 'Needs Improvement';
      ratingTamil = 'மேம்படுத்தப்பட வேண்டிய நிலை';
    } else {
      rating = 'Critical Bottleneck';
      ratingTamil = 'கவனிக்கப்பட வேண்டிய தேக்கம்';
    }

    const isLand = d.division.includes('காணி') || d.division.toLowerCase().includes('land');
    const isSamurdhi = d.division.includes('சமுர்த்தி') || d.division.toLowerCase().includes('samurdhi');
    const isAdmin = d.division.includes('நிர்வாக') || d.division.toLowerCase().includes('admin');

    const delayFactorsTamil = isLand
      ? [
          'கள அளவீடுகள் மற்றும் எல்லை நிர்ணய தாமதம்',
          'கிராம மட்ட காணி விசாரணை அமர்வுகளின் போதாமை',
          'திணைக்களங்களுக்கிடையிலான ஆவண உறுதிப்படுத்தல்',
        ]
      : isSamurdhi
      ? [
          'அஸ்வெசும / நலன்புரி கொடுப்பனவு மேன்முறையீடுகளின் மிகுதி',
          'வங்கி கணக்கு சரிபார்த்தல் நடைமுறைகள்',
          'பயனாளி கள சரிபார்ப்பு தாமதங்கள்',
        ]
      : isAdmin
      ? [
          'பிற திணைக்களங்களில் இருந்து பதில் கடிதங்கள் பெறுவதில் சுணக்கம்',
          'உள்நாட்டு சுற்றறிக்கை அறிவுறுத்தல்களுக்கான ஏற்பாடுகள்',
        ]
      : [
          'விடய உத்தியோகத்தர்களின் கள ஆய்வு பணிச்சுமை',
          'பதில் கடிதங்கள் அனுப்பப்பட்ட பின் கணினியில் status புதுப்பிக்கப்படாமை',
        ];

    const bottleneckAnalysisTamil = `${d.division} பிரிவில் மொத்தமுள்ள ${d.total} கடிதங்களில் ${d.taken} கடிதங்கள் தீர்க்கப்பட்டுள்ளன (${d.completionRate}%). நிலுவையில் உள்ள ${d.notTaken + d.underInvestigation} கோப்புகளில் கள ஆய்வுகள் மற்றும் உத்தியோகபூர்வ பதில் தயாரிப்பில் விசேட கவனம் தேவை.`;

    const recommendationTamil = `${d.division} பிரிவுத் தலைவர் நிலுவைக் கடிதங்களை வாராந்தம் மீளாய்வு செய்து, 7 நாட்களுக்கு மேற்பட்ட கோப்புகளுக்கு விரைந்து தீர்வு காண உத்தியோகத்தர்களுக்கு எழுத்துமூல பணிப்புரை வழங்க வேண்டும்.`;

    return {
      division: d.division,
      performanceRating: rating,
      performanceRatingTamil: ratingTamil,
      bottleneckAnalysisTamil,
      delayFactorsTamil,
      recommendationTamil,
    };
  });

  // Construct citizen grievance trends from topSubjects
  const citizenGrievanceTrendsTamil =
    metrics.topSubjects && metrics.topSubjects.length > 0
      ? metrics.topSubjects.slice(0, 5).map((s) => `${s.subject} (${s.count} கடிதங்கள் பதிவு செய்யப்பட்டுள்ளன)`)
      : [
          'காணி உரித்துரிமை, புதிய காணி அனுமதிப்பத்திரங்கள் மற்றும் எல்லை பிணக்குகள்.',
          'அஸ்வெசும / நலன்புரி நன்மைகள் சபை கொடுப்பனவு தொடர்பான மேன்முறையீடுகள்.',
          'வாழ்வாதார உதவிகள், கிராமிய உட்கட்டமைப்பு மற்றும் மின்சார/வீதி திருத்தங்கள்.',
          'பிறப்பு, இறப்பு, விவாக சான்றிதழ் மற்றும் அடையாள அட்டை விண்ணப்பங்கள்.',
        ];

  const urgentMattersFlagged =
    metrics.samplePendingLetters && metrics.samplePendingLetters.length > 0
      ? metrics.samplePendingLetters.slice(0, 4).map((p) => ({
          letterSubject: p.subject || 'அவசர பொதுமக்கள் கடிதம்',
          division: p.division || 'பொதுப் பிரிவு',
          urgencyReasonTamil: `திகதி ${p.date || 'முந்தையது'} இல் பெறப்பட்ட கடிதம் இன்னும் "${p.action}" நிலையில் நிலுவையில் உள்ளது.`,
          suggestedActionTamil: 'குறித்த விடய உத்தியோகத்தர் நேரடி கள ஆய்வை மேற்கொண்டு பதில் கடிதத்தை வரைவு செய்ய வேண்டும்.',
        }))
      : [
          {
            letterSubject: 'காணி எல்லை மற்றும் உரிமை தொடர்பான பொதுமக்கள் முறையீடு',
            division: 'காணிப் பிரிவு (Land Division)',
            urgencyReasonTamil: 'பொதுமக்கள் நேரடியாக சமர்ப்பித்த நீண்டகால பிணக்கு சார்ந்த கடிதம்.',
            suggestedActionTamil: 'காணி உத்தியோகத்தர் மற்றும் கிராம அலுவலர் கூட்டாக களப்பார்வை மேற்கொள்ள வேண்டும்.',
          },
        ];

  return {
    overallHealthScore,
    healthGrade,
    executiveSummaryTamil: `வாகரை பிரதேச செயலகத்தில் பதிவு செய்யப்பட்டுள்ள மொத்த ${total} உத்தியோகபூர்வ கடிதங்களில், ${taken} கடிதங்களுக்கு (${rate}%) தீர்வு எட்டப்பட்டுள்ளது. ${notTaken} கடிதங்கள் நடவடிக்கை எடுக்கப்படாமலும், ${underInvestigation} கடிதங்கள் ஆய்விலும், ${notYetViewed} கடிதங்கள் ஆரம்ப நிலையிலும் உள்ளன. ${bestDiv} சிறந்த வினைத்திறனைக் காண்பிக்கும் அதேவேளை, ${laggingDiv} உள்ளிட்ட பிரிவுகளில் பொதுமக்களின் கோரிக்கைகளை விரைவுபடுத்த விசேட மீளாய்வு அவசியம்.`,
    executiveSummaryEnglish: `Out of ${total} registered inward letters at Koralaipattu North Vaharai DS Office, ${taken} (${rate}%) have been resolved. Continued supervisory oversight is recommended to address the remaining ${notTaken + underInvestigation + notYetViewed} pending matters across divisions.`,
    keyStrengthsTamil: [
      'அனைத்து உள்வரும் தபால்களும் கணினி முறைமையில் திகதியிடப்பட்டு உரிய பிரிவுகளுக்குப் பகிரப்படுகின்றன.',
      `${bestDiv} பிரிவில் அதிகளவான கடிதங்களுக்கு (${sortedDivs[0]?.completionRate || 65}%) தீர்வு காணப்பட்டுள்ளது.`,
      'பொதுமக்களின் கோரிக்கைகள் வகைப் பிரிக்கப்பட்டு உத்தியோகத்தர்களுக்கு நேரடியாகப் பொறுப்பளிக்கப்படுகின்றன.',
    ],
    systemicDeficienciesTamil: [
      `${laggingDiv} உள்ளிட்ட களப்பணிகள் அதிகம் கொண்ட பிரிவுகளில் கோப்புத் தேக்கம் காணப்படுகிறது.`,
      'கடிதங்களுக்கு நடவடிக்கை எடுக்கப்பட்ட பின்பும், கணினியில் "Action Taken" நிலை மற்றும் பதில் விபரம் பதியப்படுவதில் தாமதம் நிலவுகிறது.',
      'பிரிவுகளுக்கிடையிலான கூட்டு கோப்புகளில் (Inter-departmental referrals) தொடர் பின்தொடர்தல் இடைவெளி உள்ளது.',
    ],
    citizenGrievanceTrendsTamil,
    divisionAssessments,
    strategicDirectives: [
      {
        horizon: 'Immediate (0-7 Days)',
        horizonTamil: 'உடனடி நடவடிக்கை (அடுத்த 7 நாட்கள்)',
        targetAuthorityTamil: 'பிரதேச செயலாளர் & உதவி பிரதேச செயலாளர்',
        directiveTamil:
          '14 நாட்களுக்கு மேல் நடவடிக்கையின்றி நிலுவையில் உள்ள தபால்களை விசேட கோப்பாகத் தொகுத்து மாதாந்த கூட்டத்தில் நேரடியாக ஆய்வு செய்தல்.',
        expectedOutcomeTamil: 'நீண்டகால நிலுவையில் உள்ள பொதுமக்களின் கடிதங்கள் 50% குறைவடைதல்.',
      },
      {
        horizon: 'Immediate (0-7 Days)',
        horizonTamil: 'உடனடி நடவடிக்கை (அடுத்த 7 நாட்கள்)',
        targetAuthorityTamil: 'காணிப் பிரிவு & கிராம அபிவிருத்திப் பிரிவு',
        directiveTamil:
          'காணி மற்றும் வாழ்வாதார உதவி தொடர்பான கடிதங்களுக்கு கிராம அலுவலர் ஊடாக கள ஆய்வு அறிக்கைகளை 5 நாட்களுக்குள் சமர்ப்பிக்க உத்தரவிடல்.',
        expectedOutcomeTamil: 'பொதுமக்களின் காணி பிணக்குகளுக்கு துரித தீர்வு கிடைத்தல்.',
      },
      {
        horizon: 'Medium-term (1-3 Months)',
        horizonTamil: 'நடுத்தர கால சீர்திருத்தம் (1-3 மாதங்கள்)',
        targetAuthorityTamil: 'நிர்வாக உத்தியோகத்தர் (AO) & விடய உத்தியோகத்தர்கள்',
        directiveTamil:
          'ஒவ்வொரு கடிதத்திற்கும் பதில் கடிதம் அனுப்பப்பட்ட திகதி, பதில் கடித இலக்கம் ஆகியவற்றை கட்டாயமாக தபால் முகாமைத்துவ முறைமையில் உள்ளீடு செய்தல்.',
        expectedOutcomeTamil: 'அலுவலகத்தின் முழுமையான தபால் கண்காணிப்பு வெளிப்படைத்தன்மை 100% எட்டப்படுதல்.',
      },
      {
        horizon: 'Long-term Systemic',
        horizonTamil: 'நீண்டகால நிறுவன மேம்பாடு (Systemic Reform)',
        targetAuthorityTamil: 'வாகரை பிரதேச செயலக மேலாண்மை',
        directiveTamil:
          'பொதுமக்கள் தமது விண்ணப்பத்தின் நிலையை நேரடியாக அறிந்து கொள்ளும் டிஜிட்டல் மக்கள் சேவை மையத்தை உருவாக்குதல்.',
        expectedOutcomeTamil: 'பொதுமக்கள் பலமுறை அலுவலகம் வந்து செல்ல வேண்டிய அலைச்சல் முற்றாக நீக்கப்படுதல்.',
      },
    ],
    urgentMattersFlagged,
    leadershipConclusionTamil:
      'பொதுமக்கள் வழங்கும் ஒவ்வொரு கடிதமும் அவர்களின் வாழ்க்கைத் தேவை. அதனை விரைவாகவும் நேர்த்தியாகவும் நிறைவேற்றுவதே வாகரை பிரதேச செயலகத்தின் தலையாய கடமையாகும். அனைத்துப் பிரிவு உத்தியோகத்தர்களும் தங்களின் நிலுவைகளை இவ்வாரத்திற்குள் நிறைவு செய்ய முழு ஒத்துழைப்பை வழங்குமாறு கேட்டுக்கொள்கிறேன்.',
    generatedAt: new Date().toISOString(),
  };
}
