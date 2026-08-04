import { relativeTime, truncate } from '@/utils/format'
import { destinationPoint, greatCircle } from '@/utils/geodesy'
import { verticalExtent } from '@/utils/altitude'
import type { CategoryKey, Cluster, FeedItem, MapArea, MapLine, MapPoint, Post } from '@/types/monitoring'
import type {
  Aircraft,
  AoiBoxKey,
  AoiResponse,
  CoupledTrial,
  DangerArea,
  EvacuationPlace,
  GeoPolygon,
  ImageryScene,
  MaritimeWarning,
  SocialImagePost,
  SocialItem,
  SocialPost,
  ThermalDetection,
} from '@/types/sentiry'

/**
 * Sentiry wire shapes → the map's own view models.
 *
 * The one rule worth remembering: **every ring and path here is GeoJSON
 * `[lon, lat]`**, which is both what the API sends and what MapLibre draws. A
 * coordinate is never flipped anywhere in the app. Where the wire format gives
 * named `{lat, lon}` fields instead of a tuple, the pair is reordered on the way
 * out — that is a reordering of named fields, not a flip you have to track.
 */

const unixSeconds = (iso: string | null | undefined): number | undefined => {
  if (!iso) return undefined
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined
}

/**
 * The outer ring of a GeoJSON polygon, `[[lon, lat], …]`.
 *
 * No reordering — the wire format is already the render format. Holes are
 * dropped: nothing the API sends has any, and drawing one would need a
 * `MapArea` that carries more than a single ring.
 */
function outerRing(polygon: GeoPolygon): [number, number][] {
  // The wire type is `number[][][]` — GeoJSON does not constrain a position to
  // two ordinates, since a third would be elevation. Nothing the API sends
  // carries one, so the pair is taken and any extra dropped.
  return (polygon.coordinates[0] ?? []).map(([lon, lat]) => [lon, lat] as [number, number])
}

const AOI_ZONE_BY_BOX: Record<AoiBoxKey, MapArea['layerId']> = {
  pad: 'aoi_pad',
  range: 'aoi_range',
  airspace: 'aoi_airspace',
  downrange: 'aoi_downrange',
}

/** The four AOI boxes as drawable areas. */
export function aoiZones(aoi: AoiResponse): MapArea[] {
  return (Object.keys(AOI_ZONE_BY_BOX) as AoiBoxKey[]).flatMap((key) => {
    const box = aoi.boxes[key]
    if (!box) return []
    return [
      {
        id: `aoi-${key}`,
        layerId: AOI_ZONE_BY_BOX[key],
        ring: outerRing(box.geojson),
        label: key.toUpperCase(),
        detail: box.purpose,
      },
    ]
  })
}

/** The target island and the secondary complex, as two labelled points. */
export function sitePoints(aoi: AoiResponse): MapPoint[] {
  const points: MapPoint[] = [
    {
      id: 'site-target',
      layerId: 'itr_sites',
      lat: aoi.target.centre.lat,
      lng: aoi.target.centre.lon,
      label: aoi.target.name,
      detail: [aoi.target.facility, aoi.target.state, aoi.target.country].filter(Boolean).join(' · '),
      severity: 5,
    },
  ]

  if (aoi.secondary_site) {
    points.push({
      id: 'site-secondary',
      layerId: 'itr_sites',
      lat: aoi.secondary_site.centre.lat,
      lng: aoi.secondary_site.centre.lon,
      label: aoi.secondary_site.name,
      detail: 'Secondary ITR complex',
      severity: 3,
    })
  }

  return points
}

/**
 * Warnings become a point at the centroid.
 *
 * `indicator_score` is 0–1 and drives marker size, so a warning that actually
 * moved the assessment reads larger than a routine one.
 */
export function warningPoints(warnings: MaritimeWarning[]): MapPoint[] {
  return warnings.flatMap((warning) => {
    if (!warning.centroid) return []
    const distance =
      warning.distance_to_island_km === null ? '' : ` · ${Math.round(warning.distance_to_island_km)} km from island`

    return [
      {
        id: `warning-${warning.message_id}`,
        layerId: 'itr_warnings' as const,
        lat: warning.centroid.lat,
        lng: warning.centroid.lon,
        label: `${warning.number} · ${warning.kind.replace(/_/g, ' ')}`,
        detail: `${warning.relevance}${distance}`,
        severity: Math.round((warning.indicator_score ?? 0.4) * 5),
        timestamp: unixSeconds(warning.issued_at),
      },
    ]
  })
}

/** The declared boundary of each warning, drawn dashed — it is a forecast area. */
export function warningAreas(warnings: MaritimeWarning[]): MapArea[] {
  return warnings.flatMap((warning) => {
    const b = warning.bounds
    if (!b) return []
    return [
      {
        id: `warning-area-${warning.message_id}`,
        layerId: 'itr_warnings' as const,
        ring: [
          [b.west, b.south],
          [b.east, b.south],
          [b.east, b.north],
          [b.west, b.north],
        ],
        label: `${warning.number} danger area`,
        detail: warning.kind.replace(/_/g, ' '),
        dashed: true,
      },
    ]
  })
}

/**
 * Airspace danger areas declared by NOTAM.
 *
 * `positions` is already a closed ring, as named `{lat, lon}` pairs, so it only
 * needs pulling into tuples. A coarse geometry — a NOTAM giving a centre and a
 * radius rather than a published boundary — is drawn dashed, because the shape
 * is this service's approximation rather than the authority's.
 */
export function dangerAreaAreas(areas: DangerArea[]): MapArea[] {
  return areas.flatMap((area) => {
    if (area.positions.length < 3) return []

    const when =
      area.starts_in_hours === undefined
        ? 'active'
        : area.starts_in_hours <= 0
          ? 'active now'
          : area.starts_in_hours < 24
            ? `in ${Math.round(area.starts_in_hours)}h`
            : `in ${Math.round(area.starts_in_hours / 24)}d`

    const distance =
      area.distance_to_island_km === null ? '' : ` · ${Math.round(area.distance_to_island_km)} km from island`

    // The declared vertical extent, where there is one to read. `UNL` — which is
    // what every warning in the current capture publishes — yields null, and the
    // area stays a flat outline rather than being extruded to an invented ceiling.
    const extent = verticalExtent(area.lower_limit, area.upper_limit)

    return [
      {
        id: `danger-${area.notam_id}`,
        layerId: 'itr_danger_areas' as const,
        ring: area.positions.map((position) => [position.lon, position.lat] as [number, number]),
        label: `${area.notam_id} · danger area`,
        detail: `${when}${distance} · ${area.lower_limit ?? 'SFC'}–${area.upper_limit ?? 'UNL'}`,
        dashed: area.geometry_coarse,
        ...(extent ?? {}),
      },
    ]
  })
}

/**
 * Launch corridors — the danger area each warning actually declared.
 *
 * Drawn from the warning's own `positions`, which are the coordinates the
 * authority published. An earlier version synthesised a wedge from
 * `{bearing_deg, bearing_span_deg, near_km, far_km}` instead, and that was
 * badly wrong: when a declared polygon *wraps around* the launch site, the
 * angular spread measured from that origin comes out near 240°, and sweeping a
 * sector across it painted a fan over India, Sri Lanka, Myanmar and Indonesia.
 * The real area is a narrow ocean corridor. Warning 819/26 is the case in
 * point — six vertices running 3,800 km south into the Indian Ocean and back.
 *
 * The corridor figures are still used, but only as *description*: bearing and
 * range in the tooltip, and the range class that narrows the candidate systems.
 *
 * A handful of warnings publish one or two points rather than an area. Those
 * cannot be a polygon, so they are left to the centroid marker instead of being
 * inflated into a shape the authority never declared.
 */
export function corridorAreas(warnings: MaritimeWarning[]): MapArea[] {
  return warnings.flatMap((warning) => {
    const positions = warning.positions ?? []
    if (positions.length < 3) return []

    const corridor = warning.corridor
    const systems = warning.likely_systems

    // A launch trial is the thing being watched for. A firing exercise or a
    // navigation hazard is standing range activity that would be in force
    // whether or not a test were coming — drawing them alike hid exactly the
    // distinction the dashboard exists to make.
    //
    // Keyed on `kind` alone. `is_launch_indicator` is broader — it marks any
    // warning that feeds the launch score, and is true for firing exercises
    // too, so including it classified all five as trials and changed nothing.
    const isTrial = warning.kind === 'launch_trial'

    const detail = [
      warning.kind.replace(/_/g, ' '),
      corridor ? `bearing ${Math.round(corridor.bearing_deg)}° · ${Math.round(corridor.far_km)} km reach` : null,
      systems ? `${systems.label} (${systems.confidence})` : null,
      warning.timing,
    ]
      .filter(Boolean)
      .join(' · ')

    return [
      {
        id: `corridor-${warning.message_id}`,
        layerId: isTrial ? ('itr_corridors' as const) : ('itr_routine' as const),
        ring: positions.map((position) => [position.lon, position.lat] as [number, number]),
        label: `${warning.number} · ${warning.kind.replace(/_/g, ' ')}`,
        detail,
        // Routine activity recedes; a trial is drawn at full strength.
        emphasis: isTrial ? 1 : 0.45,
      },
    ]
  })
}

/**
 * Coupled trials, as a great-circle line from the launch site to the impact
 * zone.
 *
 * A straight line would understate the reach at 1,200 km — over that distance
 * the shortest path is visibly an arc, and drawing it flat would put the impact
 * zone in the wrong place relative to the coast.
 */
export function coupledLines(pairs: CoupledTrial[], origin: { lat: number; lon: number }): MapLine[] {
  return pairs.flatMap((pair, index) => {
    const target = pair.far_warning.centroid
    if (!target) return []

    return [
      {
        id: `coupled-${pair.near_warning.number}-${pair.far_warning.number}-${index}`,
        layerId: 'itr_impact' as const,
        path: greatCircle(origin.lat, origin.lon, target.lat, target.lon),
        label: `${pair.near_warning.number} → ${pair.far_warning.number}`,
        detail: `${Math.round(pair.impact_distance_km)} km · bearing ${Math.round(pair.bearing_deg)}°`,
      },
    ]
  })
}

/**
 * Settlements named in evacuation reporting, as map points.
 *
 * The `evacuation_notice` indicator scores 0.90 — the highest in the
 * assessment — and until this connector arrived it had no geometry at all. A
 * town 20 km from the island reads very differently from one 85 km away, and
 * that distance is only checkable once both are on the map.
 *
 * Places the geocoder could not resolve are skipped rather than guessed at.
 */
export function evacuationPoints(places: EvacuationPlace[]): MapPoint[] {
  return places.flatMap((place) => {
    if (!place.found || place.lat === null || place.lon === null) return []

    const distance =
      place.distance_to_island_km === null ? '' : `${Math.round(place.distance_to_island_km)} km from island`

    return [
      {
        id: `evac-${place.query}`,
        layerId: 'itr_evacuations' as const,
        lat: place.lat,
        lng: place.lon,
        label: place.query,
        detail: [distance, place.display_name].filter(Boolean).join(' · '),
        // Closer to the island is more significant; 50 km is the threshold the
        // connector itself reports against.
        severity: place.distance_to_island_km !== null && place.distance_to_island_km <= 50 ? 5 : 3,
      },
    ]
  })
}

/** FIRMS detections. Severity comes from fire radiative power, not brightness. */
export function thermalPoints(detections: ThermalDetection[]): MapPoint[] {
  return detections.map((detection, index) => ({
    id: `thermal-${detection.latitude}-${detection.longitude}-${index}`,
    layerId: 'itr_thermal' as const,
    lat: detection.latitude,
    lng: detection.longitude,
    label: `${detection.frp.toFixed(1)} MW`,
    detail: `${detection.brightness.toFixed(0)} K · ${detection.acq_date} ${detection.acq_time}Z`,
    // FRP spans a wide range; a log-ish bucket keeps a 1 MW dot visible without
    // letting a 100 MW one swamp the map.
    severity: Math.max(1, Math.min(5, Math.round(Math.log10(Math.max(detection.frp, 1)) * 2 + 1))),
  }))
}

export function aircraftPoints(aircraft: Aircraft[]): MapPoint[] {
  return aircraft.flatMap((contact) => {
    if (contact.latitude === null || contact.longitude === null) return []

    const altitude = contact.baro_altitude ?? contact.geo_altitude
    const detail = [
      contact.origin_country,
      altitude === null ? null : `FL${Math.round(altitude / 30.48)}`,
      contact.velocity === null ? null : `${Math.round(contact.velocity)} m/s`,
    ]
      .filter(Boolean)
      .join(' · ')

    return [
      {
        id: `aircraft-${contact.icao24}`,
        layerId: 'itr_aircraft' as const,
        lat: contact.latitude,
        lng: contact.longitude,
        label: contact.callsign?.trim() || contact.icao24,
        detail,
        severity: contact.on_ground ? 1 : 3,
        timestamp: contact.last_contact,
        bearingDeg: contact.true_track ?? undefined,
        speedMs: contact.velocity ?? undefined,
        // Barometric first, geometric as the fallback — barometric is what ATC and
        // the NOTAM limits are both expressed against, so it is the one that can be
        // compared to a declared ceiling. Null when the contact reports neither,
        // which is normal for a ground contact.
        altitudeM: altitude ?? undefined,
      },
    ]
  })
}

/** How far ahead a contact's leader line projects. */
const PROJECTION_MINUTES = 5

/**
 * Where each airborne contact will be in a few minutes, by dead reckoning.
 *
 * Straight extrapolation of the reported track and ground speed — it assumes no
 * turn and no wind, so it is a leader line showing *heading*, not a predicted
 * flight path. On a vacancy watch the useful question is which way traffic is
 * going and whether it is routing around something, and that this answers.
 *
 * Contacts on the ground get none: a parked aircraft has a track but no travel.
 */
export function aircraftProjections(aircraft: Aircraft[]): MapLine[] {
  return aircraft.flatMap((contact) => {
    if (contact.latitude === null || contact.longitude === null) return []
    if (contact.on_ground || !contact.velocity || contact.true_track === null) return []

    const distanceKm = (contact.velocity * PROJECTION_MINUTES * 60) / 1000
    const ahead = destinationPoint(contact.latitude, contact.longitude, contact.true_track, distanceKm)

    return [
      {
        id: `aircraft-track-${contact.icao24}`,
        layerId: 'itr_aircraft' as const,
        path: [[contact.longitude, contact.latitude], ahead],
        label: contact.callsign?.trim() || contact.icao24,
        detail: `${Math.round(contact.true_track)}° · ${Math.round(contact.velocity * 3.6)} km/h · ${PROJECTION_MINUTES} min ahead`,
        dashed: true,
      },
    ]
  })
}

/** Feed rows are one-liners; a headline longer than this is clipped. */
const FEED_TEXT_LIMIT = 130

/**
 * Social and news items become activity-feed rows.
 *
 * Their `clusterId` deliberately matches no cluster: `selectVisibleFeed` keeps
 * rows whose cluster is unknown, so these always show rather than being hidden
 * behind a watch toggle they do not belong to.
 *
 * The category is derived from what the item matched — an evacuation notice is
 * civil unrest, a forward-looking trial announcement is military movement, and
 * everything else is political signalling.
 */
export function socialFeedItems(items: SocialItem[], now: number = Date.now()): FeedItem[] {
  return items.map((item, index) => {
    const category: CategoryKey =
      item.evacuation_terms.length > 0 ? 'unrest' : item.forward_looking_terms.length > 0 ? 'military' : 'political'
    const published = unixSeconds(item.published_at) ?? Math.floor(now / 1000)

    return {
      id: `itr-social-${index}`,
      clusterId: 'itr-social',
      watchName: 'Abdul Kalam Island',
      category,
      platform: item.platform.replace(/_/g, ' ').toUpperCase(),
      time: relativeTime(published, now),
      timestamp: published,
      text: truncate(item.title, FEED_TEXT_LIMIT),
      // AOI-relevant items were matched on a place or programme name; the rest
      // came in on a looser keyword and are worth less.
      confidence: item.aoi_relevant ? 4 : 2,
    }
  })
}

/* ── Social posts ────────────────────────────────────────────────────────────
 *
 * Posts carry no coordinates. What they carry is the place *name* they matched
 * on, and the two named sites already have positions in the AOI, so a post that
 * says "Chandipur" can be put at Chandipur. A post that only names a missile is
 * left off the map entirely — placing it at the island would be inventing a
 * position the source never gave.
 */

/** Which matched place name resolves to which of the two known sites. */
const ISLAND_TERMS = ['abdul kalam', 'wheeler', 'wheeler island', 'integrated test range', 'itr odisha']
const CHANDIPUR_TERMS = ['chandipur', 'balasore', 'baleshwar', 'bhadrak']

export interface SocialSite {
  id: string
  name: string
  lat: number
  lng: number
}

/** The sites posts can be attributed to, taken from the AOI itself. */
export function socialSites(aoi: AoiResponse): SocialSite[] {
  const sites: SocialSite[] = [
    { id: 'island', name: aoi.target.name, lat: aoi.target.centre.lat, lng: aoi.target.centre.lon },
  ]

  // The secondary complex is optional in the contract. Without it, posts naming
  // Chandipur simply get no marker rather than being folded into the island.
  if (aoi.secondary_site) {
    sites.push({
      id: 'chandipur',
      name: aoi.secondary_site.name,
      lat: aoi.secondary_site.centre.lat,
      lng: aoi.secondary_site.centre.lon,
    })
  }

  return sites
}

function siteFor(post: SocialPost, sites: SocialSite[]): SocialSite | undefined {
  const terms = post.matched_keywords.map((keyword) => keyword.toLowerCase())
  // The island wins a tie: a post naming both is about the launch site, and
  // Chandipur is routinely named as the nearest town rather than as the subject.
  if (terms.some((term) => ISLAND_TERMS.includes(term))) return sites.find((site) => site.id === 'island')
  if (terms.some((term) => CHANDIPUR_TERMS.includes(term))) return sites.find((site) => site.id === 'chandipur')
  return undefined
}

/**
 * Recovered media, indexed by the post it belongs to.
 *
 * A video's poster frame is as good a still as a photo, so both count. Built
 * once per load rather than scanned per row.
 */
export function socialImageIndex(images: SocialImagePost[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const entry of images) {
    const url = entry.image_urls[0] ?? entry.video_urls[0]
    if (url) index.set(entry.post_url, url)
  }
  return index
}

/**
 * The per-platform sweep as activity-feed rows.
 *
 * Every post appears — no filtering by platform or relevance. The category is
 * how the post was matched, strongest first: evacuation language is civil
 * unrest, a named system is armed conflict, forward-looking wording is military
 * movement, and a bare place name is political signalling.
 */
export function socialPostFeedItems(
  posts: SocialPost[],
  images: Map<string, string>,
  sites: SocialSite[],
  now: number = Date.now(),
): FeedItem[] {
  return posts.map((post, index) => {
    const category = postCategory(post)
    const site = siteFor(post, sites)
    const published = unixSeconds(post.published) ?? Math.floor(now / 1000)

    return {
      id: `itr-post-${post.platform}-${post.id || index}`,
      clusterId: site ? `itr-social-${site.id}` : 'itr-social',
      watchName: site?.name ?? 'Abdul Kalam Island',
      category,
      platform: post.platform,
      time: relativeTime(published, now),
      timestamp: published,
      text: truncate(post.title, FEED_TEXT_LIMIT),
      // A post that names a place *and* a system is the strongest kind here; one
      // that only carries a loose keyword is the weakest.
      confidence: site && post.matched_systems.length > 0 ? 5 : site ? 4 : post.aoi_relevant ? 3 : 2,
      author: post.author?.alias ?? undefined,
      thumbnail: images.get(post.url),
      url: post.url,
      focus: site ? { lat: site.lat, lng: site.lng } : undefined,
    }
  })
}

/**
 * Which category a post belongs to.
 *
 * The subject is a missile test range, so reporting about it is military
 * activity — a post naming the island and nothing else is still about a weapons
 * trial, not about politics. An earlier version fell through to `political`
 * whenever no system was named, which put 120 of 242 posts under a heading that
 * described none of them.
 *
 * The one genuine exception is evacuation, road-closure and fishing-ban
 * reporting: that is civil, and it is the highest-scoring indicator in the
 * assessment, so it keeps its own category rather than being absorbed.
 */
function postCategory(post: SocialPost): CategoryKey {
  return post.evacuation_terms.length > 0 ? 'unrest' : 'military'
}

/** Every post that named a given site, newest first. */
export function socialPostsBySite(posts: SocialPost[], sites: SocialSite[]): Map<string, SocialPost[]> {
  const grouped = new Map<string, SocialPost[]>()

  for (const post of posts) {
    const site = siteFor(post, sites)
    if (!site) continue
    const bucket = grouped.get(site.id)
    if (bucket) bucket.push(post)
    else grouped.set(site.id, [post])
  }

  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => (unixSeconds(b.published) ?? 0) - (unixSeconds(a.published) ?? 0))
  }

  return grouped
}

/**
 * Smallest and largest a reporting cluster is allowed to draw, in px.
 *
 * Deliberately small. The two sites are ~32 km apart, so at any zoom that shows
 * both, big circles overlap each other *and* bury the sites, warnings and
 * evacuation markers they sit on top of. This is a count attached to a place,
 * not a feature in its own right, so it draws as a badge.
 */
const CLUSTER_MIN_SIZE = 22
const CLUSTER_MAX_SIZE = 30

/**
 * One cluster per site, counting the reporting that names it.
 *
 * A count at a place reads instantly; 183 individual pins at two coordinates
 * would not. The caller draws it small and offset from the site marker, since
 * it annotates a point that is already on the map.
 *
 * `inferred` is not set: it would draw the circle dashed, and these render
 * through `createReportingIcon` instead, which is a solid pill.
 */
export function socialClusters(posts: SocialPost[], sites: SocialSite[]): Cluster[] {
  const grouped = socialPostsBySite(posts, sites)
  const largest = Math.max(1, ...[...grouped.values()].map((bucket) => bucket.length))

  return sites.flatMap((site) => {
    const bucket = grouped.get(site.id)
    if (!bucket || bucket.length === 0) return []

    // The category the reporting mostly falls into — the circle can only be one
    // colour, and the detail panel breaks the rest down.
    const tally = new Map<CategoryKey, number>()
    for (const post of bucket) {
      const category = postCategory(post)
      tally.set(category, (tally.get(category) ?? 0) + 1)
    }
    const dominant = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'military'

    // Area, not radius, tracks the count — a circle twice as wide reads as four
    // times as much, which would overstate the smaller site.
    const share = Math.sqrt(bucket.length / largest)

    return [
      {
        id: `social-${site.id}`,
        watchId: site.id,
        category: dominant,
        count: bucket.length,
        lat: site.lat,
        lng: site.lng,
        size: Math.round(CLUSTER_MIN_SIZE + (CLUSTER_MAX_SIZE - CLUSTER_MIN_SIZE) * share),
      },
    ]
  })
}

/**
 * Posts in the shape the topic-detail panel already renders.
 *
 * The same `PostCard` the dashboard has always used — text, imagery, and a link
 * to the original. Every image the post carried is passed through rather than
 * just the one the feed row previews, since this is where someone has stopped
 * to actually read it.
 */
export function socialPostDetails(
  posts: SocialPost[],
  images: Map<string, string[]>,
  now: number = Date.now(),
): Post[] {
  return posts.map((post) => ({
    platform: post.platform,
    handle: post.author?.alias ? `@${post.author.alias}` : post.query,
    author: post.author?.alias ?? undefined,
    time: relativeTime(unixSeconds(post.published) ?? Math.floor(now / 1000), now),
    // `summary` repeats the title on most posts; only add it when it says more.
    text: post.summary && post.summary.trim() !== post.title.trim() ? `${post.title}\n\n${post.summary}` : post.title,
    images: images.get(post.url),
    url: post.url,
  }))
}

/** Every recovered picture for a post, not just the first. */
export function socialImageGallery(images: SocialImagePost[]): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const entry of images) {
    const urls = [...entry.image_urls, ...entry.video_urls]
    if (urls.length > 0) index.set(entry.post_url, urls)
  }
  return index
}

/** Scene footprints, dashed because a footprint is coverage, not an object. */
export function imageryAreas(scenes: ImageryScene[]): MapArea[] {
  return scenes.map((scene) => ({
    id: `imagery-${scene.scene_id}`,
    layerId: 'itr_imagery' as const,
    ring: outerRing(scene.geometry),
    label: `${scene.constellation.toUpperCase()} · ${scene.resolution_m} m`,
    detail: `${Math.round(scene.cloud_cover)}% cloud · ${scene.acquired_at.slice(0, 10)}`,
    dashed: true,
  }))
}
