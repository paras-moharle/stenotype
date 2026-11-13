/**
 * Mock dictation transcripts — these are the reference
 * transcripts that students type against in "blind" mode.
 *
 * In the future these come from the Dictation entity
 * uploaded by the admin (audio + transcript together).
 * Today they are hardcoded so the student flow works.
 *
 * The shape mirrors what the API will return.
 */

export type DictationWithTranscript = {
  id: string;
  title: string;
  category: 'Legal' | 'Professional' | 'General';
  duration: string;
  referenceTranscript: string;
};

export const mockDictations: DictationWithTranscript[] = [
  {
    id: 'd1',
    title: 'Court Proceedings — Verdict',
    category: 'Legal',
    duration: '04:32',
    referenceTranscript:
      'The court shall proceed with the examination of the witness in accordance with the provisions of law and all parties shall be given a fair opportunity to present their arguments before the honorable judge delivers the final verdict.',
  },
  {
    id: 'd2',
    title: 'Probate Hearing',
    category: 'Legal',
    duration: '03:48',
    referenceTranscript:
      'In the matter of the estate, the executor shall file an inventory of all assets within ninety days of the appointment and shall provide notice to all interested parties as required by the probate code of the jurisdiction.',
  },
  {
    id: 'd3',
    title: 'Quarterly Business Report',
    category: 'Professional',
    duration: '05:12',
    referenceTranscript:
      'The quarterly report indicates steady growth across all divisions, with particular strength in the professional services segment and continued improvement in operational efficiency throughout the organisation.',
  },
  {
    id: 'd4',
    title: 'Office Correspondence',
    category: 'Professional',
    duration: '02:55',
    referenceTranscript:
      'All correspondence must be reviewed by the appropriate department head before being released and should be accompanied by a brief summary of the key points discussed during any prior meetings.',
  },
  {
    id: 'd5',
    title: 'General News Broadcast',
    category: 'General',
    duration: '03:20',
    referenceTranscript:
      'The regional council convened yesterday to discuss the proposed amendment which would modify existing provisions related to public funding and establish a transparent framework for the allocation of resources.',
  },
  {
    id: 'd6',
    title: 'Property Dispute Hearing',
    category: 'Legal',
    duration: '04:10',
    referenceTranscript:
      'The plaintiff asserts that the boundary line was established in 1982 and has been recognized by both parties for over thirty years, making adverse possession a central issue in this case.',
  },
  {
    id: 'd7',
    title: 'Quarterly Earnings Call',
    category: 'Professional',
    duration: '05:45',
    referenceTranscript:
      'Revenue increased twelve percent year-over-year, driven primarily by subscription growth in the enterprise segment and continued improvement in operational efficiency across all regions.',
  },
  {
    id: 'd8',
    title: 'Office Memorandum',
    category: 'General',
    duration: '02:40',
    referenceTranscript:
      'All department heads must submit their quarterly budget proposals by the end of the month for review by the executive committee.',
  },
  {
    id: 'd9',
    title: 'Court Opening Statement',
    category: 'Legal',
    duration: '06:00',
    referenceTranscript:
      'Ladies and gentlemen of the jury, the evidence you will hear over the next several days will demonstrate beyond a reasonable doubt that the defendant acted with full knowledge and intent.',
  },
  {
    id: 'd10',
    title: 'Business Correspondence',
    category: 'Professional',
    duration: '03:55',
    referenceTranscript:
      'Thank you for your inquiry regarding our services. We are pleased to provide a detailed proposal outlining the scope of work, timeline, and pricing for your review.',
  },
];
