/**
 * Passage generator — curated passage bank.
 *
 * The free typing test draws from a bank of hand-written passages
 * (15 per category, each 50–100 words).
 *
 * Rotation is non-repeating for each category and selected word-count
 * pool. A numeric seed bypasses rotation and selects deterministically.
 */

export type PassageCategory = 'Legal' | 'Professional' | 'General';

export const PASSAGE_BANK: Record<PassageCategory, readonly string[]> = {
  Legal: [
    'The hearing began promptly at ten, with the presiding judge calling the matter for final disposal. Counsel for the plaintiff read the affidavit into the record, pausing whenever the stenographer asked for a slower pace. The defence raised two preliminary objections, both concerning the admissibility of the unsigned agreement. The court reserved its ruling on the first objection and dismissed the second after a brief exchange. Adjournment was granted for a week so that both sides could file their written submissions.',
    'During cross-examination, the witness conceded that she had signed the receipt on the day of the transaction, though she maintained that the amount recorded on it was never paid. The defence counsel produced the bank statement for the same week and invited the court to compare the two dates. After a short recess, the judge directed the registry to summon the bank officer on the next date. The matter now stands listed for further evidence.',
    'The tribunal reserved judgment after hearing both sides at length. In its final order, it held that the appointment had been made in accordance with the governing regulations and that the challenge to seniority was misconceived. The tribunal also observed that the petitioner had failed to approach the departmental authorities before moving the application. Relief was granted only in part, with liberty to seek a fresh measurement of the disputed parcel of land within ninety days.',
    'Settlement talks continued through the afternoon, with the mediator shuttling between the two chambers. By evening the parties had agreed in principle on the principal amount but remained apart on interest. The mediator recorded the agreed terms in a confidential note and fixed the next sitting for the following Monday. Neither side was willing to place the draft on record until the interest question was resolved. The court was informed that the talks were progressing.',
    'The appellate court framed two substantial questions of law for decision. The first concerned the limitation period applicable to a claim founded on a promissory note, and the second dealt with the burden of proving part performance. Senior counsel argued the matter over two hearings, citing judgments from the higher courts. The division bench answered both questions against the appellant and dismissed the appeal, but suspended the operative order for six weeks to enable compliance.',
    'An interim order was passed on the application for stay. The court directed that status quo as on that day be maintained, and that no third-party rights be created over the schedule property in the meantime. The applicant was asked to deposit the assessed court fee within two weeks, failing which the protection would stand vacated automatically. Copies of the order were directed to be served on all the respondents through the process server of the local station.',
    'The commission recorded the statement of the investigating officer and marked the case diary as an exhibit. Under cross-examination, the officer admitted that a portion of the recovery had been made from an open space accessible to the public. This admission materially weakened the case version, and the defence relied on it heavily in its final arguments. The commission will now hear arguments on the question of compensation, which has been kept separate from negligence.',
    'Directions were issued regarding the conduct of the election petition. The petitioner was permitted to amend the pleadings so as to bring on record the results of the re-count sought in the application. The respondents were granted four weeks to file their replies. The court also appointed an advocate as local commissioner to inspect the ballot boxes preserved in the strong room. The inspection report is to be submitted in a sealed cover before the next hearing.',
    'The matter of unpaid professional fees was referred to the bar council under its rules. On scrutiny, the council found that the client had been duly served with the bill of costs and had raised no objection within the statutory period. It accordingly allowed the claim but reduced the quantum after noting that part of the work had been performed by a junior. The client was directed to pay the balance within thirty days of the order.',
    'In the arbitration proceedings, the tribunal had to decide whether the delay in completion was attributable to the contractor or to the authority. The contractor produced daily progress reports and photographs of the flooded site, while the authority relied on the works register maintained by its engineer. After considering the material, the tribunal apportioned responsibility in the ratio of two to one and awarded compensation accordingly, with interest from the date of the award until payment.',
    'The conciliation proceedings before the labour court ended in a full settlement. The management agreed to reinstate the workmen without back wages and to regularise their services within a month. The workmen, for their part, withdrew the demand for revised designations and undertook not to raise the same dispute again. The settlement was reduced to writing and signed by both parties in the presence of the presiding officer, and its terms became part of the award.',
    'At the stage of framing charges, the court examined the materials produced along with the chargesheet. It found sufficient ground to proceed against the first accused in respect of the principal offence, but discharged the second accused in the absence of any recoveries attributable to him. The trial was fixed to commence from the first week of the following month. The witnesses were directed to remain present on the dates assigned, and process was issued accordingly.',
    'The vacation bench heard the application for urgent interim relief. Considering that the agreement in question was due to expire during the vacation, the court directed the parties to maintain the existing arrangement until two weeks after the reopening. It clarified that this direction would not be construed as an expression of opinion on the merits. Notice was issued to the other side returnable on the reopening day, before the regular bench.',
    'On the question of costs, the court took into account the conduct of the parties throughout the litigation. The plaintiff had suppressed a material document at the stage of institution, and the court considered it appropriate to impose actual costs rather than a nominal amount. The decree was drawn accordingly, and execution was left to be pursued in the proper forum. Liberty was reserved to seek refund in the event of success in the pending appeal.',
    'The registrar\'s report on the handling of the case file pointed out serious lapses in the registry. Entries had been made in the wrong columns, and the date of presentation did not tally with the endorsement of the filing counter. A show-cause notice was issued to the official concerned, and the explanation tendered by him was placed before the chief justice. Corrected entries were directed to be made, and the original paper book was sent for examination.',
  ],
  Professional: [
    'The quarterly review opened with the finance head presenting the variance report. Revenue for the quarter had come in slightly ahead of the plan, though the marketing spend had exceeded its allocation by a noticeable margin. The director asked for a breakdown of the overruns and suggested that recurring items be moved to a separate budget line. Minutes of the meeting were circulated the next day, and action points were assigned to the respective owners with deadlines attached.',
    'Onboarding of the new client began with a kickoff call attended by both project teams. The client\'s representatives walked through their existing workflow and highlighted three areas they wanted improved: response time, reporting format, and escalation handling. Our team committed to a revised service structure within a fortnight. A shared tracker was set up the same evening, and the first weekly review was scheduled. The account manager confirmed that the pilot data would be migrated first.',
    'The rollout of the updated platform has been planned in three phases. In the first phase, internal teams will use the new interface in parallel with the old one, and discrepancies will be logged daily. The second phase covers the pilot group of selected customers, whose feedback will shape the training material. Full migration is scheduled for the following quarter, subject to a satisfactory stability record. Support staff will receive their briefings a week before each phase.',
    'This year\'s appraisal cycle will follow the revised format introduced last year. Every employee submits a short self-assessment covering objectives achieved, skills acquired, and areas where support is needed. Managers then hold one-to-one discussions before recommending ratings to the moderation committee. The committee reviews the recommendations across departments to keep the standards consistent. Results will be communicated in the first week of the following month, along with the training calendar for the next cycle.',
    'Negotiations with the vendor concluded after four rounds of discussion. The final agreement includes a service-level commitment of four hours for critical issues and a penalty clause for repeated misses. Payment terms were revised to forty-five days, against the vendor\'s original demand of thirty. A joint review has been scheduled every quarter, and either party may terminate the arrangement after the first year with two months\' notice. The signed copies were exchanged at the director\'s office.',
    'The restructuring proposal has been prepared after consulting the department heads. Two overlapping teams will be merged into a single delivery group, and a new position of programme coordinator has been created. Reporting lines will change from the first of the coming month, and the human resources team will issue individual letters to everyone affected. Sessions explaining the new structure are planned for each floor. No reduction in headcount is envisaged at this stage.',
    'The minutes of the board meeting have been drafted and sent for confirmation. The board approved the annual budget with one modification: the capital outlay for the technology programme was reduced, and the difference was reallocated to the training fund. Two resolutions were passed unanimously, and one was carried by a majority. The next meeting will consider the audit report and the proposal to open an office in another city. Members were asked to comment in writing.',
    'The campaign performance review compared the two channels across reach, cost, and conversion. The search campaign delivered better conversion at a higher cost per click, while the social campaign produced greater reach among younger users. The recommendation is to continue both for another quarter with a revised mix, shifting a small portion of the budget towards search. Weekly dashboards will track the movement, and the agency has been asked to refresh the creative material.',
    'The escalation raised by the key account has been investigated. The customer\'s complaints stemmed from delayed responses during the transition period, when the earlier support arrangement had already been wound down. As remedial action, a dedicated contact has been assigned to the account, and a weekly summary will be sent until the incident count returns to normal. The account manager has offered a service credit for the affected month. The customer has acknowledged the steps.',
    'Preparation of the annual budget is under way. Each department has submitted its estimate along with a note explaining any increase over the current year. The facilities estimate is higher because of the planned renovation, while the technology estimate has fallen following the renegotiated contracts. The finance team will consolidate the figures and circulate a first draft before the review meeting. Departments have been asked to justify their numbers with supporting data.',
    'The new office became fully operational this month. The workspace accommodates ninety desks, two meeting rooms, and a small recording booth for training sessions. Internet connectivity runs on two independent lines so that a single failure does not interrupt work. The building has covered parking and a cafeteria managed by an outside contractor. Staff from the old location will move in two batches over the coming weeks, and the shift plan has been shared.',
    'The compliance audit covered records for the past two years. The auditors tested samples of expense claims, procurement files, and travel bookings against the internal policy. They flagged three categories for improvement: approval trails for small purchases, retention of original invoices, and periodic reconciliation of advance payments. Management has accepted the observations and prepared a corrective plan with fixed responsibilities. A follow-up review will be conducted after six months to confirm the fixes.',
    'Enrolment for the internal training programme closes this week. The programme covers business writing, spreadsheet skills, and presentation technique, delivered as half-day workshops spread across the quarter. Participation is open to all grades, though managers have been asked to plan attendance so that coverage on the floor is not affected. Certificates will be issued on completion, and the records will feed into the appraisal cycle. A waiting list will be maintained for popular sessions.',
    'Arrangements for the annual conference are progressing. The venue has been confirmed for two days in the second week of the coming month, and the agenda now carries eleven speakers. Invitations have gone out to partner organisations, and registrations are being tracked on a shared sheet. The logistics team has finalised travel plans for outstation delegates. A rehearsal for the presenters is planned two days before the event, and the recordings will be published.',
    'The handover memorandum records the status of every open item at the close of the assignment. Files have been arranged in the agreed sequence, and a summary sheet lists the pending approvals with the responsible officer against each. Access to the shared drive will transfer to the incoming coordinator on the first working day of next month. Outstanding correspondence has been filed, and duplicate copies have been retained. The outgoing team will remain available for a month.',
  ],
  General: [
    'The market wakes before the shops do. By six, the vegetable sellers have spread their baskets along the edge of the road, and the flower vendor two stalls down is stringing garlands under a bare bulb. Customers arrive in waves, comparing prices, arguing gently over a few rupees, and leaving with bags that hang heavy from both hands. By eight the morning rush has softened, and the tea stall at the corner does its best business.',
    'The train left the platform a little after nine and spent the first hour crawling past warehouses and water tanks. Then the city thinned out, and fields took over on both sides. Children waved from the crossings, and somewhere near the middle of the journey the coach filled with the smell of fried snacks from the vendor\'s basket. By late afternoon the hills had appeared on the horizon, and everyone moved to the window side.',
    'The bookshop on the corner road is easy to miss. Its door sticks, the shelves lean towards each other, and the catalogue lives entirely in the owner\'s head. Ask for a book published thirty years ago and he will walk straight to the third shelf, blow the dust off, and hand it over with a remark about its last reader. Nothing carries a price tag; the amount is settled after a short, friendly negotiation.',
    'The coastal path begins behind the old lighthouse and climbs gently along the rocks. On one side the sea throws itself against the stones, and on the other, wind-cropped grass bends away from the cliff. Halfway along, the path drops to a cove where fishing boats rest in the shallows. The walk takes about two hours at an easy pace, and the best light falls in the hour before sunset, when the cliffs turn gold.',
    'The monsoon arrived two days late and then made up for it in a single evening. The first drops came down with the wind, and within minutes the streets had turned into shallow rivers. Children ran out onto the balconies, the power flickered twice, and the smell of wet earth rose from the garden. By nightfall the rain had settled into a steady rhythm against the window, and the whole house seemed to relax.',
    'The village festival falls on the full moon, and preparations begin a week in advance. Bamboo poles go up along the temple road, and the sound system is tested at full volume, to everyone\'s delight and nobody\'s complaint. On the day itself, the procession winds through the fields, stopping at every threshold where lamps have been lit. The evening ends with a meal served on leaves under the banyan tree, and music past midnight.',
    'The reading room keeps old habits alive. Regulars have their seats, their newspapers, and their opinions, and a stranger who takes the wrong chair will hear about it by evening. The subscription is modest, the catalogue is a hand-written register, and the daily papers arrive an hour late because they come by the afternoon bus. What the place offers is company: chess in the corner, arguments at the long table, and strict silence rules.',
    'The hill town in the off-season is a different place altogether. The hotels have rooms to spare, the taxis wait without arguing over fares, and the mall road belongs to the walkers again. Mornings are for the ridge, where the mist lifts slowly off the valley, and evenings are for the bakery at the end of the street. The locals, relieved of the summer rush, have time to talk, and their tips are honest.',
    'Cricket in the lane has its own rules. The stumps are a crate, the boundary is the parked scooter, and the ball is chosen after long debate among the older boys. Matches begin when enough players gather and end when the street lights come on. The youngest gets to bat first, a tradition defended fiercely. Windows are a hazard to be negotiated, and a shot into the courtyard carries a penalty the team must pay.',
    'The kitchen was the warmest room in the house, and my grandmother presided over it from a low stool near the stove. Nothing was measured; quantities were judged by look and memory. Rice soaked in a steel pot, spices ground on the stone slab in the corner, and the radio murmured film songs from the shelf above the flour tin. Guests were fed before anything was said, and nobody left without a second helping.',
    'The first day at the new job was spent mostly in finding things. The badge worked on the third attempt, the desk was the one without a drawer, and the canteen token turned out to be bought, not issued. By afternoon the instructions had multiplied: the prefix for internal calls, the shortcut through the second staircase, the day the library stays open late. Nothing was difficult; there was simply more of it than one morning.',
    'Summer on the rooftop has its own timetable. Beds come up at dusk, along with the water bottles and the radio, and the neighbours exchange the day\'s news across the low wall between terraces. The sky is clearer up there than anywhere else in the house. Sleep arrives late and lightly, broken once by a passing train and again by the first crow. By five the eastern sky has begun to pale again.',
    'The bus to the coast town leaves once in the morning and once at night. The morning service fills up with traders carrying empty baskets and returns in the evening full of both baskets and bargaining stories. The night bus is quieter. Passengers doze against the windows, the conductor\'s torch sweeps the aisle at the toll gates, and somewhere past the halfway town the smell of the sea arrives through the air vents.',
    'The street food corner does four things and does them well. The griddle handles the cutlets, the fryer works only on order, and the two chutneys are refilled every two hours from buckets carried from home. Customers stand at the counter or lean against the wall, plates balanced on one hand. There is no seating, no printed menu, and no card machine. What there is, is a fast queue and a cook who remembers.',
    'The migratory birds arrive at the lake in the last week of the year. The regulars with their cameras know the spot where the shallows widen, and they set up before sunrise without being told. For an hour the water is all noise (wings, calls, and splashing) and then the mist burns off and the birds spread out to feed. The lake committee has banned feeding near the bund, yet the visitors keep growing.',
  ],
};

/* ─── Non-repeating rotation ─────────────────────────────── */

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;

  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(pool: readonly T[], rand: () => number): T[] {
  const copy = [...pool];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)];
}

const CATEGORIES = ['Legal', 'Professional', 'General'] as const;
const bags = new Map<string, string[]>();

function drawNonRepeating(
  key: string,
  pool: readonly string[],
  rand: () => number
): string {
  if (pool.length === 0) {
    throw new Error('Cannot draw a passage from an empty pool.');
  }

  const allowed = new Set(pool);
  let bag = (bags.get(key) ?? []).filter((passage) =>
    allowed.has(passage)
  );

  if (bag.length === 0) {
    bag = shuffled(pool, rand);
  }

  const selected = bag.pop();

  if (selected === undefined) {
    throw new Error('Passage pool unexpectedly became empty.');
  }

  bags.set(key, bag);
  return selected;
}

const seedFromTime = (): number =>
  (Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0xffffffff);

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

export type GenerateOptions = {
  targetWords?: number;
  category?: PassageCategory | 'mixed';
  seed?: number;
};

export function generatePassage(opts: GenerateOptions = {}): string {
  const { category = 'mixed', seed, targetWords } = opts;

  if (seed !== undefined && !Number.isFinite(seed)) {
    throw new RangeError('seed must be a finite number.');
  }

  if (
    targetWords !== undefined &&
    (!Number.isFinite(targetWords) || targetWords < 0)
  ) {
    throw new RangeError('targetWords must be a finite, non-negative number.');
  }

  if (
    category !== 'mixed' &&
    !Object.prototype.hasOwnProperty.call(PASSAGE_BANK, category)
  ) {
    throw new RangeError(`Unknown passage category: ${String(category)}`);
  }

  const rand = mulberry32(seed ?? seedFromTime());
  const selectedCategory: PassageCategory =
    category === 'mixed' ? pick(CATEGORIES, rand) : category;

  let pool = PASSAGE_BANK[selectedCategory];

  if (targetWords !== undefined) {
    const near = pool.filter(
      (passage) => Math.abs(countWords(passage) - targetWords) <= 20
    );

    if (near.length > 0) {
      pool = near;
    }
  }

  if (seed !== undefined) {
    const index =
      ((Math.trunc(seed) % pool.length) + pool.length) % pool.length;
    return pool[index];
  }

  // Separate rotation bags for different narrowed pools.
  const bank = PASSAGE_BANK[selectedCategory];
  const poolKey = pool.map((passage) => bank.indexOf(passage)).join(',');
  return drawNonRepeating(`${selectedCategory}:${poolKey}`, pool, rand);
}

