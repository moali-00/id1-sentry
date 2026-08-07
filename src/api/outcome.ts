import type {
  AdsbVerification,
  AirspaceExclusion,
  ClosedZonesRegister,
  EnvironmentAfter,
  GroundTruth,
  MaritimeAfter,
  OutcomeBundle,
  PredictionScorecard,
  PressAnalysis,
  SocialPostsAfter,
  WeatherLaunchDay,
} from '@/types/outcome'

/**
 * The after-action captures.
 *
 * Unlike everything in `@/api/sentiry.ts`, these have **no live counterpart and
 * never will**. They are a frozen review of one event: ten files captured
 * between 06:16Z and 07:31Z on 07 August 2026, the morning after the trial. A
 * `hasApi()` branch here would be a lie — there is no endpoint that serves a
 * historical scorecard, and pretending otherwise would invite someone to point
 * this at a backend and get silence.
 *
 * So they are bundled, not fetched. What is preserved from the Sentiry pattern
 * is the *shape* of the boundary: async functions returning typed payloads, so
 * the slice consuming them cannot tell where the bytes came from.
 *
 * Every import is dynamic, and they are split into two calls on size. The nine
 * core captures total about 96 kB and are needed on the map and in the map's
 * resolution banner, so they load with everything else. The social sweep is
 * 196 kB on its own — twice the rest combined, and read only inside the review
 * panel — so it is left to `fetchOutcomePosts`.
 */
export async function fetchOutcome(): Promise<OutcomeBundle> {
  const [groundTruth, scorecard, exclusion, adsb, zones, maritime, weather, environment, press] = await Promise.all([
    import('@/data/outcome/ground_truth.json'),
    import('@/data/outcome/prediction_scorecard.json'),
    import('@/data/outcome/airspace_exclusion_analysis.json'),
    import('@/data/outcome/hourly_adsb_verification.json'),
    import('@/data/outcome/closed_zones_register.json'),
    import('@/data/outcome/maritime_after.json'),
    import('@/data/outcome/weather_launch_day.json'),
    import('@/data/outcome/environment_after.json'),
    import('@/data/outcome/press_analysis_defencesecurityasia.json'),
  ])

  // One assertion per capture rather than a generic helper: these are nine
  // unrelated shapes, and a helper would only hide which one drifted.
  return {
    groundTruth: groundTruth.default as unknown as GroundTruth,
    scorecard: scorecard.default as unknown as PredictionScorecard,
    exclusion: exclusion.default as unknown as AirspaceExclusion,
    adsb: adsb.default as unknown as AdsbVerification,
    zones: zones.default as unknown as ClosedZonesRegister,
    maritime: maritime.default as unknown as MaritimeAfter,
    weather: weather.default as unknown as WeatherLaunchDay,
    environment: environment.default as unknown as EnvironmentAfter,
    press: press.default as unknown as PressAnalysis,
  }
}

/** The 101 posts published after the trial. Its own chunk — see above. */
export async function fetchOutcomePosts(): Promise<SocialPostsAfter> {
  const capture = await import('@/data/outcome/social_posts_after.json')
  return capture.default as unknown as SocialPostsAfter
}
