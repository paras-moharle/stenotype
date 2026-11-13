/**
 * Test dictations shown to students.
 *
 * These are the 10 practice dictations available in blind mode.
 * Results are NOT stored yet — see the typing page warning.
 *
 * IDs match `lib/dictation-transcripts.ts` so deep links
 * (/student/typing?dictationId=d1) select the right passage.
 */

export type AssignedDictation = {
  id: string;
  title: string;
  category: 'General' | 'Legal' | 'Professional';
  duration: string;
  availableFrom: string;
  availableUntil: string;
  status: 'Not started' | 'In progress' | 'Completed';
  assignedAt: string;
};

export const assignedDictations: AssignedDictation[] = [
  {
    id: 'd1',
    title: 'Court Proceedings — Verdict',
    category: 'Legal',
    duration: '04:32',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
  {
    id: 'd2',
    title: 'Probate Hearing',
    category: 'Legal',
    duration: '03:48',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
  {
    id: 'd3',
    title: 'Quarterly Business Report',
    category: 'Professional',
    duration: '05:12',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
  {
    id: 'd4',
    title: 'Office Correspondence',
    category: 'Professional',
    duration: '02:55',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
  {
    id: 'd5',
    title: 'General News Broadcast',
    category: 'General',
    duration: '03:20',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
  {
    id: 'd6',
    title: 'Property Dispute Hearing',
    category: 'Legal',
    duration: '04:10',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
  {
    id: 'd7',
    title: 'Quarterly Earnings Call',
    category: 'Professional',
    duration: '05:45',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
  {
    id: 'd8',
    title: 'Office Memorandum',
    category: 'General',
    duration: '02:40',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
  {
    id: 'd9',
    title: 'Court Opening Statement',
    category: 'Legal',
    duration: '06:00',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
  {
    id: 'd10',
    title: 'Business Correspondence',
    category: 'Professional',
    duration: '03:55',
    availableFrom: '2026-01-01',
    availableUntil: '2027-12-31',
    status: 'Not started',
    assignedAt: '2026-01-01',
  },
];
