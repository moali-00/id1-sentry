import type { CameraRecord } from '../../../src/types/cctv.ts'

/**
 * The Balkans — hand-listed, because none of these operators publishes a registry
 * to poll.
 *
 * Six cameras, and they are here rather than anywhere else because they are the only
 * **inline video** in the layer. Three are land border crossings under continuous
 * HLS, which is the closest thing in open camera data to what this dashboard does
 * for a test range: a fixed place where movement is the signal.
 *
 * ## Every entry was checked against its live endpoint
 *
 * Not a formality. The implementation this was ported from carried twenty-three
 * YouTube embeds, of which **nine were dead** and several survivors were mislabelled
 * — its "Shibuya crossing" and "Tokyo Tower" no longer exist, its "Madrid Gran Vía"
 * is a beach in Catalonia. On a map a mislabelled camera is worse than a missing
 * one: it is a confident claim about what you are looking at.
 *
 * ## What this file will never contain
 *
 * Unsecured private cameras. Aggregators of misconfigured devices are not a source —
 * those are somebody's shop floor or front door, online by accident. Every entry is
 * a feed its operator publishes for viewing.
 *
 * ## Expect rot
 *
 * A stream ends when its operator stops it. That is why the viewer's failure state
 * offers "open at the provider" beside "retry": a dead feed here is ordinary wear,
 * not a bug to chase.
 */

/**
 * Border crossings — the reason the HLS path exists.
 */
const BORDERS: CameraRecord[] = [
  {
    id: 'mk-deve-bair',
    lat: 42.149,
    lng: 22.537,
    name: 'Deve Bair — Gyueshevo crossing, North Macedonia / Bulgaria',
    city: 'Deve Bair',
    country: 'North Macedonia',
    stream_url: 'https://streaming1.neotel.net.mk/stream/deve_bair.m3u8',
    stream_type: 'hls',
    source: 'Neotel',
  },
  {
    id: 'mk-tabanovce',
    lat: 42.232,
    lng: 21.718,
    name: 'Tabanovce — Preševo crossing, North Macedonia / Serbia',
    city: 'Tabanovce',
    country: 'North Macedonia',
    stream_url: 'https://streaming1.neotel.net.mk/stream/tabanovce.m3u8',
    stream_type: 'hls',
    source: 'Neotel',
  },
  {
    id: 'rs-gradina',
    lat: 42.997,
    lng: 22.882,
    name: 'Gradina — Kalotina crossing, Serbia / Bulgaria',
    city: 'Gradina',
    country: 'Serbia',
    stream_url: 'https://kamere.amss.org.rs/gradina1/gradina1.m3u8',
    stream_type: 'hls',
    source: 'AMSS',
  },
]

/** City cameras, for a snapshot and a stream alongside the crossings. */
const CITIES: CameraRecord[] = [
  {
    id: 'bg-sofia-tsarigradsko',
    lat: 42.662,
    lng: 23.376,
    name: 'Tsarigradsko Shose',
    city: 'Sofia',
    country: 'Bulgaria',
    feed_url: 'https://cdn.uab.org/images/cctv/images/cctv/cctv_103/cctv.jpg',
    source: 'Union of Bulgarian Motorists',
  },
  {
    id: 'bg-burgas-centre',
    lat: 42.497,
    lng: 27.47,
    name: 'Burgas city centre',
    city: 'Burgas',
    country: 'Bulgaria',
    stream_url: 'https://pics.smartburgas.eu/m3u8/burgas_town_Center.m3u8',
    stream_type: 'hls',
    external_url: 'https://www.weather-webcam.eu/cams/burgas-centar.html',
    source: 'Smart Burgas',
  },
  {
    id: 'rs-belgrade',
    lat: 44.817,
    lng: 20.456,
    name: 'Belgrade city view',
    city: 'Belgrade',
    country: 'Serbia',
    feed_url: 'https://stream.uzivobeograd.rs/live/cam_7.jpg',
    source: 'Uživo Beograd',
  },
]

export const BALKANS: CameraRecord[] = [...BORDERS, ...CITIES]
