import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { setConfig } from "@/server/db/repositories/server-config";
import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

/**
 * Update registration enabled setting.
 */
const updateRegistration = adminProcedure.input(z.boolean()).mutation(async ({ input, ctx }) => {
  log.info({ userId: ctx.user.id, enabled: input }, "Updating registration setting");

  await setConfig(ServerConfigKeys.REGISTRATION_ENABLED, input, ctx.user.id, false);

  return { success: true };
});

export const registrationProcedures = router({
  updateRegistration,
});
