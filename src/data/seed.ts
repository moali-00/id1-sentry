import type { Cluster, FeedItem, Watch, WatchDetail } from '@/types/monitoring'

/**
 * Seed dataset for the monitoring surface.
 *
 * This is the demo corpus the dashboard opens with. It is intentionally the only
 * place fixture data lives — swapping it for a real API means replacing this
 * module (and the slice's `initialState`), not touching any component.
 */

export const SEED_WATCHES: Watch[] = [
  { id: 'w1', name: 'Eastern border movements', category: 'military', count: 18 },
  { id: 'w2', name: 'Capital protests & unrest', category: 'unrest', count: 9 },
  { id: 'w3', name: 'Armed clashes / shelling', category: 'conflict', count: 24 },
  { id: 'w4', name: 'Political statements', category: 'political', count: 4 },
  { id: 'w5', name: 'Rail & logistics', category: 'infra', count: 6 },
  { id: 'w6', name: 'Red Sea shipping threats', category: 'infra', count: 15 },
  { id: 'w7', name: 'Sahel militant activity', category: 'conflict', count: 21 },
  { id: 'w8', name: 'South China Sea patrols', category: 'military', count: 13 },
  { id: 'w9', name: 'Andean protest wave', category: 'unrest', count: 17 },
  { id: 'w10', name: 'Taiwan Strait activity', category: 'military', count: 8 },
  { id: 'w11', name: 'Horn of Africa signalling', category: 'political', count: 5 },
  { id: 'w12', name: 'Balkan flashpoints', category: 'unrest', count: 7 },
]

export const SEED_CLUSTERS: Cluster[] = [
  // ── Eastern Europe ──
  { id: 'p1', watchId: 'w1', category: 'military', count: 18, lat: 49.0, lng: 24.7, size: 56, fresh: true },
  { id: 'p2', watchId: 'w2', category: 'unrest', count: 9, lat: 50.45, lng: 30.52, size: 44, fresh: true },
  { id: 'p3', watchId: 'w3', category: 'conflict', count: 24, lat: 48.0, lng: 37.8, size: 60 },
  {
    id: 'p4',
    watchId: 'w4',
    category: 'political',
    count: 4,
    lat: 53.9,
    lng: 27.56,
    size: 36,
    stale: true,
    inferred: true,
  },
  { id: 'p5', watchId: 'w5', category: 'infra', count: 6, lat: 49.99, lng: 36.23, size: 38 },
  { id: 's1', watchId: 'w1', category: 'military', count: 2, lat: 48.6, lng: 22.3, size: 26, stale: true },
  { id: 's2', watchId: 'w3', category: 'conflict', count: 1, lat: 47.1, lng: 37.5, size: 24, stale: true },
  // ── Red Sea / Gulf of Aden ──
  { id: 'p6', watchId: 'w6', category: 'infra', count: 15, lat: 12.6, lng: 43.4, size: 48, fresh: true },
  { id: 's6', watchId: 'w6', category: 'infra', count: 4, lat: 12.8, lng: 45.0, size: 30, stale: true },
  // ── Sahel (Mali / Niger) ──
  { id: 'p7', watchId: 'w7', category: 'conflict', count: 21, lat: 16.27, lng: -0.04, size: 56 },
  { id: 's7', watchId: 'w7', category: 'conflict', count: 6, lat: 13.51, lng: 2.11, size: 34, fresh: true },
  // ── South China Sea ──
  { id: 'p8', watchId: 'w8', category: 'military', count: 13, lat: 9.7, lng: 114.0, size: 44 },
  { id: 's8', watchId: 'w8', category: 'military', count: 3, lat: 15.15, lng: 117.76, size: 28, stale: true },
  // ── Andes (Peru / Bolivia) ──
  { id: 'p9', watchId: 'w9', category: 'unrest', count: 17, lat: -12.05, lng: -77.04, size: 50, fresh: true },
  { id: 's9', watchId: 'w9', category: 'unrest', count: 5, lat: -16.5, lng: -68.15, size: 32 },
  // ── Taiwan Strait ──
  { id: 'p10', watchId: 'w10', category: 'military', count: 8, lat: 24.4, lng: 119.6, size: 38 },
  // ── Horn of Africa (inferred) ──
  {
    id: 'p11',
    watchId: 'w11',
    category: 'political',
    count: 5,
    lat: 9.03,
    lng: 38.74,
    size: 34,
    stale: true,
    inferred: true,
  },
  // ── Balkans ──
  { id: 'p12', watchId: 'w12', category: 'unrest', count: 7, lat: 44.8, lng: 20.46, size: 36 },
]

export const SEED_FEED: FeedItem[] = [
  {
    id: 'f1',
    clusterId: 'p1',
    watchName: 'Eastern border movements',
    category: 'military',
    platform: 'TG',
    time: '3m',
    confidence: 3,
    text: 'Convoy of ~12 vehicles moving toward the crossing overnight.',
  },
  {
    id: 'f2',
    clusterId: 'p3',
    watchName: 'Armed clashes / shelling',
    category: 'conflict',
    platform: 'TG',
    time: '6m',
    confidence: 2,
    text: 'Reports of shelling near the eastern rail depot; unconfirmed.',
  },
  {
    id: 'f3',
    clusterId: 'p2',
    watchName: 'Capital protests & unrest',
    category: 'unrest',
    platform: 'X',
    time: '9m',
    confidence: 4,
    text: 'Crowd gathering in the central square; traffic being rerouted.',
  },
  {
    id: 'f4',
    clusterId: 'p5',
    watchName: 'Rail & logistics',
    category: 'infra',
    platform: 'VK',
    time: '14m',
    confidence: 3,
    text: 'Freight schedule disruption reported on the northern line.',
  },
  {
    id: 'f5',
    clusterId: 'p7',
    watchName: 'Sahel militant activity',
    category: 'conflict',
    platform: 'TG',
    time: '11m',
    confidence: 2,
    text: 'Armed group reportedly seized a checkpoint on the Gao–Kidal road overnight.',
  },
  {
    id: 'f6',
    clusterId: 'p6',
    watchName: 'Red Sea shipping threats',
    category: 'infra',
    platform: 'X',
    time: '18m',
    confidence: 3,
    text: 'Vessels report GPS interference approaching Bab-el-Mandeb; rerouting advised.',
  },
  {
    id: 'f7',
    clusterId: 'p9',
    watchName: 'Andean protest wave',
    category: 'unrest',
    platform: 'X',
    time: '21m',
    confidence: 4,
    text: 'Marchers blocking the Pan-American highway near Lima; clashes with police reported.',
  },
  {
    id: 'f8',
    clusterId: 'p8',
    watchName: 'South China Sea patrols',
    category: 'military',
    platform: 'VK',
    time: '27m',
    confidence: 2,
    text: 'Grey-hull vessels shadowing a supply run near the Spratly features.',
  },
  {
    id: 'f9',
    clusterId: 'p10',
    watchName: 'Taiwan Strait activity',
    category: 'military',
    platform: 'TG',
    time: '33m',
    confidence: 3,
    text: 'Multiple aircraft tracks crossing the median line since dawn.',
  },
]

/** Per-watch topic detail rendered in the slide-over panel, keyed by `Watch.id`. */
export const SEED_DETAILS: Record<string, WatchDetail> = {
  w1: {
    location: 'Lviv Oblast border corridor, UA',
    coordinates: '49.00°N 24.70°E',
    observed: true,
    confidence: 3,
    posts: [
      {
        platform: 'TG',
        handle: '@border_watch_44',
        time: '3m',
        text: 'Convoy of ~12 military vehicles observed moving toward the border crossing overnight; the column halted near the rail depot.',
      },
      {
        platform: 'TG',
        handle: '@east_watch',
        time: '12m',
        text: 'A second column spotted on the eastern highway; vehicles carrying armour.',
      },
      {
        platform: 'X',
        handle: '@osint_ua',
        time: '19m',
        text: 'Confirming vehicle movement; geotags within a 6 km radius.',
      },
    ],
    insights: [
      '18 posts across 4 channels in the last 3h describe vehicle movement toward the eastern crossing — up sharply from a 2–3/h baseline.',
      'Independent accounts corroborate a 10–15 vehicle convoy; geotags fall within a ~6 km radius, raising location confidence.',
      "Wording shifts from 'logistics' to 'armored' in newer posts — a possible escalation signal.",
      'No verified source yet — treat as unconfirmed. Cross-check against the shelling cluster ~40 km east.',
    ],
  },
  w2: {
    location: 'Kyiv city centre',
    coordinates: '50.45°N 30.52°E',
    observed: true,
    confidence: 4,
    posts: [
      {
        platform: 'X',
        handle: '@capital_now',
        time: '9m',
        text: 'Crowd gathering in the central square; traffic being rerouted.',
      },
      {
        platform: 'TG',
        handle: '@kyiv_live',
        time: '22m',
        text: 'Police setting up barriers near the square; the crowd keeps growing.',
      },
    ],
    insights: [
      '9 posts in 40 min report a growing gathering in the central square; crowd-size claims range widely — treat as unverified.',
      'Two accounts note police rerouting traffic — an early crowd-control response.',
      'Tone is non-violent so far; watch for march routes or clash-related keywords.',
      'Recommend tasking a verified local source; route to the capital-sector duty officer.',
    ],
  },
  w3: {
    location: 'Donetsk Oblast — eastern rail depot',
    coordinates: '48.00°N 37.80°E',
    observed: true,
    confidence: 2,
    posts: [
      {
        platform: 'TG',
        handle: '@east_front_live',
        time: '6m',
        text: 'Reports of shelling near the eastern rail depot; unconfirmed.',
      },
      {
        platform: 'TG',
        handle: '@donbass_now',
        time: '14m',
        text: 'Repeated blasts heard; smoke over the depot area.',
      },
      {
        platform: 'VK',
        handle: 'vk.com/east_report',
        time: '25m',
        text: 'Residents report track damage; no casualty information yet.',
      },
    ],
    insights: [
      'Highest-volume cluster: 24 posts describe explosions / shelling near the eastern rail depot within ~30 min.',
      "Reports are second-hand ('heard', 'reportedly') with no imagery or primary geotag — confidence stays low.",
      'Timing overlaps the border-movement cluster to the west — consider a linked event.',
      'High public-safety impact if confirmed — prioritise for verification.',
    ],
  },
  w4: {
    location: 'Inferred from account metadata · ≈ Minsk region',
    coordinates: '≈ 53.90°N 27.56°E',
    observed: false,
    confidence: 2,
    posts: [
      {
        platform: 'TG',
        handle: 't.me/state_briefs',
        time: '22m',
        text: 'Official statement referencing new border-security measures.',
      },
      {
        platform: 'TG',
        handle: 't.me/gov_channel',
        time: '38m',
        text: 'The agency confirms tightened controls at the border.',
      },
    ],
    insights: [
      '4 posts amplify an official statement on border-security measures; low volume but high-reach accounts.',
      'Location is inferred from account metadata, not geotags — shown dashed on the map; not ground truth.',
      'Rhetoric aligns with the military-movement cluster — useful context, not an incident.',
      'Low operational priority; retain for situational awareness.',
    ],
  },
  w5: {
    location: 'Kharkiv — northern freight line',
    coordinates: '49.99°N 36.23°E',
    observed: true,
    confidence: 3,
    posts: [
      {
        platform: 'VK',
        handle: 'vk.com/rail_logistics',
        time: '14m',
        text: 'Freight schedule disruption reported on the northern line.',
      },
      {
        platform: 'TG',
        handle: '@rail_watch',
        time: '31m',
        text: 'Trains held on the northern branch; cause cited as security checks.',
      },
    ],
    insights: [
      '6 posts report freight / schedule disruption on the northern line over the last 2h.',
      "Two posts attribute it to 'security checks' — a possible indirect movement indicator.",
      'Infrastructure chatter often precedes visible activity — worth a low-level watch.',
      'No direct safety threat evident; monitor for escalation.',
    ],
  },
  w6: {
    location: 'Bab-el-Mandeb strait, Red Sea',
    coordinates: '12.60°N 43.40°E',
    observed: true,
    confidence: 3,
    posts: [
      {
        platform: 'X',
        handle: '@gulf_maritime',
        time: '18m',
        text: 'Merchant vessels report navigation-system jamming near the Bab-el-Mandeb strait; rerouting advised.',
      },
      {
        platform: 'TG',
        handle: '@red_sea_watch',
        time: '34m',
        text: 'Another vessel confirms losing its navigation signal for several minutes north of the strait.',
      },
    ],
    insights: [
      '15 posts over 2h describe GPS / AIS interference along the Bab-el-Mandeb approach — a sharp rise from the overnight baseline.',
      'Two shipping-tracker accounts corroborate vessels rerouting north; positions cluster within a ~20 km band.',
      'No claim of hostile action yet — interference may be precautionary jamming rather than a direct threat.',
      'High commercial impact if sustained; flag to the maritime-domain duty desk for verification.',
    ],
  },
  w7: {
    location: 'Gao region, northern Mali',
    coordinates: '16.27°N 0.04°W',
    observed: true,
    confidence: 2,
    posts: [
      {
        platform: 'TG',
        handle: '@sahel_terrain',
        time: '11m',
        text: 'An armed group reportedly seized a checkpoint on the Gao–Kidal road overnight.',
      },
      {
        platform: 'X',
        handle: '@mali_actu',
        time: '29m',
        text: 'Residents report armed men blocking traffic near Gao.',
      },
    ],
    insights: [
      '21 posts reference an overnight seizure of a checkpoint on the Gao–Kidal axis — the highest-volume Sahel cluster this week.',
      "Accounts are largely second-hand ('on dit', 'reportedly') with no imagery — confidence stays low.",
      'Movement direction is consistent with prior activity toward Kidal; treat as a possible corridor push.',
      'High civilian-safety impact along the road; prioritise for source tasking.',
    ],
  },
  w8: {
    location: 'Spratly features, South China Sea',
    coordinates: '9.70°N 114.00°E',
    observed: true,
    confidence: 2,
    posts: [
      {
        platform: 'VK',
        handle: 'vk.com/scs_watch',
        time: '27m',
        text: 'Grey-hull vessels shadowed a resupply run near the Spratly features.',
      },
      {
        platform: 'TG',
        handle: '@scs_tracker',
        time: '46m',
        text: 'A second vessel appeared north of the reef, heading unclear.',
      },
    ],
    insights: [
      '13 posts describe grey-hull vessels shadowing a resupply run near the Spratly features over the last 3h.',
      'Imagery is limited and hard to geolocate precisely — positions inferred from track descriptions, not geotags.',
      'Pattern matches previous shadowing episodes; low kinetic risk but high signalling value.',
      'Retain for situational awareness; cross-reference against the Scarborough sub-cluster to the north.',
    ],
  },
  w9: {
    location: 'Central Lima, Peru',
    coordinates: '12.05°S 77.04°W',
    observed: true,
    confidence: 4,
    posts: [
      {
        platform: 'X',
        handle: '@lima_alerta',
        time: '21m',
        text: 'Protesters are blocking the Pan-American highway near Lima; clashes with police reported.',
      },
      {
        platform: 'X',
        handle: '@peru_en_vivo',
        time: '33m',
        text: 'The crowd is growing downtown; columns of smoke are visible.',
      },
      {
        platform: 'TG',
        handle: '@andes_report',
        time: '47m',
        text: 'City access roads reported closed due to the protests.',
      },
    ],
    insights: [
      '17 posts in ~1h report a highway blockade near Lima with a rapidly growing crowd — well-corroborated by local media handles.',
      'Multiple videos are consistent on location and time, raising geolocation confidence to high.',
      'Reports of police pushback suggest escalation risk; watch for spread to the La Paz cluster to the south-east.',
      'High public-safety relevance; route to the Andes-sector duty officer.',
    ],
  },
  w10: {
    location: 'Taiwan Strait — median line',
    coordinates: '24.40°N 119.60°E',
    observed: true,
    confidence: 3,
    posts: [
      {
        platform: 'TG',
        handle: '@strait_tracker',
        time: '33m',
        text: 'Multiple military aircraft tracks have crossed the Taiwan Strait median line since dawn.',
      },
      {
        platform: 'X',
        handle: '@air_watch',
        time: '52m',
        text: 'Another wave appeared in the south-west sector; sortie count still being tallied.',
      },
    ],
    insights: [
      '8 posts describe repeated aircraft crossings of the median line since dawn — elevated versus the weekly baseline.',
      'Two tracker accounts broadly agree on timing and sortie count, though exact numbers vary.',
      'Activity is consistent with a signalling pattern rather than an incident; no surface engagement reported.',
      'Medium priority; maintain the watch and correlate with official notices.',
    ],
  },
  w11: {
    location: 'Inferred from account metadata · ≈ Addis Ababa',
    coordinates: '≈ 9.03°N 38.74°E',
    observed: false,
    confidence: 2,
    posts: [
      {
        platform: 'TG',
        handle: 't.me/horn_briefs',
        time: '41m',
        text: 'An official statement referencing new border-security measures.',
      },
      {
        platform: 'TG',
        handle: 't.me/gov_horn',
        time: '58m',
        text: 'Officials confirm tightened monitoring in the border area.',
      },
    ],
    insights: [
      '5 posts amplify an official statement on border-security measures — low volume but high-reach accounts.',
      'Location is inferred from account metadata, not geotags — shown dashed on the map; not ground truth.',
      'Rhetoric provides useful regional context but does not describe a discrete incident.',
      'Low operational priority; retain for situational awareness.',
    ],
  },
  w12: {
    location: 'Central Belgrade, Serbia',
    coordinates: '44.80°N 20.46°E',
    observed: true,
    confidence: 3,
    posts: [
      {
        platform: 'X',
        handle: '@bg_uzivo',
        time: '48m',
        text: 'Demonstrators gathering in central Belgrade; police rerouting traffic.',
      },
      {
        platform: 'TG',
        handle: '@balkan_watch',
        time: '1h',
        text: 'More and more people in the square; increased police presence.',
      },
    ],
    insights: [
      '7 posts report a growing gathering in central Belgrade over the last hour; crowd-size claims vary widely.',
      'Two accounts note police rerouting traffic — an early crowd-control response.',
      'Tone is non-violent so far; watch for march routes or clash-related keywords.',
      'Medium priority; task a verified local source and monitor for escalation.',
    ],
  },
}
