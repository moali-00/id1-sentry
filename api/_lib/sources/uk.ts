import type { CameraRecord } from '../../../src/types/cctv.ts'
import { asArray, cached, upstreamJson } from '../upstream.ts'
import { plottable } from './shared.ts'

/**
 * Transport for London JamCams — around 900 cameras across Greater London, and
 * the densest single open camera network in the port.
 *
 * TfL's unified API models a camera as a "Place", so the image URL arrives inside
 * a generic `additionalProperties` key/value list rather than as a field. When
 * that key is missing the URL is still derivable, because the JamCam bucket is
 * keyed by the id with the `JamCams_` prefix stripped.
 */

interface TflProperty {
  key?: string
  value?: string
}

interface TflPlace {
  id?: string
  lat?: number
  lon?: number
  commonName?: string
  additionalProperties?: TflProperty[]
}

const JAMCAM_BUCKET = 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk'

export function fetchUkCameras(): Promise<CameraRecord[]> {
  return cached('uk', async () => {
    const places = asArray<TflPlace>(await upstreamJson('https://api.tfl.gov.uk/Place/Type/JamCam', { timeoutMs: 12_000 }))

    return places
      .map((place) => {
        const imageUrl = place.additionalProperties?.find((property) => property.key === 'imageUrl')?.value
        const bareId = place.id?.replace('JamCams_', '') ?? ''

        return {
          id: `tfl-${place.id ?? bareId}`,
          lat: place.lat ?? NaN,
          lng: place.lon ?? NaN,
          name: place.commonName || 'London JamCam',
          city: 'London',
          country: 'United Kingdom',
          feed_url: imageUrl || (bareId ? `${JAMCAM_BUCKET}/${bareId}.jpg` : undefined),
          source: 'TfL',
        } satisfies Partial<CameraRecord>
      })
      .filter(plottable)
  })
}
