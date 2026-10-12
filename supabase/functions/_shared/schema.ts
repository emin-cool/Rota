import { z } from 'zod';

const lng = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);
const lngLat = z.tuple([lng, lat]);

const extrasSchema = z
  .object({
    avoidTraffic: z.boolean().optional(),
    litStreets: z.boolean().optional(),
    amenities: z.boolean().optional(),
    transitEnd: z.boolean().optional(),
    dog: z.boolean().optional(),
    stroller: z.boolean().optional(),
    surface: z.enum(['paved', 'unpaved', 'any']).optional(),
    bikeLanes: z.boolean().optional(),
  })
  .strict();

/** İstek gövdesi doğrulaması. Alan adları docs/03 "Girdi şeması" ile birebir. */
export const inputSchema = z
  .object({
    activityType: z.enum(['walk', 'run', 'bike']),
    routeType: z.enum(['loop', 'a_b', 'out_back']),
    start: lngLat,
    end: lngLat.optional(),
    durationMin: z.number().min(10).max(600).optional(),
    distanceM: z.number().min(500).max(100_000).optional(),
    paceSecPerKm: z.number().min(150).max(1200).optional(),
    scenery: z
      .array(z.enum(['coast', 'green', 'historic', 'any']))
      .max(4)
      .default(['any']),
    slope: z.enum(['flat', 'some', 'hilly']).default('some'),
    extras: extrasSchema.default({}),
    debug: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.routeType === 'a_b' && !v.end) {
      ctx.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'A→B rotası için bitiş noktası gerekli',
      });
    }
    if (v.routeType !== 'a_b' && v.durationMin === undefined && v.distanceM === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationMin'],
        message: 'süre (durationMin) ya da mesafe (distanceM) gerekli',
      });
    }
  });

export type ParsedInput = z.output<typeof inputSchema>;
