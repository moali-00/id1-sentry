import { relativeTime, truncate } from '@/utils/format'
import { corridorWedge, destinationPoint, greatCircle } from '@/utils/geodesy'
import type { CategoryKey, FeedItem, MapArea, MapLine, MapPoint } from '@/types/monitoring'
import type {
  Aircraft,
  AoiBoxKey,
  AoiResponse,
  CoupledTrial,
  DangerArea,
  GeoPolygon,
  ImageryScene,
  MaritimeWarning,
  SocialItem,
  ThermalDetection,
} from '@/types/sentiry'

/**
 * Sentiry wire shapes → the map's own view models.
 *
 * The one rule worth remembering: **GeoJSON is `[lon, lat]` and Leaflet is
 * `[lat, lng]`.** Every ring crossing this boundary gets flipped exactly once,
 * here, so no component has to think about it.
 */

const unixSeconds = (iso: string | null | undefined): number | undefined => {
  if (!iso) return undefined
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined
}

/** GeoJSON `[[lon, lat], …]` → Leaflet `[[lat, lng], …]`. */
function toLeafletRing(polygon: GeoPolygon): [number, number][] {
  return (polygon.coordinates[0] ?? []).map(([lon, lat]) => [lat, lon] as [number, number])
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
        ring: toLeafletRing(box.geojson),
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
          [b.south, b.west],
          [b.south, b.east],
          [b.north, b.east],
          [b.north, b.west],
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
 * `positions` is already a closed ring in lat/lon, so it only needs reordering.
 * A coarse geometry — a NOTAM giving a centre and a radius rather than a
 * published boundary — is drawn dashed, because the shape is this service's
 * approximation rather than the authority's.
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

    return [
      {
        id: `danger-${area.notam_id}`,
        layerId: 'itr_danger_areas' as const,
        ring: area.positions.map((position) => [position.lat, position.lon] as [number, number]),
        label: `${area.notam_id} · danger area`,
        detail: `${when}${distance} · ${area.lower_limit ?? 'SFC'}–${area.upper_limit ?? 'UNL'}`,
        dashed: area.geometry_coarse,
      },
    ]
  })
}

/**
 * Launch corridors — the wedge each warning's geometry describes.
 *
 * This is the most direct answer to "where is this aimed": the warning already
 * carries a bearing, an angular span and near/far distances, so the shape is
 * the authority's own declaration rather than anything inferred here.
 *
 * Drawn from the launch site, since that is the vertex the corridor is measured
 * from.
 */
export function corridorAreas(warnings: MaritimeWarning[], origin: { lat: number; lon: number }): MapArea[] {
  return warnings.flatMap((warning) => {
    const corridor = warning.corridor
    if (!corridor) return []

    const systems = warning.likely_systems
    const detail = [
      `bearing ${Math.round(corridor.bearing_deg)}° ±${Math.round(corridor.bearing_span_deg / 2)}°`,
      `${Math.round(corridor.near_km)}–${Math.round(corridor.far_km)} km`,
      systems ? `${systems.label} (${systems.confidence})` : null,
    ]
      .filter(Boolean)
      .join(' · ')

    return [
      {
        id: `corridor-${warning.message_id}`,
        layerId: 'itr_corridors' as const,
        ring: corridorWedge(
          origin.lat,
          origin.lon,
          corridor.bearing_deg,
          corridor.bearing_span_deg,
          corridor.near_km,
          corridor.far_km,
        ),
        label: `${warning.number} corridor`,
        detail,
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
        path: [[contact.latitude, contact.longitude], ahead],
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

    return {
      id: `itr-social-${index}`,
      clusterId: 'itr-social',
      watchName: 'Abdul Kalam Island',
      category,
      platform: item.platform.replace(/_/g, ' ').toUpperCase(),
      time: relativeTime(unixSeconds(item.published_at) ?? Math.floor(now / 1000), now),
      text: truncate(item.title, FEED_TEXT_LIMIT),
      // AOI-relevant items were matched on a place or programme name; the rest
      // came in on a looser keyword and are worth less.
      confidence: item.aoi_relevant ? 4 : 2,
    }
  })
}

/** Scene footprints, dashed because a footprint is coverage, not an object. */
export function imageryAreas(scenes: ImageryScene[]): MapArea[] {
  return scenes.map((scene) => ({
    id: `imagery-${scene.scene_id}`,
    layerId: 'itr_imagery' as const,
    ring: toLeafletRing(scene.geometry),
    label: `${scene.constellation.toUpperCase()} · ${scene.resolution_m} m`,
    detail: `${Math.round(scene.cloud_cover)}% cloud · ${scene.acquired_at.slice(0, 10)}`,
    dashed: true,
  }))
}
