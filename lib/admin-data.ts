/**
 * ⚠️  MOCK DATA — DO NOT IMPORT IN PRODUCTION CODE  ⚠️
 *
 * This file contains hardcoded fake data used to drive the
 * admin UI while the backend (Prisma + CockroachDB) is being
 * built.
 *
 * Before the backend phase is complete:
 *   1. Stop importing from this file in any page or API route.
 *   2. Replace each import with a real Prisma query (or
 *      a server action that calls Prisma).
 *   3. Delete this file once the dashboard / tables are
 *      reading from the database.
 *
 * The TypeScript types below are the *target* shape of the
 * database entities. When the schema is finalised, regenerate
 * these types from `prisma generate` and delete the hand-written
 * duplicates.
 */

export type Student = {
  id: string;
  name: string;
  email: string;
  batch: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  accuracy: number;
  avgWpm: number;
  lastPractice: string;
  fee: 'Paid' | 'Pending' | 'Overdue';
  joinedAt: string;
};

export type Batch = {
  id: string;
  name: string;
  students: number;
  schedule: string;
  time: string;
  status: 'Active' | 'Archived';
};

export type Dictation = {
  id: string;
  title: string;
  category: 'General' | 'Professional' | 'Legal';
  duration: string;
  status: 'Draft' | 'Published' | 'Archived';
  assignedTo: string;
  availableFrom: string;
  availableUntil: string;
};

export type Result = {
  id: string;
  student: string;
  practice: string;
  wpm: number;
  accuracy: number;
  errors: number;
  date: string;
  duration: string;
  correctChars: number;
  incorrectChars: number;
};

export type TypingPassage = {
  id: string;
  title: string;
  category: 'General' | 'Professional' | 'Legal';
  length: number;
  status: 'Draft' | 'Published' | 'Archived';
};

export type Fee = {
  id: string;
  student: string;
  amount: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  paidDate: string | null;
  notes: string;
};

export type ScheduleItem = {
  id: string;
  dictation: string;
  audience: string;
  startsAt: string;
  endsAt: string;
  status: 'Today' | 'Upcoming' | 'Past';
};

export type Activity = {
  id: string;
  type: 'dictation_completed' | 'dictation_published' | 'student_assigned' | 'fee_paid';
  text: string;
  time: string;
};

/* ─── Students ─── */
export const students: Student[] = [
  { id: 's1', name: 'Abhijeet Chahare', email: 'abhijeet@example.com', batch: 'Batch A', status: 'Active', accuracy: 96, avgWpm: 62, lastPractice: 'Today', fee: 'Paid', joinedAt: '2025-01-15' },
  { id: 's2', name: 'Paras Moharle', email: 'paras@example.com', batch: 'Batch A', status: 'Active', accuracy: 97, avgWpm: 71, lastPractice: 'Today', fee: 'Paid', joinedAt: '2024-10-12' },
];

/* ─── Batches ─── */
export const batches: Batch[] = [
  { id: 'b1', name: 'Batch A', students: 18, schedule: 'Mon / Wed / Fri', time: '6:00 PM', status: 'Active' },
  { id: 'b2', name: 'Batch B', students: 24, schedule: 'Tue / Thu / Sat', time: '7:00 PM', status: 'Active' },
  { id: 'b3', name: 'Batch C', students: 14, schedule: 'Sat / Sun', time: '10:00 AM', status: 'Active' },
  { id: 'b4', name: 'Batch D', students: 12, schedule: 'Mon / Wed / Fri', time: '4:00 PM', status: 'Active' },
];

/* ─── Dictations ─── */
export const dictations: Dictation[] = [
  { id: 'd1', title: 'Court Proceedings — Verdict', category: 'Legal', duration: '04:32', status: 'Published', assignedTo: 'Batch A', availableFrom: '2026-09-01', availableUntil: '2026-09-08' },
  { id: 'd2', title: 'Probate Hearing', category: 'Legal', duration: '03:48', status: 'Published', assignedTo: 'Batch A', availableUntil: '2026-09-10' , availableFrom: '2026-09-02'},
  { id: 'd3', title: 'Quarterly Business Report', category: 'Professional', duration: '05:12', status: 'Published', assignedTo: 'Batch B', availableFrom: '2026-09-01', availableUntil: '2026-09-15' },
  { id: 'd4', title: 'Office Correspondence', category: 'Professional', duration: '02:55', status: 'Draft', assignedTo: 'Unassigned', availableFrom: '—', availableUntil: '—' },
  { id: 'd5', title: 'General News Broadcast', category: 'General', duration: '03:20', status: 'Published', assignedTo: 'All', availableFrom: '2026-08-28', availableUntil: '2026-09-12' },
  { id: 'd6', title: 'Legislative Assembly', category: 'Legal', duration: '06:14', status: 'Archived', assignedTo: 'Batch A', availableFrom: '2026-07-15', availableUntil: '2026-07-30' },
];

/* ─── Results ─── */
export const results: Result[] = [
  { id: 'r1', student: 'Aarav Sharma', practice: 'Court Proceedings — Verdict', wpm: 68, accuracy: 97, errors: 4, date: '2026-09-02', duration: '04:32', correctChars: 287, incorrectChars: 9 },
  { id: 'r2', student: 'Sneha Iyer', practice: 'Quarterly Business Report', wpm: 74, accuracy: 98, errors: 2, date: '2026-09-02', duration: '05:12', correctChars: 342, incorrectChars: 7 },
  { id: 'r3', student: 'Diya Patel', practice: 'Court Proceedings — Verdict', wpm: 61, accuracy: 95, errors: 6, date: '2026-09-02', duration: '04:32', correctChars: 265, incorrectChars: 14 },
  { id: 'r4', student: 'Arjun Kapoor', practice: 'General News Broadcast', wpm: 66, accuracy: 96, errors: 3, date: '2026-09-01', duration: '03:20', correctChars: 198, incorrectChars: 8 },
  { id: 'r5', student: 'Rohan Mehta', practice: 'Office Correspondence', wpm: 49, accuracy: 87, errors: 11, date: '2026-09-01', duration: '02:55', correctChars: 142, incorrectChars: 21 },
  { id: 'r6', student: 'Priya Desai', practice: 'General News Broadcast', wpm: 57, accuracy: 93, errors: 7, date: '2026-09-01', duration: '03:20', correctChars: 186, incorrectChars: 14 },
  { id: 'r7', student: 'Ananya Reddy', practice: 'Quarterly Business Report', wpm: 53, accuracy: 91, errors: 9, date: '2026-08-31', duration: '05:12', correctChars: 268, incorrectChars: 26 },
  { id: 'r8', student: 'Kabir Joshi', practice: 'Court Proceedings — Verdict', wpm: 51, accuracy: 89, errors: 12, date: '2026-08-31', duration: '04:32', correctChars: 241, incorrectChars: 30 },
];

/* ─── Typing Passages (admin-managed) ─── */
export const typingPassages: TypingPassage[] = [
  { id: 'tp1', title: 'Court Opening Statement', category: 'Legal', length: 285, status: 'Published' },
  { id: 'tp2', title: 'Estate Inventory Notice', category: 'Legal', length: 264, status: 'Published' },
  { id: 'tp3', title: 'Legislative Amendment', category: 'Legal', length: 292, status: 'Published' },
  { id: 'tp4', title: 'Quarterly Report', category: 'Professional', length: 278, status: 'Published' },
  { id: 'tp5', title: 'Business Correspondence', category: 'Professional', length: 256, status: 'Published' },
  { id: 'tp6', title: 'Communication Skills', category: 'General', length: 271, status: 'Published' },
  { id: 'tp7', title: 'Conference Briefing', category: 'Professional', length: 298, status: 'Draft' },
];

/* ─── Fees ─── */
export const fees: Fee[] = [
  { id: 'f1', student: 'Aarav Sharma', amount: 2500, dueDate: '2026-09-05', status: 'Paid', paidDate: '2026-09-01', notes: 'September fee' },
  { id: 'f2', student: 'Diya Patel', amount: 2500, dueDate: '2026-09-05', status: 'Paid', paidDate: '2026-09-03', notes: 'September fee' },
  { id: 'f3', student: 'Rohan Mehta', amount: 2500, dueDate: '2026-09-05', status: 'Pending', paidDate: null, notes: 'September fee' },
  { id: 'f4', student: 'Sneha Iyer', amount: 2500, dueDate: '2026-09-05', status: 'Paid', paidDate: '2026-09-02', notes: 'September fee' },
  { id: 'f5', student: 'Vikram Singh', amount: 2500, dueDate: '2026-08-25', status: 'Overdue', paidDate: null, notes: 'August fee' },
  { id: 'f6', student: 'Ananya Reddy', amount: 2500, dueDate: '2026-09-05', status: 'Paid', paidDate: '2026-09-04', notes: 'September fee' },
  { id: 'f7', student: 'Kabir Joshi', amount: 2500, dueDate: '2026-09-05', status: 'Pending', paidDate: null, notes: 'September fee' },
  { id: 'f8', student: 'Meera Nair', amount: 2500, dueDate: '2026-08-15', status: 'Overdue', paidDate: null, notes: 'August fee — inactive' },
];

/* ─── Schedule ─── */
export const schedule: ScheduleItem[] = [
  { id: 'sc1', dictation: 'Court Proceedings — Verdict', audience: 'Batch A', startsAt: '2026-09-02 18:00', endsAt: '2026-09-02 18:10', status: 'Today' },
  { id: 'sc2', dictation: 'Probate Hearing', audience: 'Batch A', startsAt: '2026-09-02 18:15', endsAt: '2026-09-02 18:20', status: 'Today' },
  { id: 'sc3', dictation: 'Quarterly Business Report', audience: 'Batch B', startsAt: '2026-09-02 19:00', endsAt: '2026-09-02 19:10', status: 'Today' },
  { id: 'sc4', dictation: 'Office Correspondence', audience: 'Batch B', startsAt: '2026-09-03 19:00', endsAt: '2026-09-03 19:10', status: 'Upcoming' },
  { id: 'sc5', dictation: 'General News Broadcast', audience: 'All', startsAt: '2026-09-04 10:00', endsAt: '2026-09-04 10:10', status: 'Upcoming' },
  { id: 'sc6', dictation: 'Legislative Assembly', audience: 'Batch A', startsAt: '2026-08-28 18:00', endsAt: '2026-08-28 18:10', status: 'Past' },
];

/* ─── Dashboard activity ─── */
export const activity: Activity[] = [
  { id: 'a1', type: 'dictation_completed', text: 'Sneha Iyer completed "Quarterly Business Report" — 74 WPM, 98% accuracy', time: '2 hours ago' },
  { id: 'a2', type: 'fee_paid', text: 'Ananya Reddy paid September fee (₹2,500)', time: '3 hours ago' },
  { id: 'a3', type: 'dictation_published', text: 'Aarav Sharma published "Probate Hearing" dictation', time: '5 hours ago' },
  { id: 'a4', type: 'student_assigned', text: 'Kabir Joshi was assigned to Batch C', time: 'Yesterday' },
  { id: 'a5', type: 'dictation_completed', text: 'Aarav Sharma completed "Court Proceedings — Verdict" — 68 WPM, 97% accuracy', time: 'Today' },
];
